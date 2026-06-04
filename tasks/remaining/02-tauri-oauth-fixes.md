# Task 02 — Tauri OAuth: fix whatever surfaced in task 01

**Depends on**: 01
**Blocks**: 03 (only if a fix here changes the OAuth-flow shape that iOS will mirror)
**Estimated effort**: 30 min – 4 hours depending on what broke

## When to use this task

Open this file only if task 01 surfaced bugs. If everything in task 01 passed, skip directly to task 03.

## Known failure modes and their fixes

These are the issues that have a high prior probability of surfacing given the architecture. Each is independent — fix only the ones you actually hit.

### Failure A: "Sign in with Google" pill does nothing in the desktop app

**Symptom**: Click the pill, browser never opens, no error.

**Likely cause**: The `open` shim in `app/src-tauri/src/oauth.rs` uses `std::process::Command` with `open` on macOS. If the binary is sandboxed (release builds sometimes are), the subprocess spawn fails silently.

**Fix**: Replace the `open` shim with `tauri-plugin-opener`'s `OpenerExt::open_url`:

```rust
// In oauth.rs, replace the open::that(&auth_url) call with:
use tauri_plugin_opener::OpenerExt;

// pass `app: tauri::AppHandle` into start_oauth and call:
app.opener().open_url(&auth_url, None::<&str>)?;
```

This requires changing `start_oauth`'s signature to take `app: tauri::AppHandle` and updating `main.rs`'s `invoke_handler!` macro to use `.app_handle()` injection — Tauri handles this automatically when the first arg is `AppHandle`.

### Failure B: Browser opens but redirect URL shows "redirect_uri_mismatch"

**Symptom**: Google shows a red error page: "Error 400: redirect_uri_mismatch".

**Likely cause**: The Desktop OAuth client ID in Google Cloud Console doesn't have `http://127.0.0.1:8765/callback` in its allowed redirect URIs. For **Desktop app** OAuth clients, Google typically allows any loopback URL without explicit registration — but sometimes the project has the client misconfigured as "Web application" instead.

**Fix**:

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Click the Desktop OAuth client ID (`545350887333-cicbneumq1aud1qej9la8c465nmi16oj…`)
3. Verify **Application type** is **Desktop app**, not Web application
4. If it's Web application: create a new Desktop app client, copy the new ID into `app/src-tauri/src/oauth.rs` `CLIENT_ID` constant, rebuild

Desktop-app OAuth clients accept any `http://127.0.0.1:*/...` redirect URI without explicit listing.

### Failure C: Loopback listener fails to bind port 8765

**Symptom**: Console shows `failed to bind localhost listener: Address already in use`.

**Likely cause**: Another process is using port 8765 (rare but possible).

**Fix**: Make the port configurable. In `oauth.rs`, change the bind logic to try a range:

```rust
let mut port_used = 0;
let server = (8765..8800)
    .find_map(|p| {
        let s = tiny_http::Server::http(format!("127.0.0.1:{p}")).ok()?;
        port_used = p;
        Some(s)
    })
    .ok_or("could not find an open port between 8765 and 8800")?;

let redirect = format!("http://127.0.0.1:{port_used}/callback");
// Use `redirect` instead of REDIRECT_URI const in the auth_url build AND
// in the token exchange request.
```

### Failure D: Token exchange returns 401 invalid_client

**Symptom**: After the browser redirect succeeds, the in-app sign-in still fails with "token exchange HTTP error: 401" or similar.

**Likely cause**: Google's Desktop OAuth flow does require a `client_secret`, contrary to what I assumed. Google did remove this requirement for Desktop clients created in 2024+ but older clients still need it.

**Fix**: Add the client secret to `oauth.rs`. Get it from Google Cloud Console → Credentials → Desktop client → "Show client secret" → copy. Set:

```rust
const CLIENT_SECRET: &str = "GOCSPX-..."; // paste here
```

This secret is technically not secret for desktop OAuth (Google's own docs say so), so it can be committed — but if you'd rather keep it out of git, refactor to read from an env var at build time via `option_env!("VFLICS_OAUTH_SECRET").unwrap_or("")`.

### Failure E: Upload to Drive returns 403 insufficient permissions

**Symptom**: Sign-in works, but Push fails with "upload HTTP 403: insufficient authentication scopes" or "The user has not granted the app … access to the file".

**Likely cause**: With `drive.file` scope, the app can only see/edit files **it creates**, AND it can only upload into folders that have been explicitly granted via Drive Picker — OR into folders the signed-in user owns. If the destination folder was originally created by a **different** Google account (the service-account, or an org account), `drive.file` can't write to it.

**Fix options**, in order of preference:

1. **Easiest**: Ensure the signed-in account is the *owner* of each destination folder. Open each folder in Drive (https://drive.google.com/), right-click → "Move to" → confirm it's in *your* My Drive. If a folder is currently owned by someone else, take ownership or move/recreate.

2. **Broader scope**: Change `SCOPE` constant from `drive.file` to `drive` (full access). User-facing trade-off: the consent screen will say "See, edit, create, and delete all your Google Drive files" — broader than needed. Rebuild + sign out + sign in again to re-consent.

3. **Drive Picker** flow: more code; defer to task 05.

### Failure F: Refresh token is missing on subsequent runs

**Symptom**: After signing in once, restarting the app shows "Sign in with Google" again instead of the cached email.

**Likely causes** (mutually exclusive):

a) Google did not include a refresh_token in the response. This happens when the user has previously consented and Google declines to re-issue one. **Fix**: ensure `prompt=consent` is in the auth URL (it already is in the code at `7043e5e`). If still missing, the user must revoke access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and sign in fresh.

b) `tokens.json` isn't being written. **Verify** by running:

```bash
cat ~/Library/Application\ Support/vflics-studio/tokens.json
```

If file is missing, check the `save_tokens` error path in `oauth.rs`. Maybe permissions on `~/Library/Application Support/` aren't writable — unusual but possible.

### Failure G: Drag photos from Finder doesn't trigger the drop handler

**Symptom**: Dragging a photo onto the window does nothing.

**Likely cause**: `dragDropEnabled: false` in `tauri.conf.json` is supposed to route to the webview, but on Tauri 2.x there's a known quirk where the new build doesn't honor it unless you've rebuilt with the *correct* config.

**Verify**: Check that the `.app` you're running was actually built with the config from `tauri.conf.local.json` (which inherits from `tauri.conf.json`'s `dragDropEnabled: false`):

```bash
plutil -p "/Applications/vflics Studio.app/Contents/Info.plist" | grep -i drop
# Should NOT find any drag-drop entries (that's a sign Tauri intercepted at OS level)
```

If still broken, set `dragDropEnabled: true` in `tauri.conf.json` (yes, the opposite of intuition — Tauri 2's docs are ambiguous about which value routes to webview). Rebuild.

### Failure H: drag-to-reorder doesn't fire on the desktop

**Symptom**: Long-press + drag a thumbnail, nothing happens, no reorder.

**Likely cause**: same Tauri intercept issue as G. Same fix applies.

If still broken after flipping `dragDropEnabled`, switch the StudioApp's reorder code to use `react-dnd` or a similar library that uses pointer events rather than HTML5 dragstart/dragover events. This is a bigger refactor; only do if A and B failed.

## Generic debugging tips

Tauri release builds **strip console output**. To debug, temporarily set `[profile.release]` `strip = false` in `Cargo.toml`, rebuild, then run the binary directly from the terminal:

```bash
"/Applications/vflics Studio.app/Contents/MacOS/vflics-studio"
```

This shows `eprintln!` / `println!` output and Rust panic messages. Remove the temporary changes once debugging is done.

## What to do after fixing

- Commit + push the fix(es)
- Re-run task 01's acceptance criteria
- Move on to task 03
