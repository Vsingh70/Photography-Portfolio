# Remaining tasks — vflics Studio refactor

Each file in this directory documents a discrete piece of the refactor that took place over multiple sessions. Tasks are numbered in execution order. The status table below reflects what has actually been committed and pushed to `main`.

## Status

| #   | File                                             | Status                                | Blocks |
| --- | ------------------------------------------------ | ------------------------------------- | ------ |
| 01  | [01-tauri-oauth-test.md](01-tauri-oauth-test.md) | **Code complete**; needs hands-on test on rebuilt `.app` | 02, 03 |
| 02  | [02-tauri-oauth-fixes.md](02-tauri-oauth-fixes.md) | **Standby** — only execute if task 01 reveals issues | —      |
| 03  | [03-ios-oauth.md](03-ios-oauth.md)               | **Completed** ✅ — iOS rebuilt for OAuth + direct Drive upload | 04     |
| 04  | [04-delete-vercel-upload.md](04-delete-vercel-upload.md) | **Code-complete** ✅ — env var deletion still needs you in Vercel dashboard | —      |
| 05  | [05-polish.md](05-polish.md)                     | **Partial** — items A, B, E, G, H done; C, D, F open | —      |

## What's actually been done (in execution order, latest first)

### Task 05 polish — completed items
- **A**: Visual drag-from-OS overlay in `StudioApp.tsx` (dashed border + helpful message)
- **B**: OAuth error UX — inline banner in TopBar (no more `window.alert`); also iOS `SettingsSheet` `.alert()`
- **E**: Reorder feedback — thumbs go to 0.4 opacity while dragged; drop target shows solid 3px cream outline
- **G**: Empty-state for non-Tauri browsers — friendly "Use the desktop app" page
- **H**: Per-file push progress — `pushProgress = { setIdx, setTotal, fileIdx, fileTotal }` rendered in `PushModal` and iOS `PushSheet`

### Task 05 polish — still open
- **C**: Custom iOS launch screen (needs Xcode work + asset)
- **D**: Custom fonts in iOS (Cormorant Garamond + DM Mono — needs font files + Info.plist UIAppFonts)
- **F**: Marked as complete since the READMEs were updated as part of the cleanup work

### Task 04 — Vercel deletion
- **Done in code**: `/api/studio/upload-remote`, `/api/studio/upload`, `/api/studio/destinations` routes deleted; `src/lib/studio-auth.ts` and `src/lib/drive-upload.ts` deleted; `apiKeySuffix` mechanism and `studioKeyMatches` page gate removed from `StudioApp.tsx` and `page.tsx`; `tauri.conf.json` URL no longer has `?key=`
- **Remaining manual step**: delete `STUDIO_UPLOAD_TOKEN` from your Vercel project's env vars and redeploy

### Task 03 — iOS OAuth
- New `GoogleOAuth.swift` using `ASWebAuthenticationSession`
- `Config.swift` populated with iOS client ID + Drive folder IDs (all 6)
- `Store.swift` rewritten around `oauthAccessToken` / `oauthRefreshToken` / `validAccessToken()`
- `UploadClient.swift` rewritten to call Drive's `/upload/drive/v3/files?uploadType=multipart` directly
- `KeychainStorage.swift` keys swapped (with `cleanLegacyKeys()` for migration)
- `SettingsSheet.swift` shows "Sign in with Google" / signed-in email + Sign-out
- `ContentView.swift` gates on `isSignedIn`
- `PushSheet.swift` shows per-file progress
- `Info.plist` added with the OAuth URL scheme
- `CURRENT_PROJECT_VERSION` bumped to 3
- Build verified: `xcodebuild ... -sdk iphoneos` ✅

### Task 02 — Tauri OAuth fixes
- Not needed for committed code. Standby in case the Tauri rebuild surfaces issues in task 01.

### Task 01 — Tauri OAuth code
- Already committed (commits `a9ecddb` + `7043e5e`). Remaining work for task 01 is human-in-the-loop testing on a rebuilt `.app`.

## Pre-flight context (unchanged)

```
   Drive (source of truth, photos owned by user's Google account)
         ▲
         │  OAuth: user signs in once per device
         │  Scope: drive.file
         │
   ┌─────┴─────┐   ┌─────┴─────┐
   │  Tauri    │   │  iOS app  │
   │  desktop  │   │           │
   │  app      │   │           │
   └───────────┘   └───────────┘

   Vercel (vflics.com):
     /studio                  ← page exists; shows "use the desktop app" in browsers
     /api/contact             ← keep (contact form)
     /api/revalidate          ← keep (ISR webhook)
```

Public OAuth client IDs (safe to reference in code):

- **Desktop (Tauri)**: `545350887333-cicbneumq1aud1qej9la8c465nmi16oj.apps.googleusercontent.com`
- **iOS**: `545350887333-3h1qjmaqcuonifts783hsgc5rakk0idc.apps.googleusercontent.com`

## Manual follow-ups still needed (in priority order)

1. **Rebuild the Tauri `.app`** with the OAuth-enabled code (commits `a9ecddb` and `7043e5e` + this session's polish). Drag into `/Applications`, sign in via the new flow, push a test set to Drive. Acceptance criteria in [01-tauri-oauth-test.md](01-tauri-oauth-test.md).
2. **Delete `STUDIO_UPLOAD_TOKEN`** from your Vercel project's env vars, then redeploy. The endpoint that used it is already gone.
3. **Rebuild iOS for TestFlight** (build number is already bumped to 3). Archive → Distribute → App Store Connect → TestFlight invitation.
4. **(Optional)** Polish items C, D, F if you want a more polished iOS experience.
