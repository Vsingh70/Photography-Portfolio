# vflics Studio — macOS desktop app

Tauri 2 wrapper around `https://vflics.com/studio`. Standalone — no local dev server required at runtime. The window loads the deployed Studio page directly, authenticated via a `?key=<STUDIO_UPLOAD_TOKEN>` query param matched against the same env var that gates `/api/studio/upload-remote`.

## One-time setup

Copy the config and add your real token (this file is gitignored so the token never leaks to GitHub):

```bash
cp src-tauri/tauri.conf.json src-tauri/tauri.conf.local.json
```

Open `src-tauri/tauri.conf.local.json` and replace **both** occurrences of `REPLACE_WITH_STUDIO_UPLOAD_TOKEN` with your real `STUDIO_UPLOAD_TOKEN` value (the one set in Vercel).

## Building the .app

```bash
npm run tauri:build
```

The `scripts/tauri-build.sh` wrapper:
1. Checks `tauri.conf.local.json` exists and doesn't still contain the placeholder
2. Backs up the committed `tauri.conf.json`
3. Swaps in `tauri.conf.local.json` for the build
4. Runs `tauri build`
5. **Always** restores the placeholder `tauri.conf.json` (via `trap`), so the token never sits on disk where you might `git add` it

Tauri 2's `--config` overlay flag is unreliable, which is why we do the swap-restore dance instead.

Outputs:
- `src-tauri/target/release/bundle/dmg/vflics Studio_0.1.0_aarch64.dmg`
- `src-tauri/target/release/bundle/macos/vflics Studio.app`

Drag the `.app` into `/Applications`. Double-click to launch — it opens the deployed Studio.

## Why this works

- `/studio` page checks `?key=` against `STUDIO_UPLOAD_TOKEN`. Matching keys render the Studio; non-matching get 404.
- `/api/studio/destinations` and `/api/studio/upload` use the same gate.
- The Tauri window's URL carries the key. The Studio's fetch calls propagate it automatically (it reads `?key=` from `window.location` on mount).
- The committed `tauri.conf.json` only has a placeholder, so accidentally pushing it leaks nothing.

## Security caveats

**The token is embedded as a plain string inside the bundled binary.** Running `strings vflics\ Studio.app/Contents/MacOS/vflics-studio | grep vflics.com` will print it. This is fine for local personal use, but means:

- ⚠️ **Do not share the `.app` or `.dmg`** — treat them as containing your auth token.
- ⚠️ **Do not upload to GitHub releases**, public file shares, or anywhere a third party could grab them.
- ⚠️ If the build artifact ever leaves your machine, rotate `STUDIO_UPLOAD_TOKEN` immediately.

For a distribution-ready version (sharing with someone else, App Store, etc.), the right design is: app starts with no token, prompts on first run, stores in macOS Keychain — similar to the iOS app's settings sheet. Not done here because it's overkill for a one-machine tool.

If the token ever leaks (or you suspect it has): rotate `STUDIO_UPLOAD_TOKEN` in Vercel → redeploy → update `tauri.conf.local.json` → rebuild the `.app`.

## Updating the icon

The placeholder icon was generated from `public/about/about.webp`. To replace:

```bash
node -e "
const sharp = require('sharp');
const path = require('path');
const src = 'YOUR_SOURCE_ICON.png';
const out = path.join(__dirname, 'src-tauri/icons');
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
# Then re-generate the .icns:
mkdir -p src-tauri/icons/icon.iconset
for size in 16 32 64 128 256 512 1024; do
  sips -s format png --resampleHeightWidth $size $size YOUR_SOURCE_ICON.png \
    --out src-tauri/icons/icon.iconset/icon_${size}x${size}.png
done
iconutil -c icns src-tauri/icons/icon.iconset -o src-tauri/icons/icon.icns
```

## Files

| File | Purpose |
|---|---|
| `tauri.conf.json` | Committed config — has placeholder, safe to push |
| `tauri.conf.local.json` | **gitignored** — your real config with the token |
| `Cargo.toml` | Rust dependencies |
| `src/main.rs` | Tauri entry point |
| `build.rs` | Tauri build script |
| `icons/` | App icons (PNG + ICNS) |
