import SwiftUI

/// Horizontal flow of destination chips. Tap to select. Long-press a custom
/// destination to delete. The "+" chip pops up a sheet to add a new custom
/// destination by label + folder ID.
struct DestinationPickerView: View {
    @Environment(Store.self) private var store
    let selected: String
    let onSelect: (String) -> Void

    @State private var addingNew: Bool = false
    @State private var newLabel: String = ""
    @State private var newFolderId: String = ""

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(store.destinations) { dest in
                    DestChip(dest: dest, isSelected: dest.slug == selected) {
                        guard dest.folderId != nil else { return }
                        onSelect(dest.slug)
                    } onDelete: {
                        if dest.custom { store.removeDestination(dest.slug) }
                    }
                }
                Button {
                    addingNew = true
                } label: {
                    Text("+ NEW")
                        .font(Theme.Fonts.mono(10))
                        .tracking(2.2)
                        .foregroundStyle(Theme.Colors.fgDim)
                        .padding(.horizontal, 14).padding(.vertical, 6)
                        .overlay(
                            Capsule().strokeBorder(Theme.Colors.fg.opacity(0.35),
                                                   style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        )
                }
            }
        }
        .sheet(isPresented: $addingNew) {
            NewDestinationSheet(label: $newLabel, folderId: $newFolderId) {
                if let dest = store.addCustomDestination(label: newLabel, folderId: newFolderId) {
                    onSelect(dest.slug)
                }
                newLabel = ""
                newFolderId = ""
                addingNew = false
            } onCancel: {
                newLabel = ""
                newFolderId = ""
                addingNew = false
            }
        }
    }
}

private struct DestChip: View {
    let dest: Destination
    let isSelected: Bool
    let onTap: () -> Void
    let onDelete: () -> Void

    var enabled: Bool { dest.folderId != nil }

    var body: some View {
        Button(action: onTap) {
            Text(dest.label.uppercased())
                .font(Theme.Fonts.mono(10))
                .tracking(2.2)
                .foregroundStyle(isSelected ? Theme.Colors.bg : (enabled ? Theme.Colors.fg : Theme.Colors.fgDim))
                .padding(.horizontal, 14).padding(.vertical, 6)
                .background(isSelected ? Theme.Colors.fg : .clear)
                .overlay(
                    Capsule().stroke(
                        isSelected ? Theme.Colors.fg : Theme.Colors.fg.opacity(0.18),
                        lineWidth: 1
                    )
                )
                .clipShape(Capsule())
                .opacity(enabled ? 1 : 0.4)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .contextMenu {
            if dest.custom {
                Button("Delete", role: .destructive, action: onDelete)
            }
        }
    }
}

private struct NewDestinationSheet: View {
    @Binding var label: String
    @Binding var folderId: String
    let onAdd: () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Label (e.g. Wedding)", text: $label)
                    TextField("Drive folder ID", text: $folderId)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } footer: {
                    Text("Find the folder ID in the Drive URL after `/folders/`. The service account must have Editor access to this folder.")
                        .font(.caption)
                }
            }
            .navigationTitle("New destination")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add", action: onAdd)
                        .disabled(label.trimmingCharacters(in: .whitespaces).isEmpty ||
                                  folderId.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
