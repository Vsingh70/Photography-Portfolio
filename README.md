# Photography Portfolio

Production portfolio site for vflics photography. Public site at **[vflics.com](https://vflics.com)**.

This repo contains everything: the Next.js site, the image variant pipeline, two "Upload Studio" clients for adding photos, the supporting backend, and the GitHub Actions auto-publish loop that ties them together.

---

## What's here

| Surface | Path | Purpose |
|---|---|---|
| Public site | [app/](app/) | Next.js 16 / React 19 portfolio at vflics.com |
| Image pipeline | [app/scripts/](app/scripts/) | Downloads originals from Google Drive, runs Sharp to produce AVIF + WebP at four sizes, uploads to Cloudflare R2 |
| Backend API | [app/src/app/api/](app/src/app/api/) | Contact form + ISR revalidate + Studio publish trigger (Drive uploads themselves bypass the server) |
| Studio page | [app/src/app/studio/](app/src/app/studio/) | The Upload Studio UI. Functional inside the Tauri desktop app or the iOS app; browser visits show a "use the desktop app" message |
| Tauri desktop app | [app/src-tauri/](app/src-tauri/) | macOS `.app` wrapping the Studio page in a native window; hosts the loopback OAuth + direct-Drive-upload pipeline |
| iOS app | [ios/vflics-studio/](ios/vflics-studio/) | SwiftUI native app for the iPhone; signs in via ASWebAuthenticationSession and uploads directly to Drive |
| Auto-publish workflow | [.github/workflows/](.github/workflows/) | Runs `npm run generate-galleries` and commits the resulting JSON back to main; fires automatically after every Studio push |

---

## Architecture

### Read path (the public site)

```
Google Drive (originals — RAW source of truth)
        │
        │ scripts/generate-gallery-data.ts  (npm run generate-galleries)
        ▼
Sharp variant pipeline (4 sizes × 2 formats per image + 24px base64 webp LQIP)
        │
        ├─→ Cloudflare R2 bucket — binary variants
        │   served at pub-bd79df0de9c640f7a1e7e492d578ae53.r2.dev/galleries/{slug}/...
        │
        └─→ app/src/generated/gallery-{slug}.json — metadata + R2 URLs + LQIPs
                        │
                        ▼
                  next build → Vercel → vflics.com
```

Vercel deploys do **zero image work**. All variants exist on R2 before deploy; the build just ships React + small JSON manifests. Adding photos used to mean running the pipeline locally + `git push` by hand. That's now automated — see the write path.

### Write path (Studio → site, end to end)

```
User's iPhone / Mac (Tauri or iOS Studio)
        │
        │ 1. OAuth (drive.file scope, user's Google account)
        │ 2. Direct multipart upload to Drive (per-photo, no Vercel hop)
        ▼
Google Drive (destination folder: Editorial / Portraits / etc.)
        │
        │ 3. Studio POSTs to /api/studio/publish on Vercel
        ▼
Vercel function /api/studio/publish
        │
        │ 4. Forwards a repository_dispatch event to GitHub
        │    (Authorization: Bearer GH_DISPATCH_PAT)
        ▼
GitHub Actions: .github/workflows/generate-galleries.yml
        │
        │ 5. npm ci + npm run generate-galleries
        │    (scans every Drive folder, builds variants for any new photo,
        │     uploads them to R2, regenerates app/src/generated/gallery-*.json
        │     and app/scripts/.manifests/*)
        │
        │ 6. git commit + push to main if anything changed
        ▼
Vercel auto-deploys the new commit → vflics.com updates
```

End user experience: push from Studio → wait 2-6 minutes → site shows the new photos. No terminal, no manual `git push`. The whole loop is verified end-to-end (commits `ab9a678` + `db7de20`).

---

## The two Upload Studios

Same UI shape, two binaries — pick whichever is least friction for the situation.

### 1. Tauri macOS desktop app

A native `.app` in `/Applications`. Click **Sign in with Google** on first launch; tokens persist across restarts via `~/Library/Application Support/vflics-studio/tokens.json`. Drag-from-Finder works; drag-to-reorder works; per-file progress and a publishing indicator show during push.

Source: [app/src-tauri/](app/src-tauri/) · setup: [app/src-tauri/README.md](app/src-tauri/README.md)

Build (the OAuth client secret is passed in at build time so it stays out of git):
```bash
cd app
OAUTH_CLIENT_SECRET="GOCSPX-..." npm run tauri:build
# Drag the .app from src-tauri/target/release/bundle/macos/ into /Applications
```

Get the secret from Google Cloud Console → Credentials → the Desktop OAuth client → **+ Add Secret**.

### 2. iOS Studio (TestFlight)

Native SwiftUI app. Signs in via `ASWebAuthenticationSession` — a Safari sheet inside the app. Tokens live in the iOS Keychain. Uploads each photo via `URLSession.upload(for:from:)` straight to Drive.

Source: [ios/vflics-studio/](ios/vflics-studio/) · client IDs in [Config.swift](ios/vflics-studio/vflics-studio/Config.swift) · manual Info.plist with the OAuth redirect URL scheme

To ship a new TestFlight build:
1. Bump `CURRENT_PROJECT_VERSION` in `vflics-studio.xcodeproj/project.pbxproj`
2. Xcode → Product → Archive → Distribute → App Store Connect → Upload
3. In App Store Connect, clear the export-compliance prompt (No to non-exempt encryption — we only use HTTPS, which is exempt)
4. TestFlight on your phone auto-detects the new build

---

## Adding new photos (the canonical workflow)

The whole loop is now hands-off after setup:

```
1. In Tauri or iOS Studio, create a set:
     - Name it (e.g. "VDR Party")
     - Pick destination (Editorial / Portraits / Graduation / Engagement / Events / About)
     - Add photos
     - Push to Drive

2. Watch the modal go: Uploading… → Publishing… → Pushed
   (≈ 10 sec for the Drive upload + 1 sec for the publish trigger)

3. Walk away. GitHub Actions runs generate-galleries, commits, Vercel deploys.

4. ≈ 2-6 minutes later, the photos appear at vflics.com/gallery/<slug>.
```

Manual fallback (if you need it): you can still run `npm run generate-galleries` locally and `git push`. The Action does the same thing; the manual path is just for debugging or if GitHub Actions is down.

For the cover thumbnails and the about portrait, run `npm run generate-covers` and `npm run generate-about` respectively. Those are separate pipelines, not part of the auto-publish loop.

---

## Repo layout

```
.
├── .github/workflows/
│   └── generate-galleries.yml          GH Actions workflow that ties the loop together
│
├── app/                                 Next.js 16 site (npm root)
│   ├── src/
│   │   ├── app/
│   │   │   ├── studio/                  Upload Studio UI (Tauri-targeted)
│   │   │   ├── api/studio/publish/      Publish trigger → GitHub repository_dispatch
│   │   │   ├── api/contact/             Contact form handler
│   │   │   └── api/revalidate/          ISR revalidate webhook
│   │   ├── components/
│   │   │   ├── gallery/                 GalleryCard (LQIP blur-up), MasonryGrid, EditorialLightbox
│   │   │   ├── layout/                  Navbar, Footer, Logo, HamburgerMenu
│   │   │   ├── home/                    HeroContent
│   │   │   └── forms/                   ContactForm
│   │   ├── generated/                   Build-time gallery JSON (committed; updated by Action)
│   │   ├── lib/
│   │   │   ├── tauri-oauth.ts           JS wrapper around the Tauri OAuth Rust commands
│   │   │   └── rate-limit.ts            Used by /api/studio/publish
│   │   └── types/
│   ├── scripts/
│   │   ├── generate-gallery-data.ts     The variant pipeline (Drive → Sharp → R2 → JSON)
│   │   ├── generate-cover-thumbnails.ts
│   │   ├── generate-about-image.ts
│   │   └── .manifests/                  Per-gallery modifiedTime cache (committed)
│   ├── src-tauri/                       Tauri desktop wrapper
│   │   ├── src/main.rs                  Tauri entry point
│   │   ├── src/oauth.rs                 OAuth + Drive upload Rust commands
│   │   ├── capabilities/default.json    ACL: grants the OAuth commands to the main window
│   │   ├── permissions/oauth.toml       ACL: defines each invokable command
│   │   ├── tauri.conf.json              Window config; URL is https://vflics.com/studio
│   │   └── icons/                       App icons (PNG + ICNS)
│   └── public/                          Static assets (covers, about, fonts)
│
├── ios/vflics-studio/                   Xcode SwiftUI project
│   └── vflics-studio/
│       ├── vflics_studioApp.swift       @main entry
│       ├── Config.swift                 iOS OAuth client ID + Drive folder IDs
│       ├── GoogleOAuth.swift            ASWebAuthenticationSession wrapper
│       ├── Store.swift                  @Observable central store; triggers publish after push
│       ├── KeychainStorage.swift        OAuth token persistence
│       ├── UploadClient.swift           Direct Drive multipart upload
│       ├── Theme.swift                  Editorial vocabulary (colors, typography)
│       ├── Info.plist                   Manual plist with OAuth URL scheme + standard CFBundle keys
│       └── Views/                       ContentView, SetsView, SetEditorView, PushSheet, etc.
│
└── tasks/
    ├── guides/                          Historical deployment/optimization docs
    ├── remaining/                       Live task notes (OAuth migration history + open polish items)
    └── launchers/vflics-studio.command  Double-click to start `npm run dev` + open /studio
```

---

## Environment variables

There are three places env vars live: your local `.env.local`, GitHub Actions secrets (for the auto-publish workflow), and Vercel (for the publish trigger). Setup details in [tasks/remaining/06-autopublish-setup.md](tasks/remaining/06-autopublish-setup.md).

**Vercel (production runtime):**
- `GH_DISPATCH_PAT` — fine-scoped GitHub PAT with `Contents: write` on this repo
- `GH_DISPATCH_REPO` — `Vsingh70/Photography-Portfolio`

**GitHub Actions secrets (used by the auto-publish workflow):**
- `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY` — service account for listing Drive folders
- `GOOGLE_DRIVE_{EDITORIAL,PORTRAITS,GRADUATION,ENGAGEMENT,EVENTS}_FOLDER_ID` — destination folder IDs
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — Cloudflare R2 write credentials
- `NEXT_PUBLIC_GALLERY_CDN_BASE` — the R2 public URL, baked into generated JSON
- `GH_DISPATCH_PAT` — also needed here so the workflow can `git push` its commits back to main

**Local `.env.local` (for manual `npm run generate-galleries` or `generate-covers` / `generate-about`):**
- Same Drive + R2 + CDN vars as the Action; not the GH PAT
- `dotenv`-style: surrounding quotes get stripped; `\n` escapes get expanded

The script uses a `normalizeEnv()` helper that strips surrounding quotes and expands `\n` escapes, so values copy-pasted into GH Actions Secrets work even if they include the `.env`-style quotes.

**OAuth client IDs (public, embedded in code):**
- Desktop / Tauri: `545350887333-cicbneumq1aud1qej9la8c465nmi16oj.apps.googleusercontent.com`
- iOS: `545350887333-3h1qjmaqcuonifts783hsgc5rakk0idc.apps.googleusercontent.com`

The Tauri client secret is **not** in code — it's read from `OAUTH_CLIENT_SECRET` at compile time via `option_env!`. Per Google's docs, desktop client secrets aren't truly secret (anyone with the binary can extract them), but keeping it out of git is still better hygiene. The iOS client uses a public-client redirect-scheme flow and has no secret.

---

## Local dev

```bash
cd app
npm install
npm run dev          # site at localhost:3000
```

Visiting `localhost:3000/studio` in a regular browser shows the "use the desktop app" empty state. To run the actual Studio:

```bash
cd app
npm run tauri:dev    # opens the Tauri window pointing at vflics.com/studio (or local — depends on tauri.conf.json devUrl)
```

For the iOS app: open `ios/vflics-studio/vflics-studio.xcodeproj` in Xcode, ⌘R (simulator) or pair an iPhone for device. Build target is iOS 17+.

---

## Stack

- **Site:** Next.js 16 (App Router, Turbopack) + React 19 + Tailwind 4
- **Images:** Sharp (build time) + AVIF/WebP `<picture>` with srcset + Cloudflare R2 + 24px base64 LQIP blur-up
- **Type:** Cormorant Garamond (display, italic) + DM Mono (captions, small-caps) + Geist (system)
- **Animations:** Framer Motion + `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) everywhere
- **Lightbox:** Custom `EditorialLightbox` (replaces `react-photo-view`)
- **Masonry:** Custom flex layout (replaces `react-masonry-css`)
- **Form:** react-hook-form + Cloudflare Turnstile (contact form)
- **Build pipeline:** Google Drive API + AWS S3 SDK against R2 (run by GH Actions on dispatch)
- **Backend (runtime):** Vercel + Next.js API routes (contact, revalidate, studio/publish)
- **Desktop:** Tauri 2 (Rust + WebKit + reqwest + tiny_http for loopback OAuth) with ACL permissions
- **iOS:** SwiftUI + AuthenticationServices + Xcode 26's PBXFileSystemSynchronizedRootGroup
- **CDN:** Vercel (HTML/JS/CSS) + Cloudflare R2 (image variants)
