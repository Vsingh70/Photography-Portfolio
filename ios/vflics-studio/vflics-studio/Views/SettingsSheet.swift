import SwiftUI

struct SettingsSheet: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss
    let initial: Bool
    let onSaved: () -> Void

    @State private var endpoint: String = ""
    @State private var token: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("https://your-site.vercel.app/api/studio/upload-remote", text: $endpoint)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    SecureField("Bearer token", text: $token)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } header: {
                    Text("Vercel endpoint")
                } footer: {
                    Text("Set STUDIO_UPLOAD_TOKEN in your Vercel project env vars to the same value as this token.")
                        .font(.caption)
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
                    Button("Save") {
                        store.saveConfig(endpoint: endpoint.trimmingCharacters(in: .whitespaces),
                                         token: token.trimmingCharacters(in: .whitespaces))
                        onSaved()
                        if !initial { dismiss() }
                    }
                    .disabled(endpoint.trimmingCharacters(in: .whitespaces).isEmpty ||
                              token.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                endpoint = store.endpointURL
                token = store.authToken
            }
        }
    }
}
