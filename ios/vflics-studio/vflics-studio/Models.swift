import Foundation
import UIKit

/// A photo staged for upload. `image` is loaded from PHPicker into memory only
/// when needed; metadata (name, size, hash) persists across launches via the
/// draft system, but the actual pixel data does not.
struct UploadFile: Identifiable, Hashable, Codable {
    let id: UUID
    var name: String
    var size: Int           // bytes
    var hash: String        // sha256 of original bytes — used for dedup
    var duplicate: Bool = false

    // Runtime-only — not encoded
    var imageData: Data? = nil

    enum CodingKeys: String, CodingKey {
        case id, name, size, hash, duplicate
    }

    var isMissing: Bool { imageData == nil }
}

/// A group of photos with one destination. The set name becomes the rename
/// prefix on push: "VDR Party (1).jpg", "VDR Party (2).jpg", etc.
struct UploadSet: Identifiable, Codable {
    let id: UUID
    var name: String
    var destinationSlug: String
    var files: [UploadFile]

    init(id: UUID = UUID(), name: String = "", destinationSlug: String = "", files: [UploadFile] = []) {
        self.id = id
        self.name = name
        self.destinationSlug = destinationSlug
        self.files = files
    }
}

/// A Drive folder we can push into. Built-ins come from the Vercel endpoint;
/// custom destinations are added on-device with a manually-typed folder ID.
struct Destination: Identifiable, Hashable, Codable {
    var id: String { slug }
    var slug: String
    var label: String
    var folderId: String?
    var custom: Bool

    static let defaults: [Destination] = [
        .init(slug: "editorial",  label: "Editorial",  folderId: nil, custom: false),
        .init(slug: "portraits",  label: "Portraits",  folderId: nil, custom: false),
        .init(slug: "graduation", label: "Graduation", folderId: nil, custom: false),
        .init(slug: "engagement", label: "Engagement", folderId: nil, custom: false),
        .init(slug: "events",     label: "Events",     folderId: nil, custom: false),
        .init(slug: "about",      label: "About",      folderId: nil, custom: false),
    ]
}

/// Server's destinations response — which built-in slugs have folder IDs
/// configured in Vercel env.
struct ServerDestinationsResponse: Decodable {
    let destinations: [ServerDestination]
}

struct ServerDestination: Decodable {
    let slug: String
    let folderId: String
}

/// Successful upload response from /api/studio/upload-remote.
struct UploadResponse: Decodable {
    let ok: Bool
    let uploaded: [UploadedFile]
}

struct UploadedFile: Decodable {
    let index: Int
    let renamed: String
    let id: String
    let name: String
}

/// Error envelope for non-2xx responses.
struct ErrorResponse: Decodable {
    let error: String?
}
