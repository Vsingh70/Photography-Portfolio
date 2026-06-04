import Foundation
import AuthenticationServices
import UIKit

/// Native iOS Google OAuth flow using ASWebAuthenticationSession.
///
/// Flow:
///   1. Build the Google auth URL with random state + offline access
///   2. Present ASWebAuthenticationSession (in-app Safari)
///   3. User signs in / authorizes; Google redirects to our app scheme
///   4. Parse code + verify state
///   5. POST to https://oauth2.googleapis.com/token to exchange for tokens
///   6. GET userinfo to grab the email for display
///
/// Token refresh uses the same token endpoint with grant_type=refresh_token.
@MainActor
final class GoogleOAuth: NSObject {
    private var currentSession: ASWebAuthenticationSession?

    /// Full interactive sign-in. Returns access + refresh + email + expiry.
    func signIn() async throws -> SignInResult {
        let state = UUID().uuidString
        var components = URLComponents(string: Config.oauthAuthURL)!
        components.queryItems = [
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "client_id", value: Config.oauthClientID),
            URLQueryItem(name: "redirect_uri", value: Config.oauthRedirectURI),
            URLQueryItem(name: "scope", value: Config.oauthScopes.joined(separator: " ")),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: "consent"),
        ]
        guard let authURL = components.url else { throw GoogleOAuthError.couldNotStart }

        let redirectURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: Config.oauthRedirectScheme
            ) { url, error in
                if let url = url {
                    continuation.resume(returning: url)
                } else if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(throwing: GoogleOAuthError.unknown)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.currentSession = session
            if !session.start() {
                continuation.resume(throwing: GoogleOAuthError.couldNotStart)
            }
        }

        // Verify state + extract code.
        let queryItems = URLComponents(url: redirectURL, resolvingAgainstBaseURL: false)?.queryItems ?? []
        if let errorValue = queryItems.first(where: { $0.name == "error" })?.value {
            throw GoogleOAuthError.providerError(errorValue)
        }
        guard let code = queryItems.first(where: { $0.name == "code" })?.value else {
            throw GoogleOAuthError.missingCode
        }
        let returnedState = queryItems.first(where: { $0.name == "state" })?.value
        guard returnedState == state else { throw GoogleOAuthError.stateMismatch }

        let tokens = try await exchangeCode(code)
        let email = try await fetchUserEmail(accessToken: tokens.accessToken)
        guard !tokens.refreshToken.isEmpty else {
            throw GoogleOAuthError.providerError(
                "Google did not return a refresh token. Revoke access at myaccount.google.com/permissions and try again."
            )
        }
        return SignInResult(
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: Date(timeIntervalSinceNow: Double(tokens.expiresIn) - 60),
            email: email
        )
    }

    /// Use a stored refresh token to get a new access token. Doesn't re-issue
    /// a refresh token (Google reuses the same one).
    func refresh(refreshToken: String) async throws -> RefreshResult {
        var req = URLRequest(url: URL(string: Config.oauthTokenURL)!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let params = [
            "client_id": Config.oauthClientID,
            "refresh_token": refreshToken,
            "grant_type": "refresh_token",
        ]
        req.httpBody = Self.formEncode(params).data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "<no body>"
            throw GoogleOAuthError.refreshFailed(body)
        }
        let decoded = try JSONDecoder().decode(TokenResponse.self, from: data)
        return RefreshResult(
            accessToken: decoded.accessToken,
            expiresAt: Date(timeIntervalSinceNow: Double(decoded.expiresIn) - 60)
        )
    }

    // MARK: Internals

    private func exchangeCode(_ code: String) async throws -> TokenResponse {
        var req = URLRequest(url: URL(string: Config.oauthTokenURL)!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let params = [
            "code": code,
            "client_id": Config.oauthClientID,
            "redirect_uri": Config.oauthRedirectURI,
            "grant_type": "authorization_code",
        ]
        req.httpBody = Self.formEncode(params).data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "<no body>"
            throw GoogleOAuthError.exchangeFailed(body)
        }
        return try JSONDecoder().decode(TokenResponse.self, from: data)
    }

    private func fetchUserEmail(accessToken: String) async throws -> String {
        var req = URLRequest(url: URL(string: Config.userInfoURL)!)
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "<no body>"
            throw GoogleOAuthError.providerError("userinfo HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0): \(body)")
        }
        struct UserInfo: Decodable { let email: String }
        return try JSONDecoder().decode(UserInfo.self, from: data).email
    }

    private static func formEncode(_ params: [String: String]) -> String {
        params.map { key, value in
            let v = value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
            return "\(key)=\(v)"
        }.joined(separator: "&")
    }
}

extension GoogleOAuth: ASWebAuthenticationPresentationContextProviding {
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        // Find the active key window. ASWebAuthenticationSession runs in a
        // separate process so anchor identity matters only for parenting.
        return MainActor.assumeIsolated {
            if let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }),
               let window = scene.windows.first(where: \.isKeyWindow) {
                return window
            }
            return ASPresentationAnchor()
        }
    }
}

struct SignInResult {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
    let email: String
}

struct RefreshResult {
    let accessToken: String
    let expiresAt: Date
}

struct TokenResponse: Decodable {
    let access_token: String
    let refresh_token: String?
    let expires_in: Int

    var accessToken: String { access_token }
    var refreshToken: String { refresh_token ?? "" }
    var expiresIn: Int { expires_in }
}

enum GoogleOAuthError: LocalizedError {
    case missingCode
    case stateMismatch
    case providerError(String)
    case couldNotStart
    case exchangeFailed(String)
    case refreshFailed(String)
    case missingFolderId(String)
    case unknown

    var errorDescription: String? {
        switch self {
        case .missingCode: return "Google did not return an authorization code."
        case .stateMismatch: return "Possible CSRF — state mismatch."
        case .providerError(let s): return "Google returned: \(s)"
        case .couldNotStart: return "Could not present the sign-in sheet."
        case .exchangeFailed(let s): return "Token exchange failed: \(s)"
        case .refreshFailed(let s): return "Refresh failed; please sign in again. (\(s))"
        case .missingFolderId(let s): return "Missing folder ID for destination \"\(s)\"."
        case .unknown: return "Unknown OAuth error."
        }
    }
}
