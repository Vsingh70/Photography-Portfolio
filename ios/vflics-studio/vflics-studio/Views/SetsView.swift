import SwiftUI

struct SetsList: View {
    @Environment(Store.self) private var store
    @State private var navigateTo: UUID?

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(store.sets) { set in
                    NavigationLink(value: set.id) {
                        SetRow(set: set)
                    }
                    .buttonStyle(.plain)
                    HairlineRule()
                }
                Button {
                    store.createSet()
                } label: {
                    HStack {
                        Spacer()
                        Cap(text: "+ New set", color: Theme.Colors.fg, size: 11)
                        Spacer()
                    }
                    .padding(.vertical, 18)
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
            }
        }
        .navigationDestination(for: UUID.self) { id in
            SetEditorView(setId: id)
        }
    }
}

private struct SetRow: View {
    @Environment(Store.self) private var store
    let set: UploadSet

    var destination: Destination? {
        store.destinations.first(where: { $0.slug == set.destinationSlug })
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(set.name.isEmpty ? "Untitled set" : set.name)
                    .font(Theme.Fonts.displayFallback(22))
                    .foregroundStyle(set.name.isEmpty ? Theme.Colors.fgDim : Theme.Colors.fg)
                Cap(text: destination?.label ?? "— unassigned —")
            }
            Spacer()
            Cap(text: "\(set.files.count) pl.")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
    }
}
