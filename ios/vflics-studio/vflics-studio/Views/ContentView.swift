import SwiftUI

struct ContentView: View {
    @Environment(Store.self) private var store
    @State private var showingSettings = false

    var body: some View {
        // Read stored properties directly so @Observable tracks them.
        let configured = !store.endpointURL.isEmpty && !store.authToken.isEmpty
        ZStack {
            Theme.Colors.bg.ignoresSafeArea()
            if configured {
                MainView(showSettings: { showingSettings = true })
            } else {
                SettingsSheet(initial: true) {
                    Task { await fetchDestinations() }
                }
            }
        }
        .sheet(isPresented: $showingSettings) {
            SettingsSheet(initial: false) {
                Task { await fetchDestinations() }
            }
        }
        .task {
            await fetchDestinations()
        }
    }

    private func fetchDestinations() async {
        guard let client = UploadClient(endpointString: store.endpointURL, token: store.authToken) else { return }
        if let server = try? await client.fetchDestinations() {
            store.applyServerDestinations(server)
        }
    }
}

private struct MainView: View {
    @Environment(Store.self) private var store
    let showSettings: () -> Void
    @State private var pushSheetVisible = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                TopBar(showSettings: showSettings, onPush: { pushSheetVisible = true })
                HairlineRule()
                if store.sets.isEmpty {
                    EmptyState()
                } else {
                    SetsList()
                }
            }
            .background(Theme.Colors.bg)
        }
        .sheet(isPresented: $pushSheetVisible) {
            PushSheet(visible: $pushSheetVisible)
        }
    }
}

private struct TopBar: View {
    @Environment(Store.self) private var store
    let showSettings: () -> Void
    let onPush: () -> Void

    var totalPhotos: Int { store.sets.reduce(0) { $0 + $1.files.count } }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("vflics")
                    .font(Theme.Fonts.displayFallback(22))
                    .foregroundStyle(Theme.Colors.fg)
                Cap(text: "Upload Studio · \(store.sets.count) set\(store.sets.count == 1 ? "" : "s") · \(totalPhotos) photos")
            }
            Spacer()
            Button(action: showSettings) {
                Image(systemName: "gearshape")
                    .foregroundStyle(Theme.Colors.fgDim)
                    .font(.system(size: 18))
            }
            .padding(.trailing, 8)
            Pill(title: "Push", icon: "→", kind: .primary, disabled: !store.canPush, action: onPush)
                .frame(width: 110)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}

private struct EmptyState: View {
    @Environment(Store.self) private var store

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Cap(text: "Start here")
            Text("Create a set.")
                .font(Theme.Fonts.displayFallback(48))
                .foregroundStyle(Theme.Colors.fg)
                .multilineTextAlignment(.center)
            Text("A set is a group of photos with one destination — like \u{201C}VDR Party\u{201D} headed for Editorial. Add as many sets as you want before pushing.")
                .font(.system(size: 16, design: .serif).italic())
                .foregroundStyle(Theme.Colors.fgDim)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Pill(title: "+ New set", kind: .primary) { store.createSet() }
                .frame(width: 160)
            Spacer()
        }
    }
}
