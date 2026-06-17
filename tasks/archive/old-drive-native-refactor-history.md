# tasks/remaining/ — refactor history + open items

This directory captures the multi-session refactor that moved the project from "Vercel-proxied Studio uploads with a 4.5 MB body limit" to "client-direct Drive uploads + auto-publishing pipeline". Most of the work is done. What remains is a small set of polish items and one one-off ceremony for shipping iOS to TestFlight.

## What's done

| Theme | Reference | Status |
|---|---|---|
| Tauri loopback OAuth + direct Drive upload | commits `7043e5e`, `a9ecddb`, `e450651`, `58c8136` | ✅ Shipped, tested end-to-end |
| iOS native OAuth (ASWebAuthenticationSession) + direct Drive upload | commit `58c8136` + iOS `Info.plist` fix in `9ca7379` | ✅ Code complete; archive verified working via xcodebuild |
| Vercel cleanup (delete `/api/studio/upload-remote`, `/upload`, `/destinations`, `studio-auth`, `drive-upload`) | commit `58c8136` | ✅ Deleted; site has only `/api/contact`, `/api/revalidate`, `/api/studio/publish` |
| Polish items A, B, E, G, H | merged into `58c8136` | ✅ |
| Auto-publish pipeline: Studio → `/api/studio/publish` → repository_dispatch → GitHub Actions → commit + Vercel deploy | commits `ab9a678`, `69ce618`, `7084053`, `d0ac1aa`; proven by bot commit `db7de20` | ✅ Live, verified |
| GalleryCard LQIP blur-up | commit `8d5a803` | ✅ |

For per-commit detail, `git log --oneline main` is the source of truth.

## What's still open

| # | File | What | Status |
|---|---|---|---|
| 05 | [05-polish.md](05-polish.md) | Polish items C and D (custom iOS launch screen + bundled fonts) | ⏳ Optional |
| 06 | [06-autopublish-setup.md](06-autopublish-setup.md) | Manual setup for the auto-publish pipeline (GH PAT, GH Secrets, Vercel env vars) | ✅ One-time setup completed by the user; doc kept for re-rotation reference |
| —  | (no file) | Ship iOS build `1.0 (3)` to TestFlight (Xcode → Archive → Distribute) | ⏳ Manual ceremony |
| —  | (no file) | Rotate the Tauri OAuth client secret (current value was shared during a previous session — low real-world risk per Google's docs, but housekeeping) | ⏳ |

## Architecture (current, after all the work above)

```
                 ┌─────────────────────────────┐
                 │   Drive (originals — owned   │
                 │   by user's Google account)  │
                 └──────────────┬───────────────┘
                                │
                  OAuth (drive.file scope)
                                │
                 ┌──────────────┴───────────────┐
                 │                              │
        ┌────────▼─────────┐         ┌──────────▼─────────┐
        │   Tauri desktop  │         │   iOS app          │
        │   (macOS .app)   │         │   (TestFlight)     │
        │                  │         │                    │
        │ loopback OAuth   │         │ ASWebAuth...       │
        │ direct multipart │         │ direct multipart   │
        │ upload to Drive  │         │ upload to Drive    │
        └────────┬─────────┘         └──────────┬─────────┘
                 │                              │
                 │   POST /api/studio/publish (after upload)
                 │                              │
                 └──────────────┬───────────────┘
                                │
                 ┌──────────────▼───────────────┐
                 │   Vercel function            │
                 │   /api/studio/publish        │
                 │                              │
                 │   reads GH_DISPATCH_PAT      │
                 │   forwards repository_dispatch
                 └──────────────┬───────────────┘
                                │
                 ┌──────────────▼───────────────┐
                 │   GitHub Actions:            │
                 │   generate-galleries.yml     │
                 │                              │
                 │   npm run generate-galleries │
                 │   (Sharp → R2 → JSON)        │
                 │                              │
                 │   git commit + push to main  │
                 └──────────────┬───────────────┘
                                │
                 ┌──────────────▼───────────────┐
                 │   Vercel auto-deploys        │
                 │   vflics.com updates         │
                 └──────────────────────────────┘
```

Vercel's runtime surface area is intentionally tiny: `/api/contact`, `/api/revalidate`, `/api/studio/publish`. Zero Studio secrets sit on Vercel anymore (the old `STUDIO_UPLOAD_TOKEN` gate is gone — see commit `58c8136`).

## Public OAuth client IDs (safe to reference in code)

- **Desktop / Tauri**: `545350887333-cicbneumq1aud1qej9la8c465nmi16oj.apps.googleusercontent.com`
- **iOS**: `545350887333-3h1qjmaqcuonifts783hsgc5rakk0idc.apps.googleusercontent.com`

Tauri client secret is not in code — read from `OAUTH_CLIENT_SECRET` at compile time via `option_env!`. iOS client uses a public-client redirect-scheme flow and has no secret.
