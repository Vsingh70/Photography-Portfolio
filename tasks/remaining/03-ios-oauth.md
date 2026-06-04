# Task 03 — iOS: native OAuth + direct Drive upload

**Depends on**: 01 (and 02 if anything broke in 01)
**Blocks**: 04
**Estimated effort**: 3–5 hours
**Risk**: Moderate — different patterns than Tauri (ASWebAuthenticationSession, Keychain, Swift Drive REST API calls). No Rust to lean on.

## Background

After task 01 finishes, the Tauri desktop binary will be uploading directly to Drive via the user's OAuth token. The iOS app, however, **still** talks to `https://vflics.com/api/studio/upload-remote` with a bearer token.

This task migrates iOS to the same direct-Drive pattern, replacing all the bearer-token machinery with native iOS OAuth.

## Files involved

**Modify**:

- `ios/vflics-studio/vflics-studio/Config.swift` — remove `endpointURL`; add `oauthClientID`, `oauthRedirectScheme`, hardcoded `destinationFolderIDs`
- `ios/vflics-studio/vflics-studio/Store.swift` — replace `authToken`/`endpointURL` with OAuth-token state
- `ios/vflics-studio/vflics-studio/UploadClient.swift` — rewrite to talk directly to `googleapis.com/upload/drive/v3/files`
- `ios/vflics-studio/vflics-studio/Models.swift` — drop `ServerDestinationsResponse` etc. that came from Vercel
- `ios/vflics-studio/vflics-studio/KeychainStorage.swift` — swap stored keys from `endpointURL`/`authToken` to `oauthAccessToken`/`oauthRefreshToken`/`oauthEmail`/`oauthExpiresAt`
- `ios/vflics-studio/vflics-studio/Views/SettingsSheet.swift` — replace the token TextField with "Sign in with Google" / "Sign out" buttons
- `ios/vflics-studio/vflics-studio/Views/ContentView.swift` — gate the main UI on `store.isSignedIn` instead of `store.isConfigured`
- `ios/vflics-studio/vflics-studio/Views/PushSheet.swift` — error messages may reference the old endpoint

**Create**:

- `ios/vflics-studio/vflics-studio/GoogleOAuth.swift` — wrapper around `ASWebAuthenticationSession`. Handles auth URL build, presentation, code exchange, token refresh.

**Configure** in Xcode project:

- Add a URL scheme to `Info.plist` (`com.googleusercontent.apps.545350887333-3h1qjmaqcuonifts783hsgc5rakk0idc`) — this is the iOS redirect URI for the iOS OAuth client. Google iOS OAuth clients use this reverse-DNS scheme.
- Add `LSApplicationQueriesSchemes` so the app can open Google's auth in Safari View Controller without the system prompting.

## OAuth flow on iOS (different from Tauri)

iOS doesn't use loopback HTTP. Instead it uses **`ASWebAuthenticationSession`**:

1. App calls `ASWebAuthenticationSession.start()` with the auth URL
2. iOS shows an in-app Safari sheet
3. User signs in / authorizes
4. Google redirects to `com.googleusercontent.apps.{CLIENT_ID}:/oauth2redirect/?code=…`
5. iOS recognizes the scheme, closes the sheet, hands the URL back to the app's completion handler
6. App parses out the code, POSTs to `https://oauth2.googleapis.com/token` to exchange for tokens

This is materially different from the Tauri flow but uses the same Google OAuth client ID we already created.

## Implementation outline

### 1. `Config.swift`

```swift
import Foundation

enum Config {
    /// iOS OAuth client ID (different from Tauri/desktop).
    static let oauthClientID = "545350887333-3h1qjmaqcuonifts783hsgc5rakk0idc.apps.googleusercontent.com"

    /// iOS OAuth redirect scheme — derived from clientID per Google's iOS convention.
    /// Add this scheme to Info.plist as a CFBundleURLScheme.
    static let oauthRedirectScheme = "com.googleusercontent.apps.545350887333-3h1qjmaqcuonifts783hsgc5rakk0idc"
    static var oauthRedirectURI: String { "\(oauthRedirectScheme):/oauth2redirect" }

    static let oauthScopes = [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/userinfo.email",
    ]

    /// Hardcoded Drive folder IDs per destination slug.
    /// These are public Drive IDs (visible in the URL of each folder).
    /// Replace with the actual values from your project's Vercel env vars.
    static let destinationFolderIDs: [String: String] = [
        "editorial":  "REPLACE_EDITORIAL_FOLDER_ID",
        "portraits":  "REPLACE_PORTRAITS_FOLDER_ID",
        "graduation": "REPLACE_GRADUATION_FOLDER_ID",
        "engagement": "REPLACE_ENGAGEMENT_FOLDER_ID",
        "events":     "REPLACE_EVENTS_FOLDER_ID",
        "about":      "REPLACE_ABOUT_FOLDER_ID",
    ]
}
```

**You'll need to populate the folder IDs.** Get them from Vercel env vars (`GOOGLE_DRIVE_EDITORIAL_FOLDER_ID` etc.). These are not secrets — they're in the URL when you browse the folder in Drive.

### 2. `GoogleOAuth.swift`

```swift
import Foundation
import AuthenticationServices
import UIKit

@MainActor
final class GoogleOAuth: NSObject {
    private var session: ASWebAuthenticationSession?
    private var presentationAnchor: ASPresentationAnchor?

    /// Run the full OAuth flow. Returns (accessToken, refreshToken, expiresAt, email).
    func signIn() async throws -> SignInResult {
        let state = UUID().uuidString
        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "client_id", value: Config.oauthClientID),
            URLQueryItem(name: "redirect_uri", value: Config.oauthRedirectURI),
            URLQueryItem(name: "scope", value: Config.oauthScopes.joined(separator: " ")),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: "consent"),
        ]
        let authURL = components.url!

        // ASWebAuthenticationSession returns the redirect URL via the completion.
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
            session.prefersEphemeralWebBrowserSession = false  // share cookies w/ Safari for SSO
            self.session = session
            if !session.start() {
                continuation.resume(throwing: GoogleOAuthError.couldNotStart)
            }
        }

        // Parse code + verify state
        let components2 = URLComponents(url: redirectURL, resolvingAgainstBaseURL: false)
        let queryItems = components2?.queryItems ?? []
        guard let code = queryItems.first(where: { $0.name == "code" })?.value else {
            if let err = queryItems.first(where: { $0.name == "error" })?.value {
                throw GoogleOAuthError.providerError(err)
            }
            throw GoogleOAuthError.missingCode
        }
        let returnedState = queryItems.first(where: { $0.name == "state" })?.value
        guard returnedState == state else { throw GoogleOAuthError.stateMismatch }

        // Exchange code for tokens
        let tokens = try await exchangeCode(code)
        let email = try await fetchUserEmail(accessToken: tokens.accessToken)
        return SignInResult(
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: Date(timeIntervalSinceNow: Double(tokens.expiresIn) - 60),
            email: email
        )
    }

    /// Refresh using the stored refresh_token.
    func refresh(refreshToken: String) async throws -> RefreshResult {
        var req = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let body = "client_id=\(Config.oauthClientID)&refresh_token=\(refreshToken)&grant_type=refresh_token"
        req.httpBody = body.data(using: .utf8)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw GoogleOAuthError.refreshFailed
        }
        let decoded = try JSONDecoder().decode(TokenResponse.self, from: data)
        return RefreshResult(
            accessToken: decoded.access_token,
            expiresAt: Date(timeIntervalSinceNow: Double(decoded.expires_in) - 60)
        )
    }

    private func exchangeCode(_ code: String) async throws -> TokenResponse {
        var req = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let body = "code=\(code)&client_id=\(Config.oauthClientID)&redirect_uri=\(Config.oauthRedirectURI)&grant_type=authorization_code"
        req.httpBody = body.data(using: .utf8)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "<no body>"
            throw GoogleOAuthError.exchangeFailed(body)
        }
        return try JSONDecoder().decode(TokenResponse.self, from: data)
    }

    private func fetchUserEmail(accessToken: String) async throws -> String {
        var req = URLRequest(url: URL(string: "https://www.googleapis.com/oauth2/v3/userinfo")!)
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        let (data, _) = try await URLSession.shared.data(for: req)
        struct UserInfo: Decodable { let email: String }
        return try JSONDecoder().decode(UserInfo.self, from: data).email
    }
}

extension GoogleOAuth: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        // Find the active key window. ASWebAuthenticationSession runs from the active scene.
        if let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
           let window = scene.windows.first(where: \.isKeyWindow) {
            return window
        }
        return ASPresentationAnchor()
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

    var refreshToken: String { refresh_token ?? "" }
    var accessToken: String { access_token }
    var expiresIn: Int { expires_in }
}

enum GoogleOAuthError: LocalizedError {
    case missingCode
    case stateMismatch
    case providerError(String)
    case couldNotStart
    case exchangeFailed(String)
    case refreshFailed
    case unknown

    var errorDescription: String? {
        switch self {
        case .missingCode: return "Google did not return an authorization code."
        case .stateMismatch: return "Possible CSRF — state mismatch."
        case .providerError(let s): return "Google returned: \(s)"
        case .couldNotStart: return "Could not present the sign-in sheet."
        case .exchangeFailed(let s): return "Token exchange failed: \(s)"
        case .refreshFailed: return "Refresh failed; please sign in again."
        case .unknown: return "Unknown OAuth error."
        }
    }
}
```

### 3. `KeychainStorage.swift`

Add new keys, leave old ones for now (delete in task 04):

```swift
enum Key: String {
    case endpointURL          // legacy — remove in task 04
    case authToken            // legacy — remove in task 04
    case oauthAccessToken
    case oauthRefreshToken
    case oauthEmail
    case oauthExpiresAt
}
```

### 4. `Store.swift`

Replace the auth-token surface with OAuth state. Computed `isSignedIn` replaces `isConfigured`:

```swift
var oauthAccessToken: String = KeychainStorage.read(.oauthAccessToken) ?? ""
var oauthRefreshToken: String = KeychainStorage.read(.oauthRefreshToken) ?? ""
var oauthEmail: String = KeychainStorage.read(.oauthEmail) ?? ""
var oauthExpiresAt: Date = (KeychainStorage.read(.oauthExpiresAt).flatMap(Double.init).map(Date.init(timeIntervalSince1970:))) ?? Date.distantPast

var isSignedIn: Bool { !oauthAccessToken.isEmpty && !oauthRefreshToken.isEmpty }

func saveTokens(access: String, refresh: String?, expiresAt: Date, email: String) {
    oauthAccessToken = access
    if let refresh, !refresh.isEmpty { oauthRefreshToken = refresh }
    oauthExpiresAt = expiresAt
    oauthEmail = email
    KeychainStorage.write(access, for: .oauthAccessToken)
    if let refresh, !refresh.isEmpty {
        KeychainStorage.write(refresh, for: .oauthRefreshToken)
    }
    KeychainStorage.write(String(expiresAt.timeIntervalSince1970), for: .oauthExpiresAt)
    KeychainStorage.write(email, for: .oauthEmail)
}

func signOut() {
    oauthAccessToken = ""
    oauthRefreshToken = ""
    oauthEmail = ""
    oauthExpiresAt = .distantPast
    KeychainStorage.delete(.oauthAccessToken)
    KeychainStorage.delete(.oauthRefreshToken)
    KeychainStorage.delete(.oauthEmail)
    KeychainStorage.delete(.oauthExpiresAt)
}

/// Refresh if needed, return a valid access token.
func validAccessToken() async throws -> String {
    if Date() < oauthExpiresAt { return oauthAccessToken }
    guard !oauthRefreshToken.isEmpty else {
        throw GoogleOAuthError.refreshFailed
    }
    let oauth = GoogleOAuth()
    let r = try await oauth.refresh(refreshToken: oauthRefreshToken)
    oauthAccessToken = r.accessToken
    oauthExpiresAt = r.expiresAt
    KeychainStorage.write(r.accessToken, for: .oauthAccessToken)
    KeychainStorage.write(String(r.expiresAt.timeIntervalSince1970), for: .oauthExpiresAt)
    return r.accessToken
}
```

### 5. `UploadClient.swift` — full rewrite

Drop the bearer-token + Vercel multipart pattern. New shape:

```swift
struct UploadClient {
    /// Upload one file to Drive. Returns the uploaded file's Drive ID.
    static func uploadFile(
        accessToken: String,
        folderId: String,
        filename: String,
        bytes: Data,
        mimeType: String = "image/jpeg"
    ) async throws -> String {
        let boundary = "----vflics-\(UUID().uuidString)"
        let metadata = ["name": filename, "parents": [folderId]] as [String : Any]
        let metadataJSON = try JSONSerialization.data(withJSONObject: metadata)

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/json; charset=UTF-8\r\n\r\n".data(using: .utf8)!)
        body.append(metadataJSON)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(bytes)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        var req = URLRequest(url: URL(string: "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")!)
        req.httpMethod = "POST"
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("multipart/related; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 600

        let (responseData, response) = try await URLSession.shared.upload(for: req, from: body)
        guard let http = response as? HTTPURLResponse, http.statusCode < 300 else {
            let body = String(data: responseData, encoding: .utf8) ?? "<no body>"
            throw GoogleOAuthError.providerError("upload HTTP: \(body)")
        }
        struct Resp: Decodable { let id: String }
        return try JSONDecoder().decode(Resp.self, from: responseData).id
    }
}
```

### 6. `SettingsSheet.swift` — replace token field with sign-in UI

```swift
struct SettingsSheet: View {
    @Environment(Store.self) private var store
    @State private var signingIn = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 16) {
            if store.isSignedIn {
                Text("Signed in as \(store.oauthEmail)")
                Button("Sign out") { store.signOut() }
            } else {
                Button(signingIn ? "Signing in…" : "Sign in with Google") {
                    Task {
                        signingIn = true
                        defer { signingIn = false }
                        do {
                            let oauth = GoogleOAuth()
                            let r = try await oauth.signIn()
                            store.saveTokens(
                                access: r.accessToken,
                                refresh: r.refreshToken,
                                expiresAt: r.expiresAt,
                                email: r.email
                            )
                        } catch {
                            self.error = error.localizedDescription
                        }
                    }
                }
                .disabled(signingIn)
            }
            if let error = error {
                Text(error).foregroundStyle(.red).font(.caption)
            }
        }
        .padding()
    }
}
```

### 7. PushSheet / wherever upload fires

Replace the current `UploadClient.uploadSet(...)` call with a per-file loop:

```swift
let accessToken = try await store.validAccessToken()
guard let folderId = Config.destinationFolderIDs[set.destinationSlug] else {
    throw UploadError.missingFolderId
}
for (i, file) in set.files.enumerated() {
    let ext = (file.name as NSString).pathExtension
    let renamed = "\(set.name) (\(i + 1)).\(ext.isEmpty ? "jpg" : ext)"
    _ = try await UploadClient.uploadFile(
        accessToken: accessToken,
        folderId: folderId,
        filename: renamed,
        bytes: file.imageData ?? Data(),
        mimeType: "image/jpeg"
    )
}
```

### 8. Xcode project — URL scheme

In Xcode, open the project settings → `vflics-studio` target → **Info** tab → **URL Types** section → click **+** to add:

- Identifier: `com.vflics.studio`
- URL Schemes: `com.googleusercontent.apps.545350887333-3h1qjmaqcuonifts783hsgc5rakk0idc`

This lets the OAuth redirect to route back into the app.

## Verification

After implementation, test with a TestFlight build:

1. Bump `CURRENT_PROJECT_VERSION` from 2 to 3 in `vflics-studio.xcodeproj/project.pbxproj`
2. Archive → upload to TestFlight (same flow as before — see `tasks/guides/`)
3. Install the new build on your phone
4. Open the app — should show "Sign in with Google" instead of the old token field
5. Tap sign-in → Safari sheet appears with Google consent screen
6. Sign in → sheet dismisses → main UI loads
7. Create a set with photos → push → photos appear in Drive

## Acceptance criteria

- [ ] All 8 file changes/creations applied
- [ ] Xcode project URL scheme added
- [ ] Build for device succeeds (`xcodebuild -sdk iphoneos`)
- [ ] On a real device: sign-in completes, email persists across app restart
- [ ] Push to Drive succeeds with real photos
- [ ] Token refresh works (force expired in the keychain via a temporary print + manual edit, then push)

## Important caveats for Claude

- **Do not** touch the Tauri files in this task. They're in a working state after task 01.
- **Do not** delete `/api/studio/upload-remote` yet — that's task 04. Until both clients have moved off it, deletion would break the iOS app for users still on the old TestFlight build.
- **Do** keep the old `Config.endpointURL` / `KeychainStorage.Key.authToken` cases temporarily so the keychain doesn't fail to read. Just stop using them.
