import Foundation

/// Direct Google Drive REST API client. Each call uploads ONE file via the
/// multipart `uploadType=multipart` endpoint. Streaming/resumable uploads
/// could replace this for very large files; multipart is fine for photos.
struct UploadClient {
    /// Upload a single file to a Drive folder. Returns the new file's Drive ID.
    /// - Parameters:
    ///   - accessToken: A valid OAuth access token with `drive.file` scope.
    ///   - folderId: Drive folder ID to drop the file into.
    ///   - filename: Display filename (e.g. "Set Name (1).jpg").
    ///   - bytes: File bytes.
    ///   - mimeType: MIME type (defaults to image/jpeg).
    static func uploadFile(
        accessToken: String,
        folderId: String,
        filename: String,
        bytes: Data,
        mimeType: String = "image/jpeg"
    ) async throws -> String {
        let boundary = "----vflics-\(UUID().uuidString)"

        let metadata: [String: Any] = [
            "name": filename,
            "parents": [folderId],
        ]
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

        var req = URLRequest(url: URL(string: Config.driveUploadURL)!)
        req.httpMethod = "POST"
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("multipart/related; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 600 // 10 min per file

        let (responseData, response) = try await URLSession.shared.upload(for: req, from: body)
        guard let http = response as? HTTPURLResponse, http.statusCode < 300 else {
            let httpStatus = (response as? HTTPURLResponse)?.statusCode ?? 0
            let body = String(data: responseData, encoding: .utf8) ?? "<no body>"
            throw UploadError.driveError(status: httpStatus, message: body)
        }
        struct Resp: Decodable { let id: String }
        return try JSONDecoder().decode(Resp.self, from: responseData).id
    }
}

enum UploadError: LocalizedError {
    case driveError(status: Int, message: String)
    case fileNotAttached(String)
    case notSignedIn
    case missingFolderId(String)

    var errorDescription: String? {
        switch self {
        case .driveError(let code, let msg):
            return "Drive upload failed [\(code)]: \(msg)"
        case .fileNotAttached(let name):
            return "Photo \"\(name)\" is no longer attached. Re-add it before pushing."
        case .notSignedIn:
            return "Not signed in. Open Settings and sign in with Google."
        case .missingFolderId(let slug):
            return "No Drive folder configured for destination \"\(slug)\". Add it in Config or use a custom destination."
        }
    }
}
