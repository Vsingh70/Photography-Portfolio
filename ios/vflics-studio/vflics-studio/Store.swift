import Foundation
import SwiftUI
import Observation

/// Single source of truth for the Studio. Mirrors the React `useState` cluster
/// in StudioApp.tsx: sets list, active set selection, destinations, push state.
@Observable
final class Store {
    // ── Config ──
    var endpointURL: String = KeychainStorage.read(.endpointURL) ?? ""
    var authToken: String = KeychainStorage.read(.authToken) ?? ""
    var isConfigured: Bool { !endpointURL.isEmpty && !authToken.isEmpty }

    // ── Data ──
    var sets: [UploadSet] = []
    var activeSetId: UUID?
    var destinations: [Destination] = Destination.defaults

    // ── Push state ──
    var pushing: Bool = false
    var pushedOk: Bool = false
    var pushError: String?
    var pushProgress: (setIdx: Int, total: Int)?

    // ── Persistence keys ──
    private let setsKey = "vflics.studio.sets"
    private let customDestKey = "vflics.studio.customDestinations"

    init() {
        loadDraft()
    }

    // MARK: Config

    func saveConfig(endpoint: String, token: String) {
        endpointURL = endpoint
        authToken = token
        KeychainStorage.write(endpoint, for: .endpointURL)
        KeychainStorage.write(token, for: .authToken)
    }

    // MARK: Sets

    var activeSet: UploadSet? {
        get { sets.first(where: { $0.id == activeSetId }) }
        set {
            if let newValue, let idx = sets.firstIndex(where: { $0.id == newValue.id }) {
                sets[idx] = newValue
                saveDraft()
            }
        }
    }

    func createSet() {
        let set = UploadSet(
            name: "",
            destinationSlug: destinations.first(where: { $0.folderId != nil })?.slug ?? ""
        )
        sets.append(set)
        activeSetId = set.id
        saveDraft()
    }

    func updateSet(_ id: UUID, _ patch: (inout UploadSet) -> Void) {
        guard let idx = sets.firstIndex(where: { $0.id == id }) else { return }
        patch(&sets[idx])
        saveDraft()
    }

    func removeSet(_ id: UUID) {
        sets.removeAll(where: { $0.id == id })
        if activeSetId == id { activeSetId = sets.first?.id }
        saveDraft()
    }

    // MARK: Files

    func appendFiles(_ files: [UploadFile], to setId: UUID) {
        updateSet(setId) { set in
            // Mark duplicates against existing hashes.
            let existing = Set(set.files.map(\.hash))
            for var f in files {
                if existing.contains(f.hash) { f.duplicate = true }
                set.files.append(f)
            }
        }
    }

    func deleteFiles(_ ids: Set<UUID>, in setId: UUID) {
        updateSet(setId) { $0.files.removeAll { ids.contains($0.id) } }
    }

    func moveFiles(_ from: IndexSet, to offset: Int, in setId: UUID) {
        updateSet(setId) { $0.files.move(fromOffsets: from, toOffset: offset) }
    }

    // MARK: Destinations

    func addCustomDestination(label: String, folderId: String) -> Destination? {
        let slug = label
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        guard !slug.isEmpty, !destinations.contains(where: { $0.slug == slug }) else { return nil }
        let d = Destination(slug: slug, label: label, folderId: folderId, custom: true)
        destinations.append(d)
        saveCustomDestinations()
        return d
    }

    func removeDestination(_ slug: String) {
        destinations.removeAll { $0.slug == slug }
        // Detach any sets referencing it.
        for i in sets.indices where sets[i].destinationSlug == slug {
            sets[i].destinationSlug = ""
        }
        saveCustomDestinations()
        saveDraft()
    }

    func applyServerDestinations(_ server: [ServerDestination]) {
        // Update built-in destinations with server-resolved folderIds.
        // Keep custom destinations untouched.
        let serverMap = Dictionary(uniqueKeysWithValues: server.map { ($0.slug, $0.folderId) })
        destinations = destinations.map { dest in
            var d = dest
            if !d.custom, let folder = serverMap[d.slug] {
                d.folderId = folder
            }
            return d
        }
    }

    // MARK: Push

    var canPush: Bool {
        !sets.isEmpty && sets.allSatisfy { s in
            !s.name.trimmingCharacters(in: .whitespaces).isEmpty &&
            !s.destinationSlug.isEmpty &&
            !s.files.isEmpty &&
            !s.files.contains(where: \.isMissing)
        }
    }

    var pushBlockers: [String] {
        var issues: [String] = []
        for s in sets {
            let label = s.name.isEmpty ? "(unnamed)" : s.name
            if s.name.trimmingCharacters(in: .whitespaces).isEmpty { issues.append("Set \"\(label)\" needs a name") }
            if s.destinationSlug.isEmpty { issues.append("\"\(label)\" needs a destination") }
            if s.files.isEmpty { issues.append("\"\(label)\" has no photos") }
            if s.files.contains(where: \.isMissing) { issues.append("\"\(label)\" has photos to re-attach") }
            if s.files.contains(where: \.duplicate) { issues.append("\"\(label)\" contains duplicates") }
        }
        return issues
    }

    func push() async {
        guard let client = UploadClient(endpointString: endpointURL, token: authToken) else {
            pushError = "Endpoint or token missing — open Settings."
            return
        }
        pushing = true
        pushError = nil
        defer { pushing = false }

        for (i, set) in sets.enumerated() {
            pushProgress = (setIdx: i, total: sets.count)
            let dest = destinations.first(where: { $0.slug == set.destinationSlug })
            do {
                _ = try await client.uploadSet(
                    setName: set.name,
                    destinationSlug: dest?.custom == false ? dest?.slug : nil,
                    folderId: dest?.custom == true ? dest?.folderId : nil,
                    files: set.files
                )
            } catch {
                pushError = error.localizedDescription
                return
            }
        }

        pushedOk = true
        try? await Task.sleep(nanoseconds: 2_200_000_000)
        sets.removeAll()
        activeSetId = nil
        pushedOk = false
        pushProgress = nil
        saveDraft()
    }

    // MARK: Persistence

    private func saveDraft() {
        // Persist metadata only; image data stays in memory.
        var stripped = sets
        for i in stripped.indices {
            for j in stripped[i].files.indices {
                stripped[i].files[j].imageData = nil
            }
        }
        if let data = try? JSONEncoder().encode(stripped) {
            UserDefaults.standard.set(data, forKey: setsKey)
        }
    }

    private func saveCustomDestinations() {
        let custom = destinations.filter(\.custom)
        if let data = try? JSONEncoder().encode(custom) {
            UserDefaults.standard.set(data, forKey: customDestKey)
        }
    }

    private func loadDraft() {
        if let data = UserDefaults.standard.data(forKey: setsKey),
           let decoded = try? JSONDecoder().decode([UploadSet].self, from: data) {
            sets = decoded
            activeSetId = decoded.first?.id
        }
        if let data = UserDefaults.standard.data(forKey: customDestKey),
           let decoded = try? JSONDecoder().decode([Destination].self, from: data) {
            destinations.append(contentsOf: decoded)
        }
    }
}
