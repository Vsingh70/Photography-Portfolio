import Foundation

/// Build-time configuration. iOS app talks directly to Google Drive via OAuth
/// (drive.file scope). No per-install settings beyond what the user signs in
/// with — the token persists in the iOS Keychain.
enum Config {
    /// iOS OAuth client ID, registered as an iOS-type credential in Google
    /// Cloud Console (separate from the Tauri/desktop client).
    static let oauthClientID = "545350887333-3h1qjmaqcuonifts783hsgc5rakk0idc.apps.googleusercontent.com"

    /// iOS OAuth redirect scheme — Google's iOS convention is the reverse-DNS
    /// of the client ID. Must match a CFBundleURLScheme in the bundle
    /// (configured via INFOPLIST_KEY_CFBundleURLTypes in project.pbxproj).
    static let oauthRedirectScheme = "com.googleusercontent.apps.545350887333-3h1qjmaqcuonifts783hsgc5rakk0idc"

    /// Full redirect URI Google will send the auth code to.
    static var oauthRedirectURI: String { "\(oauthRedirectScheme):/oauth2redirect" }

    /// Scopes requested at sign-in.
    static let oauthScopes = [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/userinfo.email",
    ]

    /// Drive folder IDs per destination slug. These are public Drive folder
    /// IDs (visible in browser URLs when sharing). Not secrets — safe to
    /// commit. Must be writable by the signed-in Google account.
    ///
    /// Match the same set used by the Vercel destinations endpoint.
    static let destinationFolderIDs: [String: String] = [
        "editorial":  "11TrJbaLVZh3MtbN-gdhpPq6Nt2O5QPOU",
        "portraits":  "1CF7yYOl4Y-uWkzqvmw_0-3HFbShKiRkB",
        "graduation": "18zpHRcTsOArgjppcJWgBI7kp6DB1lf2v",
        "engagement": "1J0e4zP7aMlKgzjNmx0MU-m3_lfA_J6Gf",
        "events":     "1uZEgnzPehDnNIesaRC-Mk1n3yFINEx9p",
        "about":      "1Xi_xptW_j9-BDqREjFHWfDProFfrFgNF",
    ]

    /// Drive REST API multipart-upload endpoint.
    static let driveUploadURL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"

    /// Google's OAuth token endpoint (used for both code exchange and refresh).
    static let oauthTokenURL = "https://oauth2.googleapis.com/token"

    /// Google's OAuth authorization endpoint.
    static let oauthAuthURL = "https://accounts.google.com/o/oauth2/v2/auth"

    /// User-info endpoint to grab email after sign-in.
    static let userInfoURL = "https://www.googleapis.com/oauth2/v3/userinfo"
}
