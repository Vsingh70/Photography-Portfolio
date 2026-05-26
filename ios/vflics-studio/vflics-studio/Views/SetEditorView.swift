import SwiftUI
import PhotosUI

struct SetEditorView: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss
    let setId: UUID

    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var selection: Set<UUID> = []
    @State private var editing: Bool = false
    @State private var showingDeleteConfirm: Bool = false

    var set: UploadSet? {
        store.sets.first(where: { $0.id == setId })
    }

    var body: some View {
        Group {
            if let set = set {
                content(for: set)
            } else {
                EmptyView()
            }
        }
        .background(Theme.Colors.bg)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Cap(text: "Edit set")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button(role: .destructive) {
                    showingDeleteConfirm = true
                } label: {
                    Image(systemName: "trash")
                        .foregroundStyle(Theme.Colors.danger)
                }
            }
        }
        .confirmationDialog("Delete set?", isPresented: $showingDeleteConfirm) {
            Button("Delete", role: .destructive) {
                store.removeSet(setId)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    @ViewBuilder
    private func content(for set: UploadSet) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                nameField(set: set)
                destinationSection(set: set)
                toolbar(set: set)
                if set.files.isEmpty {
                    emptyDropZone
                } else {
                    grid(set: set)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 18)
        }
    }

    private func nameField(set: UploadSet) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Cap(text: "Set name")
            TextField("e.g. VDR Party", text: Binding(
                get: { set.name },
                set: { newValue in
                    store.updateSet(setId) { $0.name = newValue }
                }
            ))
            .font(Theme.Fonts.displayFallback(32))
            .foregroundStyle(Theme.Colors.fg)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(Theme.Colors.fg.opacity(0.18))
                    .frame(height: 1)
                    .offset(y: 6)
            }
            .padding(.bottom, 6)
            if !set.name.isEmpty {
                Cap(text: "Renamed: \(set.name) (1) → \(set.name) (\(set.files.count == 0 ? "n" : String(set.files.count)))")
            }
        }
    }

    private func destinationSection(set: UploadSet) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Cap(text: "Destination")
            DestinationPickerView(selected: set.destinationSlug) { slug in
                store.updateSet(setId) { $0.destinationSlug = slug }
            }
        }
    }

    private func toolbar(set: UploadSet) -> some View {
        HStack(spacing: 10) {
            PhotosPicker(
                selection: $pickerItems,
                maxSelectionCount: 0,    // unlimited
                matching: .images
            ) {
                HStack(spacing: 6) {
                    Text("+ ADD PHOTOS")
                        .font(Theme.Fonts.mono(10))
                        .tracking(2.2)
                        .foregroundStyle(Theme.Colors.fg)
                }
                .padding(.horizontal, 16).padding(.vertical, 8)
                .overlay(Capsule().stroke(Theme.Colors.fg.opacity(0.25), lineWidth: 1))
                .clipShape(Capsule())
            }
            if !selection.isEmpty {
                Pill(title: "Delete \(selection.count)", kind: .danger) {
                    store.deleteFiles(selection, in: setId)
                    selection.removeAll()
                }
            }
            Spacer()
            Cap(text: "\(set.files.count) photo\(set.files.count == 1 ? "" : "s")")
        }
        .onChange(of: pickerItems) { _, newItems in
            Task { await loadPickedItems(newItems) }
        }
    }

    private var emptyDropZone: some View {
        VStack(spacing: 12) {
            Text("Tap + Add photos")
                .font(Theme.Fonts.displayFallback(28))
                .foregroundStyle(Theme.Colors.fg)
            Cap(text: "to start staging")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
        .overlay(
            Rectangle()
                .strokeBorder(Theme.Colors.fg.opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
        )
    }

    private func grid(set: UploadSet) -> some View {
        LazyVGrid(columns: [
            GridItem(.adaptive(minimum: 100), spacing: 8)
        ], spacing: 8) {
            ForEach(Array(set.files.enumerated()), id: \.element.id) { (idx, file) in
                ThumbView(
                    file: file,
                    index: idx,
                    setName: set.name,
                    selected: selection.contains(file.id),
                    onTap: {
                        if selection.contains(file.id) {
                            selection.remove(file.id)
                        } else {
                            selection.insert(file.id)
                        }
                    }
                )
            }
        }
    }

    /// Load each PhotosPicker item to an in-memory blob, hash it, and append.
    private func loadPickedItems(_ items: [PhotosPickerItem]) async {
        var newFiles: [UploadFile] = []
        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
            let hashHex = sha256Hex(data)
            let filename = (item.itemIdentifier ?? UUID().uuidString) + ".jpg"
            newFiles.append(UploadFile(
                id: UUID(),
                name: filename,
                size: data.count,
                hash: hashHex,
                duplicate: false,
                imageData: data
            ))
        }
        if !newFiles.isEmpty {
            store.appendFiles(newFiles, to: setId)
        }
        pickerItems.removeAll()
    }
}

import CryptoKit

func sha256Hex(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}
