import Foundation
import SwiftUI
import Observation

/// Single source of truth for the Studio. Mirrors the React `useState`
/// cluster in StudioApp.tsx: sets list, active set selection, destinations,
/// push state. Auth state is OAuth-only — see Config + KeychainStorage.
@Observable
final class Store {
    // ── OAuth state (read from keychain at init) ──
    var oauthAccessToken: String = KeychainStorage.read(.oauthAccessToken) ?? ""
    var oauthRefreshToken: String = KeychainStorage.read(.oauthRefreshToken) ?? ""
    var oauthEmail: String = KeychainStorage.read(.oauthEmail) ?? ""
    var oauthExpiresAt: Date = {
        if let raw = KeychainStorage.read(.oauthExpiresAt), let n = Double(raw) {
            return Date(timeIntervalSince1970: n)
        }
        return Date.distantPast
    }()

    var isSignedIn: Bool { !oauthAccessToken.isEmpty && !oauthRefreshToken.isEmpty }

    // ── Data ──
    var sets: [UploadSet] = []
    var activeSetId: UUID?
    var destinations: [Destination] = Destination.defaults

    // ── Push state ──
    var pushing: Bool = false
    var pushedOk: Bool = false
    var pushError: String?
    /// (current set index, total sets, current file in set, total files in set).
    var pushProgress: (setIdx: Int, setTotal: Int, fileIdx: Int, fileTotal: Int)?

    // ── Persistence keys ──
    private let setsKey = "vflics.studio.sets"
    private let customDestKey = "vflics.studio.customDestinations"

    init() {
        // Sweep any pre-OAuth keychain entries from older builds.
        KeychainStorage.cleanLegacyKeys()
        loadDraft()
    }

    // MARK: OAuth tokens

    func saveTokens(access: String, refresh: String, expiresAt: Date, email: String) {
        oauthAccessToken = access
        oauthRefreshToken = refresh
        oauthExpiresAt = expiresAt
        oauthEmail = email
        KeychainStorage.write(access, for: .oauthAccessToken)
        KeychainStorage.write(refresh, for: .oauthRefreshToken)
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

    /// Refresh if needed; returns a valid access token or throws.
    func validAccessToken() async throws -> String {
        if Date() < oauthExpiresAt, !oauthAccessToken.isEmpty {
            return oauthAccessToken
        }
        guard !oauthRefreshToken.isEmpty else {
            throw UploadError.notSignedIn
        }
        let oauth = await MainActor.run { GoogleOAuth() }
        let result = try await oauth.refresh(refreshToken: oauthRefreshToken)
        await MainActor.run {
            self.oauthAccessToken = result.accessToken
            self.oauthExpiresAt = result.expiresAt
            KeychainStorage.write(result.accessToken, for: .oauthAccessToken)
            KeychainStorage.write(String(result.expiresAt.timeIntervalSince1970), for: .oauthExpiresAt)
        }
        return result.accessToken
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

    /// Reorder for drag-and-drop: move one file to the position currently
    /// occupied by another. Used by the grid view's .draggable / .dropDestination.
    func moveFile(_ id: UUID, before targetId: UUID, in setId: UUID) {
        guard id != targetId else { return }
        updateSet(setId) { set in
            guard let from = set.files.firstIndex(where: { $0.id == id }),
                  let to = set.files.firstIndex(where: { $0.id == targetId }) else { return }
            let item = set.files.remove(at: from)
            let insertAt = to <= from ? to : to - 1
            set.files.insert(item, at: insertAt)
        }
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
        for i in sets.indices where sets[i].destinationSlug == slug {
            sets[i].destinationSlug = ""
        }
        saveCustomDestinations()
        saveDraft()
    }

    // MARK: Push

    var canPush: Bool {
        isSignedIn && !sets.isEmpty && sets.allSatisfy { s in
            !s.name.trimmingCharacters(in: .whitespaces).isEmpty &&
            !s.destinationSlug.isEmpty &&
            !s.files.isEmpty &&
            !s.files.contains(where: \.isMissing)
        }
    }

    var pushBlockers: [String] {
        var issues: [String] = []
        if !isSignedIn { issues.append("Sign in with Google in Settings") }
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
        pushing = true
        pushError = nil
        defer { pushing = false }

        guard isSignedIn else {
            pushError = UploadError.notSignedIn.errorDescription
            return
        }

        do {
            for (setIdx, set) in sets.enumerated() {
                let dest = destinations.first(where: { $0.slug == set.destinationSlug })
                guard let folderId = dest?.folderId else {
                    pushError = UploadError.missingFolderId(set.destinationSlug).errorDescription
                    return
                }

                // Upload each file individually (avoids serverless body limits;
                // we talk straight to Drive).
                for (fileIdx, file) in set.files.enumerated() {
                    pushProgress = (
                        setIdx: setIdx,
                        setTotal: sets.count,
                        fileIdx: fileIdx,
                        fileTotal: set.files.count
                    )
                    guard let imageData = file.imageData else {
                        throw UploadError.fileNotAttached(file.name)
                    }
                    let renamedName = renameForUpload(setName: set.name, index: fileIdx, originalName: file.name)
                    let token = try await validAccessToken()
                    _ = try await UploadClient.uploadFile(
                        accessToken: token,
                        folderId: folderId,
                        filename: renamedName,
                        bytes: imageData,
                        mimeType: "image/jpeg"
                    )
                }
            }

            pushedOk = true
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            sets.removeAll()
            activeSetId = nil
            pushedOk = false
            pushProgress = nil
            saveDraft()
        } catch {
            pushError = error.localizedDescription
        }
    }

    private func renameForUpload(setName: String, index: Int, originalName: String) -> String {
        let ext: String = {
            let ns = originalName as NSString
            let pathExt = ns.pathExtension
            return pathExt.isEmpty ? "jpg" : pathExt.lowercased()
        }()
        return "\(setName) (\(index + 1)).\(ext)"
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
