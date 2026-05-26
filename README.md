# Photography Portfolio

Production portfolio site for vflics photography. Public site at **[vflics.com](https://vflics.com)**.

This repo contains everything: the Next.js site, the image variant pipeline, three "Upload Studio" clients for adding photos, and the supporting backend.

---

## What's here

| Surface | Path | Purpose |
|---|---|---|
| Public site | [app/](app/) | Next.js 16 / React 19 portfolio at vflics.com |
| Image pipeline | [app/scripts/](app/scripts/) | Downloads originals from Google Drive, runs Sharp to produce AVIF + WebP at four sizes, uploads to Cloudflare R2 |
| Backend API | [app/src/app/api/](app/src/app/api/) | Contact form, ISR revalidate, Studio upload endpoints |
| Web Studio | [app/src/app/studio/](app/src/app/studio/) | Browser-based photo set staging at `vflics.com/studio?key=…` |
| Tauri desktop app | [app/src-tauri/](app/src-tauri/) | macOS `.app` wrapping the web Studio in a native window |
| iOS app | [ios/vflics-studio/](ios/vflics-studio/) | SwiftUI native app for staging from your phone, talks to the same backend |

---

## Architecture

```
Google Drive (originals — RAW source of truth)
        │
        │ scripts/generate-gallery-data.ts (run locally when adding photos)
        ▼
Sharp variant pipeline (4 sizes × 2 formats per image + base64 webp blur)
        │
        ├─→ Cloudflare R2 bucket — binary variants
        │   served at pub-bd79df0de9c640f7a1e7e492d578ae53.r2.dev/galleries/{slug}/...
        │
        └─→ src/generated/gallery-{slug}.json — small metadata file, points at R2 URLs
                        │
                        ▼
                  next build → Vercel → vflics.com
```

Vercel deploys do **zero image work**. All variants exist on R2 before deploy; the build just ships React + small JSON manifests. Adding photos is a manual local step that updates Drive + R2 + the JSON, then `git push`.

---

## The three Upload Studios

Same interface, three deployments — pick whichever is least friction for the situation.

### 1. Web Studio (any browser)

URL: `https://vflics.com/studio?key=<STUDIO_UPLOAD_TOKEN>`

Production-gated by a query-param token (`STUDIO_UPLOAD_TOKEN` env var on Vercel). Hit it without the key and you get a 404. Hit it with the matching key and you get the full Studio UI.

Local dev: `npm run dev` then visit `http://localhost:3000/studio` — no token required (gated only in production).

### 2. Tauri macOS desktop app

A native `.app` in `/Applications`. The auth token is baked into the binary URL, so it's a one-click launch — no terminal needed.

Source: [app/src-tauri/](app/src-tauri/) · setup: [app/src-tauri/README.md](app/src-tauri/README.md)

Build:
```bash
cd app
cp src-tauri/tauri.conf.json src-tauri/tauri.conf.local.json
# Edit the local config: replace REPLACE_WITH_STUDIO_UPLOAD_TOKEN with the real value
npm run tauri:build
# Drag the resulting .app from src-tauri/target/release/bundle/macos/ to /Applications
```

Security caveat: the token sits as a plain string inside the binary (`strings` can extract it). Do not share the `.app`/`.dmg` — treat them as containing your token.

### 3. iOS Studio (TestFlight)

Native SwiftUI app for the iPhone. Talks to the same backend via the bearer-token-gated `/api/studio/upload-remote` endpoint. The Vercel endpoint URL is baked into the binary at build time (see [Config.swift](ios/vflics-studio/vflics-studio/Config.swift)); the auth token is per-install and lives in the iOS Keychain.

Source: [ios/vflics-studio/](ios/vflics-studio/)

Distribution: TestFlight (internal testers). To rebuild:
1. Bump `CURRENT_PROJECT_VERSION` in `vflics-studio.xcodeproj/project.pbxproj`
2. Xcode → Product → Archive → Distribute → App Store Connect → Upload
3. In App Store Connect, clear the export-compliance prompt (No to encryption — we only use HTTPS, which is exempt)
4. TestFlight on your phone auto-detects the new build

---

## Adding new photos (the canonical workflow)

```
1. In one of the three Studios, create a set:
     - Name it (e.g. "VDR Party")
     - Pick destination (Editorial / Portraits / Graduation / Engagement / Events / About)
     - Add photos
     - Push to Drive → uploads rename each photo to "<setName> (n).jpg" in the chosen Drive folder

2. Locally: regenerate variants and JSON
   cd app
   npm run generate-galleries

   The script lists each Drive folder, skips unchanged photos (manifest-based),
   builds AVIF+WebP variants for new ones, uploads to R2, rewrites
   src/generated/gallery-*.json.

3. Commit + push
   git add src/generated/ scripts/.manifests/
   git commit -m "Add new portraits"
   git push

4. Vercel auto-deploys from main. Site updates in ~30 seconds. No image
   processing on the build server.
```

For adding/changing the cover thumbnails or about portrait, run `npm run generate-covers` or `npm run generate-about` respectively.

---

## Repo layout

```
.
├── app/                                    Next.js 16 site
│   ├── src/
│   │   ├── app/                            App-router pages + API routes
│   │   │   ├── studio/                     Web Studio
│   │   │   ├── api/studio/                 Studio backend (local + remote upload)
│   │   │   └── api/contact/                Contact form handler
│   │   ├── components/
│   │   │   ├── gallery/                    GalleryCard, MasonryGrid, EditorialLightbox
│   │   │   ├── layout/                     Navbar, Footer, Logo, HamburgerMenu
│   │   │   ├── home/                       HeroContent
│   │   │   └── forms/                      ContactForm
│   │   ├── generated/                      Build-time JSON (gallery metadata, R2 URLs)
│   │   ├── lib/
│   │   │   ├── drive-upload.ts             Service-account Drive write
│   │   │   └── studio-auth.ts              Shared auth gate
│   │   └── types/
│   ├── scripts/                            Variant pipeline + manifests
│   ├── src-tauri/                          Tauri desktop wrapper
│   └── public/                             Static assets (covers, about, fonts)
│
├── ios/vflics-studio/                      Xcode SwiftUI project
│   └── vflics-studio/
│       ├── vflics_studioApp.swift          @main entry
│       ├── Config.swift                    Baked-in endpoint URL
│       ├── Store.swift                     @Observable central store
│       ├── KeychainStorage.swift           Token persistence
│       ├── UploadClient.swift              Talks to /api/studio/upload-remote
│       ├── Theme.swift                     Editorial vocabulary (colors, typography)
│       └── Views/                          ContentView, SetsView, SetEditorView, etc.
│
└── tasks/
    ├── guides/                             Historical deployment/optimization docs
    └── launchers/vflics-studio.command     Double-click to start `npm run dev` + open /studio
```

---

## Environment variables

The site runs with two distinct credential surfaces:

**Vercel (production):**
- `STUDIO_UPLOAD_TOKEN` — gates the Studio and `/api/studio/upload-remote`
- `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY` — service account for `drive.file` (Studio uploads use this to write into Drive)
- `GOOGLE_DRIVE_{EDITORIAL,PORTRAITS,GRADUATION,ENGAGEMENT,EVENTS,ABOUT}_FOLDER_ID` — destination resolutions

**Local `.env.local` (for `npm run generate-galleries`):**
- All of the above
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — Cloudflare R2 write credentials
- `NEXT_PUBLIC_GALLERY_CDN_BASE` — the R2 public URL, baked into generated JSON

The R2 credentials never need to be on Vercel — variants are uploaded before deploy.

---

## Local dev

```bash
cd app
npm install
npm run dev          # site at localhost:3000
```

For the Tauri desktop app dev loop:
```bash
npm run tauri:dev    # requires src-tauri/tauri.conf.local.json (see app/src-tauri/README.md)
```

For the iOS app: open `ios/vflics-studio/vflics-studio.xcodeproj` in Xcode, ⌘R.

---

## Stack

- **Site:** Next.js 16 (App Router) + React 19 + Tailwind 4
- **Images:** Sharp (build time) + AVIF/WebP `<picture>` with srcset + Cloudflare R2
- **Type:** Cormorant Garamond (display, italic) + DM Mono (captions, small-caps) + Geist (system)
- **Animations:** Framer Motion + `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) everywhere
- **Lightbox:** Custom `EditorialLightbox` (replaces `react-photo-view`)
- **Masonry:** Custom flex layout (replaces `react-masonry-css`)
- **Form:** react-hook-form + Cloudflare Turnstile (contact form)
- **Backend (build):** Google Drive API + AWS S3 SDK against R2
- **Backend (runtime):** Vercel + Next.js API routes
- **Desktop:** Tauri 2 (Rust + WebKit)
- **iOS:** SwiftUI + Xcode 26's PBXFileSystemSynchronizedRootGroup
- **CDN:** Vercel + Cloudflare R2 public bucket
