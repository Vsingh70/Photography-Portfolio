import SwiftUI

struct SettingsSheet: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss
    let initial: Bool
    let onSaved: () -> Void

    @State private var signingIn = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                if store.isSignedIn {
                    signedInSection
                } else {
                    signInSection
                }

                Section {
                    Cap(text: "Service", color: Theme.Colors.fgDim)
                    Text("Google Drive (direct upload, drive.file scope)")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Theme.Colors.fgDim)
                } header: {
                    Text("How it works")
                } footer: {
                    Text("Photos upload straight from your phone to Drive via your Google account. No third-party servers involved.")
                        .font(.caption)
                }
            }
            .navigationTitle(initial ? "Welcome" : "Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !initial && store.isSignedIn {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { dismiss() }
                    }
                }
            }
            .alert("Sign-in failed",
                   isPresented: Binding(
                       get: { errorMessage != nil },
                       set: { newValue in if !newValue { errorMessage = nil } }
                   )) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private var signInSection: some View {
        Section {
            Button(action: signIn) {
                HStack {
                    Spacer()
                    if signingIn {
                        ProgressView().padding(.trailing, 6)
                    }
                    Text(signingIn ? "Signing in…" : "Sign in with Google")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Spacer()
                }
                .padding(.vertical, 6)
            }
            .listRowBackground(Color.accentColor)
            .disabled(signingIn)
        } header: {
            Text("Sign in")
        } footer: {
            Text("Authorizes the app to upload files to your Google Drive (no read access to existing files).")
                .font(.caption)
        }
    }

    private var signedInSection: some View {
        Section {
            HStack {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(Theme.Colors.success)
                VStack(alignment: .leading, spacing: 2) {
                    Text(store.oauthEmail)
                        .font(.system(size: 14))
                    Cap(text: "Signed in", color: Theme.Colors.fgDim)
                }
                Spacer()
            }

            Button(role: .destructive, action: signOut) {
                Text("Sign out")
            }
        } header: {
            Text("Account")
        }
    }

    private func signIn() {
        Task { @MainActor in
            signingIn = true
            defer { signingIn = false }
            do {
                let oauth = GoogleOAuth()
                let result = try await oauth.signIn()
                store.saveTokens(
                    access: result.accessToken,
                    refresh: result.refreshToken,
                    expiresAt: result.expiresAt,
                    email: result.email
                )
                onSaved()
                if !initial { dismiss() }
            } catch let error as GoogleOAuthError {
                errorMessage = error.errorDescription ?? "Sign-in failed."
            } catch let error as NSError {
                // ASWebAuthenticationSession user-cancellation: silent.
                if error.domain == "com.apple.AuthenticationServices.WebAuthenticationSession",
                   error.code == 1 /* canceledLogin */ {
                    return
                }
                errorMessage = error.localizedDescription
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func signOut() {
        store.signOut()
        if !initial { dismiss() }
    }
}
