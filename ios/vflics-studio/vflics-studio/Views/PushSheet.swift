import SwiftUI

struct PushSheet: View {
    @Environment(Store.self) private var store
    @Binding var visible: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.bg.ignoresSafeArea()
                if store.pushedOk {
                    success
                } else if store.pushing {
                    uploading
                } else {
                    confirm
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !store.pushing {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { visible = false }
                    }
                }
            }
        }
    }

    private var confirm: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Cap(text: "Confirm push · \(store.sets.count) set\(store.sets.count == 1 ? "" : "s")")
                Text("Ready to push?")
                    .font(Theme.Fonts.displayFallback(36))
                    .foregroundStyle(Theme.Colors.fg)
                Text("Each set's photos will be renamed and uploaded to its destination's Drive folder.")
                    .font(.system(size: 14, design: .serif).italic())
                    .foregroundStyle(Theme.Colors.fgDim)

                if !store.pushBlockers.isEmpty || store.pushError != nil {
                    VStack(alignment: .leading, spacing: 8) {
                        Cap(text: store.pushError != nil ? "Upload failed" : "Resolve before pushing",
                            color: Theme.Colors.danger)
                        ForEach(Array((store.pushError.map { [$0] } ?? store.pushBlockers).enumerated()), id: \.offset) { _, blocker in
                            Text("· \(blocker)")
                                .font(Theme.Fonts.mono(11))
                                .foregroundStyle(Theme.Colors.danger)
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(
                        Rectangle().stroke(Theme.Colors.danger.opacity(0.4), lineWidth: 1)
                    )
                }

                HairlineRule().padding(.top, 8)

                ForEach(store.sets) { set in
                    let dest = store.destinations.first(where: { $0.slug == set.destinationSlug })
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(set.name.isEmpty ? "(unnamed)" : set.name)
                                .font(Theme.Fonts.displayFallback(20))
                                .foregroundStyle(set.name.isEmpty ? Theme.Colors.danger : Theme.Colors.fg)
                            Spacer()
                            Cap(text: "→ \(dest?.label ?? "unassigned") · \(set.files.count) pl.")
                        }
                        if !set.files.isEmpty {
                            Cap(text: "\(set.name.isEmpty ? "(name)" : set.name) (1) … (\(set.files.count))",
                                color: Theme.Colors.fgDim)
                        }
                        HairlineRule()
                    }
                }

                Pill(title: "Push to Drive →", kind: .primary, disabled: !store.canPush) {
                    Task { await store.push() }
                }
                .padding(.top, 16)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
    }

    private var uploading: some View {
        VStack(spacing: 18) {
            Cap(text: "Uploading…")
            if let progress = store.pushProgress {
                Cap(text: "Set \(progress.setIdx + 1) of \(progress.total)", color: Theme.Colors.fgDim)
            }
            ProgressView()
                .tint(Theme.Colors.fg)
        }
    }

    private var success: some View {
        VStack(spacing: 18) {
            Cap(text: "Pushed", color: Theme.Colors.success)
            Text("All sets are on their way.")
                .font(Theme.Fonts.displayFallback(36))
                .foregroundStyle(Theme.Colors.fg)
                .multilineTextAlignment(.center)
            Text("The studio will reset in a moment.")
                .font(.system(size: 15, design: .serif).italic())
                .foregroundStyle(Theme.Colors.fgDim)
        }
        .padding()
    }
}
