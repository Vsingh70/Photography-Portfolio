# Task 01 — Tauri OAuth: rebuild, install, verify end-to-end

**Blocks**: 02, 03, 04
**Estimated effort**: 30–60 min (mostly a 10–15 min Rust release build + interactive verification)
**Risk**: Highest of any remaining task — the OAuth scaffolding has never run.

## Background

Commits `a9ecddb` (drag-drop fix) and `7043e5e` (OAuth scaffolding) added all the code needed for the Tauri desktop app to:

1. Drag files from Finder into the destination set
2. Drag thumbnails within the grid to reorder
3. Sign in to Google via loopback OAuth on `127.0.0.1:8765`
4. Upload each photo directly to Drive (no Vercel hop, no 4.5MB body limit)

**Nothing is testable until the `.app` is rebuilt**, because the existing installed binary in `/Applications` was compiled before any of this code existed.

## Files involved

- `app/src-tauri/src/oauth.rs` — Rust OAuth + upload commands
- `app/src-tauri/src/main.rs` — registers the commands with Tauri's invoke handler
- `app/src-tauri/Cargo.toml` — new deps (reqwest, tokio, tiny_http, etc.)
- `app/src-tauri/tauri.conf.json` — `dragDropEnabled: false`
- `app/src/lib/tauri-oauth.ts` — JS wrapper for the Rust commands
- `app/src/app/studio/StudioApp.tsx` — sign-in UI in TopBar; `performPush` branches on `inTauri && oauthEmail`

## Execution steps

### 1. Re-create the local Tauri config

```bash
cd app
cp src-tauri/tauri.conf.json src-tauri/tauri.conf.local.json
```

Open `src-tauri/tauri.conf.local.json` in your editor and replace **both** occurrences of `REPLACE_WITH_STUDIO_UPLOAD_TOKEN` with the value of the `STUDIO_UPLOAD_TOKEN` env var as currently set on Vercel.

(This file is gitignored, never committed.)

### 2. Build the new `.app`

```bash
npm run tauri:build
```

First build is slow (~10–15 min): all the new Rust crates download + compile in release mode. Subsequent builds are ~30–60 seconds.

Verify the build emitted both:

- `src-tauri/target/release/bundle/macos/vflics Studio.app`
- `src-tauri/target/release/bundle/dmg/vflics Studio_0.1.0_aarch64.dmg`

### 3. Install

1. Delete the existing `/Applications/vflics Studio.app` (drag to Trash)
2. Drag the freshly-built `.app` from `src-tauri/target/release/bundle/macos/` into `/Applications`
3. First launch: right-click → Open → confirm Gatekeeper bypass (only needed once because the app isn't notarized)

### 4. Verify drag-drop

Open the app. Create a set. Then:

- ✅ Test A: drag a couple of photos from Finder onto the destination — they should appear as thumbnails in the grid
- ✅ Test B: long-press a thumbnail and drag onto another thumbnail — the dragged one should slot in at the target position

If either fails, see task 02.

### 5. Verify OAuth sign-in

In the top bar, click **"Sign in with Google"**.

Expected sequence:

1. A browser tab opens to `accounts.google.com` with the consent screen showing scopes `drive.file` and `userinfo.email`
2. You sign in with the Google account that owns the destination Drive folders
3. You approve the scopes
4. Browser redirects to `http://127.0.0.1:8765/callback?code=…` and shows a small confirmation page ("vflics Studio signed in — you can close this tab")
5. The Tauri app's top bar updates: instead of "Sign in with Google" it now shows your email + a "Sign out" pill

If anything fails here, see task 02 — the most likely failures are listed there.

### 6. Verify a real upload

1. With the app signed in, create a set named e.g. `"Tauri OAuth test"`
2. Pick **Editorial** (or any destination)
3. Drag in 2–3 photos
4. Click **Push to Drive**
5. Confirm in the modal

Expected: each photo uploads one at a time, the modal eventually shows "All sets are on their way", the studio resets. The photos appear in your Drive's Editorial folder named `Tauri OAuth test (1).jpg`, `Tauri OAuth test (2).jpg`, etc.

### 7. Verify token persistence

1. Quit the app entirely (⌘Q)
2. Relaunch from `/Applications`
3. Top bar should still show your email — no re-auth needed

The token storage lives at `~/Library/Application Support/vflics-studio/tokens.json` (a JSON file holding access_token, refresh_token, expires_at, email).

### 8. Verify token refresh

This is hardest to trigger manually because Google access tokens last 1 hour. To force it:

1. Open the tokens file: `nano ~/Library/Application\ Support/vflics-studio/tokens.json`
2. Change `expires_at` to a past Unix timestamp (e.g. `1`)
3. Save and exit
4. Try another push in the app
5. Expected: silently refreshes, upload succeeds

If it fails with "no refresh token", the refresh flow has a bug — fix in task 02.

## What to report

Once tests 4–8 pass, commit any minor fixes you made and push. If anything broke, **stop and write up the failure mode** so task 02 can address it.

## What NOT to do in this task

- ❌ Do **not** delete `/api/studio/upload-remote` or any other Vercel paths yet — iOS still uses them (task 04 handles deletion).
- ❌ Do **not** touch iOS code in this task — iOS still uses the Vercel path and must keep working until task 03.
- ❌ Do **not** rotate the `STUDIO_UPLOAD_TOKEN` — iOS still needs it.

## Acceptance criteria

- [ ] `npm run tauri:build` completes without errors
- [ ] The new `.app` installs and launches without Gatekeeper warnings (after first right-click → Open)
- [ ] Drag photos from Finder into the window adds them to the active set
- [ ] Drag thumbnails to reorder works
- [ ] "Sign in with Google" → email shows in top bar
- [ ] Push to Drive succeeds with real photos in a real Drive folder
- [ ] Restart the app — sign-in survives (no re-auth needed)
- [ ] Forcing an expired token triggers refresh successfully
