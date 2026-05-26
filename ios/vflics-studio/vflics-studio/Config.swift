import Foundation

/// Build-time configuration. Change the endpoint URL here when you move
/// production hosts; otherwise no per-install config beyond the token.
enum Config {
    /// The Vercel `/api/studio/upload-remote` endpoint.
    static let endpointURL = "https://vflics.com/api/studio/upload-remote"
}
