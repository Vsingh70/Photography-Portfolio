# Photography Portfolio

Production portfolio site for vflics photography. Public site at **[vflics.com](https://vflics.com)**.

This repo contains everything: the Next.js site, the image variant pipeline, two desktop+mobile "Upload Studio" clients for adding photos, and the supporting backend.

---

## What's here

| Surface | Path | Purpose |
|---|---|---|
| Public site | [app/](app/) | Next.js 16 / React 19 portfolio at vflics.com |
| Image pipeline | [app/scripts/](app/scripts/) | Downloads originals from Google Drive, runs Sharp to produce AVIF + WebP at four sizes, uploads to Cloudflare R2 |
| Backend API | [app/src/app/api/](app/src/app/api/) | Contact form + ISR revalidate (Studio uploads bypass the server entirely) |
| Studio page | [app/src/app/studio/](app/src/app/studio/) | The Upload Studio UI. Only functional inside the Tauri desktop app or the iOS app; browser visits show a "use the desktop app" message |
| Tauri desktop app | [app/src-tauri/](app/src-tauri/) | macOS `.app` wrapping the Studio page in a native window; hosts the OAuth + direct-Drive-upload pipeline |
| iOS app | [ios/vflics-studio/](ios/vflics-studio/) | SwiftUI native app for the iPhone; signs in via ASWebAuthenticationSession and uploads directly to Drive |

---

## Architecture

### Read path (the public site)

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

### Write path (the Upload Studios)

```
User's iPhone / Mac (Tauri or iOS)
        │
        │ OAuth (drive.file scope, signed-in user's Google account)
        ▼
Google Drive API
   /upload/drive/v3/files?uploadType=multipart
        │
        ▼
The user's destination folder (Editorial / Portraits / etc.)
```

Each photo is uploaded individually from the client (Tauri Rust or iOS Swift) directly to Drive — no Vercel hop. This bypasses serverless body-size limits, scales to any photo count, and keeps the Vercel deploy footprint small.

---

## The two Upload Studios

Same interface, two clients — pick whichever is least friction for the situation.

### 1. Tauri macOS desktop app

A native `.app` in `/Applications`. Click **Sign in with Google** on first launch; tokens persist across restarts. No tokens to manage, no terminal required.

Source: [app/src-tauri/](app/src-tauri/) · setup: [app/src-tauri/README.md](app/src-tauri/README.md)

Build:
```bash
cd app
npm run tauri:build
# Drag the resulting .app from src-tauri/target/release/bundle/macos/ to /Applications
```

Drag-from-Finder works; drag-to-reorder works; per-file progress shows during push.

### 2. iOS Studio (TestFlight)

Native SwiftUI app. Signs in via `ASWebAuthenticationSession` — a Safari sheet inside the app. Tokens live in the iOS Keychain. Uploads each photo via `URLSession.upload(for:from:)` straight to Drive.

Source: [ios/vflics-studio/](ios/vflics-studio/) · client IDs in [Config.swift](ios/vflics-studio/vflics-studio/Config.swift)

To rebuild:
1. Bump `CURRENT_PROJECT_VERSION` in `vflics-studio.xcodeproj/project.pbxproj`
2. Xcode → Product → Archive → Distribute → App Store Connect → Upload
3. In App Store Connect, clear the export-compliance prompt (No to non-exempt encryption — we only use HTTPS, which is exempt)
4. TestFlight on your phone auto-detects the new build

---

## Adding new photos (the canonical workflow)

```
1. In one of the two Studios, create a set:
     - Name it (e.g. "VDR Party")
     - Pick destination (Editorial / Portraits / Graduation / Engagement / Events / About)
     - Add photos
     - Push to Drive → uploads each photo as "<setName> (n).<ext>" in the chosen Drive folder

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
│   │   │   ├── studio/                     Upload Studio UI (Tauri-targeted)
│   │   │   ├── api/contact/                Contact form handler
│   │   │   └── api/revalidate/             ISR revalidate webhook
│   │   ├── components/
│   │   │   ├── gallery/                    GalleryCard, MasonryGrid, EditorialLightbox
│   │   │   ├── layout/                     Navbar, Footer, Logo, HamburgerMenu
│   │   │   ├── home/                       HeroContent
│   │   │   └── forms/                      ContactForm
│   │   ├── generated/                      Build-time JSON (gallery metadata, R2 URLs)
│   │   ├── lib/
│   │   │   └── tauri-oauth.ts              JS wrapper around the Tauri OAuth commands
│   │   └── types/
│   ├── scripts/                            Variant pipeline + manifests
│   ├── src-tauri/                          Tauri desktop wrapper
│   │   ├── src/oauth.rs                    OAuth + Drive upload Rust commands
│   │   └── ...
│   └── public/                             Static assets (covers, about, fonts)
│
├── ios/vflics-studio/                      Xcode SwiftUI project
│   └── vflics-studio/
│       ├── vflics_studioApp.swift          @main entry
│       ├── Config.swift                    iOS OAuth client ID + folder IDs
│       ├── GoogleOAuth.swift               ASWebAuthenticationSession wrapper
│       ├── Store.swift                     @Observable central store
│       ├── KeychainStorage.swift           OAuth token persistence
│       ├── UploadClient.swift              Direct Drive multipart upload
│       ├── Theme.swift                     Editorial vocabulary (colors, typography)
│       ├── Info.plist                      URL scheme for OAuth redirect
│       └── Views/                          ContentView, SetsView, SetEditorView, etc.
│
└── tasks/
    ├── guides/                             Historical deployment/optimization docs
    └── launchers/vflics-studio.command     Double-click to start `npm run dev` + open /studio
```

---

## Environment variables

**Vercel (production):** none required for the public site beyond the standard Next.js runtime. No Studio secrets — the Studio uploads bypass Vercel entirely.

**Local `.env.local` (for `npm run generate-galleries`):**
- `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY` — service account (read-only) for listing Drive folders
- `GOOGLE_DRIVE_{EDITORIAL,PORTRAITS,GRADUATION,ENGAGEMENT,EVENTS,ABOUT}_FOLDER_ID` — destination folder IDs (also hardcoded in [iOS Config](ios/vflics-studio/vflics-studio/Config.swift) and [StudioApp BUILTIN_DESTINATIONS](app/src/app/studio/StudioApp.tsx))
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — Cloudflare R2 write credentials
- `NEXT_PUBLIC_GALLERY_CDN_BASE` — the R2 public URL, baked into generated JSON

The R2 credentials never need to be on Vercel — variants are uploaded before deploy.

**OAuth client IDs (public, safe to share, embedded in code):**
- Desktop / Tauri: `545350887333-cicbneumq1aud1qej9la8c465nmi16oj.apps.googleusercontent.com`
- iOS: `545350887333-3h1qjmaqcuonifts783hsgc5rakk0idc.apps.googleusercontent.com`

---

## Local dev

```bash
cd app
npm install
npm run dev          # site at localhost:3000
```

Visiting `localhost:3000/studio` in a regular browser shows the "use the desktop app" empty state. To exercise the actual Studio:

```bash
npm run tauri:dev    # opens the Tauri window pointing at the local dev server (or vflics.com — depends on tauri.conf.json devUrl)
```

For the iOS app: open `ios/vflics-studio/vflics-studio.xcodeproj` in Xcode, ⌘R (simulator) or pair an iPhone for device.

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
- **Backend (runtime):** Vercel + Next.js API routes (contact only)
- **Desktop:** Tauri 2 (Rust + WebKit + reqwest + tiny_http for loopback OAuth)
- **iOS:** SwiftUI + AuthenticationServices + Xcode 26's PBXFileSystemSynchronizedRootGroup
- **CDN:** Vercel + Cloudflare R2 public bucket
