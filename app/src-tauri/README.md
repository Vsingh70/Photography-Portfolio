# vflics Studio — macOS desktop app

Tauri 2 wrapper around `https://vflics.com/studio`. The window loads the deployed Studio page. The Tauri Rust side hosts the OAuth + direct-Drive-upload pipeline:

- **Sign in with Google** opens the user's default browser to Google's consent screen
- Tauri listens on `127.0.0.1:8765` for the OAuth redirect
- Tokens persist to `~/Library/Application Support/vflics-studio/tokens.json`
- Each photo uploads straight from the binary to `https://www.googleapis.com/upload/drive/v3/files` — no Vercel hop, no 4.5 MB body limit
- The `drive.file` scope means the app can only see/edit files it creates (sufficient for upload-only)

No secrets are embedded in the binary; nothing needs to be set up before building.

## Building the .app

The OAuth client secret for the Desktop client must be passed at build time:

```bash
OAUTH_CLIENT_SECRET="GOCSPX-..." npm run tauri:build
```

Get the secret from Google Cloud Console → Credentials → the Desktop OAuth client → "+ Add Secret". Google now treats secrets as create-once / hidden-after; if you don't have the value saved, generate a new one and disable the old.

The wrapper at `scripts/tauri-build.sh` just sources `$HOME/.cargo/env` and runs `tauri build`. First build downloads ~200 Rust crates and takes ~10-15 min; subsequent builds are ~30-60 seconds.

Why an env var: the secret gets baked into the binary regardless (anyone with the `.app` can extract it via `strings`), but reading it from `option_env!` at build time keeps it out of source control.

Outputs:
- `src-tauri/target/release/bundle/macos/vflics Studio.app`
- `src-tauri/target/release/bundle/dmg/vflics Studio_0.1.0_aarch64.dmg`

Drag the `.app` into `/Applications`. First launch: right-click → Open (Gatekeeper bypass, only needed once because the app isn't notarized).

## First-run flow

1. App opens, loads `vflics.com/studio` in its WKWebView
2. Click **Sign in with Google** in the top bar
3. Browser opens to `accounts.google.com` requesting `drive.file` + `userinfo.email`
4. Approve → browser redirects to `http://127.0.0.1:8765/callback?code=...` → shows a confirmation page
5. Tauri exchanges the code for tokens, fetches your email, persists everything to disk
6. Top bar updates to show your signed-in email

Subsequent launches: no re-auth (refresh tokens last indefinitely until you sign out or revoke at [myaccount.google.com/permissions](https://myaccount.google.com/permissions)).

## Push flow

1. Create a set (name + destination + photos)
2. Click **Push to Drive →**
3. Each photo uploads one at a time, with progress shown in the modal
4. On success, the studio resets

The destinations + their Drive folder IDs are hardcoded in [src/app/studio/StudioApp.tsx](../src/app/studio/StudioApp.tsx) (`BUILTIN_DESTINATIONS`). Custom destinations can be added via the UI with a manually-typed folder ID.

## Why this works

- OAuth `drive.file` lets the signed-in account upload to any folder they own (the destination folders are in your own My Drive)
- Multipart upload directly to Drive avoids Vercel's serverless function body limits
- Token refresh is handled in Rust; once signed in, you stay signed in across app restarts

## Updating the icon

Icons live in `src-tauri/icons/`. The current set (cream-tile VS logo) was generated from `app/public/vs logo black.svg`:

```bash
node -e "
const sharp = require('sharp');
const path = require('path');
const src = 'app/public/vs logo black.svg';
const out = path.join(process.cwd(), 'app/src-tauri/icons');
const sizes = [
  ['icon.png', 512],
  ['32x32.png', 32],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
  ['icon-1024.png', 1024],
];
(async () => {
  for (const [name, size] of sizes) {
    await sharp(src).resize(size, size, { fit: 'cover' }).ensureAlpha().png().toFile(path.join(out, name));
  }
})();
"
```

Then re-bundle the `.icns`:

```bash
mkdir -p src-tauri/icons/icon.iconset
for size in 16 32 64 128 256 512 1024; do
  sips -s format png --resampleHeightWidth $size $size YOUR_ICON.png \
    --out src-tauri/icons/icon.iconset/icon_${size}x${size}.png
done
iconutil -c icns src-tauri/icons/icon.iconset -o src-tauri/icons/icon.icns
```

## Files

| File | Purpose |
|---|---|
| `Cargo.toml` | Rust deps (tauri, reqwest, tokio, tiny_http, etc.) |
| `src/main.rs` | Tauri entry point; registers OAuth commands |
| `src/oauth.rs` | OAuth + Drive upload commands invoked from JS |
| `tauri.conf.json` | Window config, points at https://vflics.com/studio |
| `build.rs` | Tauri build script |
| `icons/` | App icons (PNG + ICNS) |
