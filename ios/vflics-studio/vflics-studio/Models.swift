import Foundation
import UIKit

/// A photo staged for upload. Pixel data lives in memory only; metadata
/// (name, size, hash) persists across launches via the draft system but the
/// bytes do not.
struct UploadFile: Identifiable, Hashable, Codable {
    let id: UUID
    var name: String
    var size: Int           // bytes
    var hash: String        // sha256 of original bytes — used for dedup
    var duplicate: Bool = false

    // Runtime-only — not encoded.
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

/// A Drive folder we can push into. Built-ins come from
/// `Config.destinationFolderIDs`; custom destinations are added on-device
/// with a manually-typed folder ID.
struct Destination: Identifiable, Hashable, Codable {
    var id: String { slug }
    var slug: String
    var label: String
    var folderId: String?
    var custom: Bool

    /// Built-in destinations pre-populated with folder IDs from Config.
    static var defaults: [Destination] {
        [
            destination(slug: "editorial",  label: "Editorial"),
            destination(slug: "portraits",  label: "Portraits"),
            destination(slug: "graduation", label: "Graduation"),
            destination(slug: "engagement", label: "Engagement"),
            destination(slug: "events",     label: "Events"),
            destination(slug: "about",      label: "About"),
        ]
    }

    private static func destination(slug: String, label: String) -> Destination {
        Destination(
            slug: slug,
            label: label,
            folderId: Config.destinationFolderIDs[slug],
            custom: false
        )
    }
}
