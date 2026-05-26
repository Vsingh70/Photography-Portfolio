# vflics Studio — macOS desktop app

Tauri 2 wrapper around `https://vflics.com/studio`. Standalone — no local dev server required at runtime. The window loads the deployed Studio page directly, authenticated via a `?key=<STUDIO_UPLOAD_TOKEN>` query param matched against the same env var that gates `/api/studio/upload-remote`.

## One-time setup

1. **Copy the config and add your real token** (this file is gitignored so the token never leaks):

   ```bash
   cp src-tauri/tauri.conf.json src-tauri/tauri.conf.local.json
   ```

   Then open `src-tauri/tauri.conf.local.json` and replace **both** occurrences of `REPLACE_WITH_STUDIO_UPLOAD_TOKEN` with your real `STUDIO_UPLOAD_TOKEN` value (the one set in Vercel).

2. **Tell Tauri to use the local config.** Tauri auto-discovers `tauri.conf.<env>.json` if you pass `--config`:

   ```bash
   npm run tauri:dev -- --config src-tauri/tauri.conf.local.json
   ```

   Or for the bundled `.app`:

   ```bash
   npm run tauri:build -- --config src-tauri/tauri.conf.local.json
   ```

## Building the .app

```bash
npm run tauri:build -- --config src-tauri/tauri.conf.local.json
```

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

The token is embedded in the bundled `.app` URL config — anyone with that `.app` can use it to upload. Treat the built `.app` as you would the token itself: don't distribute it.

If the token ever leaks (or you suspect it has): rotate `STUDIO_UPLOAD_TOKEN` in Vercel, redeploy, then update your `tauri.conf.local.json` and rebuild the `.app`.

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
