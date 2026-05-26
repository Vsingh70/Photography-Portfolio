import Foundation
import UIKit

/// Talks to /api/studio/upload-remote on the Vercel backend.
struct UploadClient {
    let endpoint: URL
    let token: String

    init?(endpointString: String, token: String) {
        guard let url = URL(string: endpointString),
              !token.isEmpty else { return nil }
        self.endpoint = url
        self.token = token
    }

    /// Fetch which built-in destinations are configured on the server.
    func fetchDestinations() async throws -> [ServerDestination] {
        var req = URLRequest(url: endpoint)
        req.httpMethod = "GET"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: req)
        try Self.expectOK(response, data: data)
        let decoded = try JSONDecoder().decode(ServerDestinationsResponse.self, from: data)
        return decoded.destinations
    }

    /// Upload one set as a multipart POST. Server renames files to
    /// "<setName> (n).<ext>" in order.
    func uploadSet(setName: String, destinationSlug: String?, folderId: String?, files: [UploadFile]) async throws -> UploadResponse {
        let boundary = "----vflics-\(UUID().uuidString)"
        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 600 // 10 min upload window

        var body = Data()

        func appendField(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        appendField("setName", setName)
        if let destinationSlug { appendField("destination", destinationSlug) }
        if let folderId { appendField("folderId", folderId) }

        for f in files {
            guard let data = f.imageData else {
                throw UploadError.fileNotAttached(f.name)
            }
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"files\"; filename=\"\(f.name)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
            body.append(data)
            body.append("\r\n".data(using: .utf8)!)
        }
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        let (data, response) = try await URLSession.shared.upload(for: req, from: body)
        try Self.expectOK(response, data: data)
        return try JSONDecoder().decode(UploadResponse.self, from: data)
    }

    private static func expectOK(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw UploadError.notHTTP }
        if (200..<300).contains(http.statusCode) { return }
        let serverMessage = (try? JSONDecoder().decode(ErrorResponse.self, from: data))?.error
        throw UploadError.server(status: http.statusCode, message: serverMessage)
    }
}

enum UploadError: LocalizedError {
    case notHTTP
    case server(status: Int, message: String?)
    case fileNotAttached(String)

    var errorDescription: String? {
        switch self {
        case .notHTTP: return "Server returned a non-HTTP response."
        case .server(let code, let msg):
            if let msg, !msg.isEmpty { return "[\(code)] \(msg)" }
            return "Server returned HTTP \(code)."
        case .fileNotAttached(let name):
            return "Photo \"\(name)\" is no longer attached. Re-add it before pushing."
        }
    }
}
