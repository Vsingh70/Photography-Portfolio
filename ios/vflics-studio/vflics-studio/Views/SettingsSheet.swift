import SwiftUI

struct SettingsSheet: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss
    let initial: Bool
    let onSaved: () -> Void

    @State private var token: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Bearer token", text: $token)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .submitLabel(.done)
                        .onSubmit(save)
                } header: {
                    Text("Auth token")
                } footer: {
                    Text("Paste the STUDIO_UPLOAD_TOKEN from your Vercel project env vars. Stored in iOS Keychain; you only enter this once.")
                        .font(.caption)
                }

                Section {
                    Cap(text: "Endpoint", color: Theme.Colors.fgDim)
                    Text(Config.endpointURL)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Theme.Colors.fgDim)
                        .textSelection(.enabled)
                } header: {
                    Text("Server")
                }

                Section {
                    Button(action: save) {
                        HStack {
                            Spacer()
                            Text("Save")
                                .font(.headline)
                                .foregroundStyle(.white)
                            Spacer()
                        }
                        .padding(.vertical, 4)
                    }
                    .listRowBackground(Color.accentColor)
                }
            }
            .navigationTitle(initial ? "Welcome" : "Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !initial {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save)
                }
            }
            .onAppear {
                token = store.authToken
            }
        }
    }

    private func save() {
        let clean = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        store.saveToken(clean)
        onSaved()
        dismiss()
    }
}
