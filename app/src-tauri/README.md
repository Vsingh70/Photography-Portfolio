# vflics Studio — macOS desktop app

Tauri 2 wrapper around the existing Next.js `/studio` route. Reads the same `.env.local`, calls the same `/api/studio/upload` endpoint. Just packages it as a native `.app` so you don't have to keep a terminal open.

## Run in dev

```bash
npm run tauri:dev
```

This spawns `next dev` AND opens a Tauri window pointing at `http://localhost:3000/studio`. First run compiles the Rust dependencies (~3-5 min). Subsequent runs are near-instant.

## Build a distributable .app

```bash
npm run tauri:build
```

Outputs:
- `src-tauri/target/release/bundle/dmg/vflics Studio_0.1.0_aarch64.dmg`
- `src-tauri/target/release/bundle/macos/vflics Studio.app`

Drag the `.app` into `/Applications`. Double-click to launch. The app still needs `npm run dev` running for the upload API to respond — see below.

## Important: this app is a *window*, not a server

Tauri renders the Next.js dev server in a native window. The Drive upload API runs in Node — Tauri does not bundle Node. So the workflow is still:

1. **Terminal A**: `npm run dev` (keeps the Next.js + API alive)
2. **Terminal B** *or* Finder: launch `vflics Studio.app`

If you want a truly self-contained `.app` that doesn't need a separate dev server, the right path is to spawn `next start` from Rust on app launch — that's a follow-up. For now the `.app` is a nicer-looking window for the workflow you already have.

## Icon

The app icon at `icons/icon.icns` is a placeholder generated from `public/about/about.webp`. To replace:

1. Make a 1024×1024 PNG of your icon.
2. Run:
   ```bash
   mkdir -p icons/icon.iconset
   for size in 16 32 64 128 256 512 1024; do
     sips -s format png --resampleHeightWidth $size $size YOUR_ICON.png \
       --out icons/icon.iconset/icon_${size}x${size}.png
   done
   iconutil -c icns icons/icon.iconset -o icons/icon.icns
   ```

## Config

- [tauri.conf.json](tauri.conf.json) — window size, dev URL, bundle identifier
- [src/main.rs](src/main.rs) — Tauri entry point
- [Cargo.toml](Cargo.toml) — Rust dependencies
