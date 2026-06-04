# Remaining tasks — vflics Studio refactor

Each file in this directory is a single discrete task with enough context for Claude to execute it end-to-end with `--dangerously-skip-permissions` enabled. Tasks are numbered in suggested execution order. Skip / reorder as needed — each file documents its own dependencies.

## Order

| #   | File                                             | Status   | Blocks                  |
| --- | ------------------------------------------------ | -------- | ----------------------- |
| 01  | [01-tauri-oauth-test.md](01-tauri-oauth-test.md) | Pending  | 02, 03, 04              |
| 02  | [02-tauri-oauth-fixes.md](02-tauri-oauth-fixes.md) | Pending  | 03                      |
| 03  | [03-ios-oauth.md](03-ios-oauth.md)               | Pending  | 04                      |
| 04  | [04-delete-vercel-upload.md](04-delete-vercel-upload.md) | Pending | —              |
| 05  | [05-polish.md](05-polish.md)                     | Optional | —                       |

## Snapshot of what's done vs. pending

### Done (committed and pushed to `main`)

- `a9ecddb` — Tauri `dragDropEnabled: false` so the webview handles file drops
- `7043e5e` — Tauri OAuth scaffolding: Rust commands (`start_oauth`, `signed_in_email`, `sign_out`, `upload_to_drive`) + TypeScript wrapper + StudioApp UI changes (sign-in pill, two-path `performPush`)
- `1c29af8` — Inline delete-set confirmation (replaces `window.confirm` which Tauri suppresses)
- `ec85b02` — iOS app icon + drag-to-reorder + signing wired

### Pending

- **OAuth end-to-end test on a rebuilt Tauri binary** (task 01) — the code is committed but the `.app` hasn't been rebuilt, so nothing is testable yet. Highest risk of surprises.
- **iOS native OAuth + Drive upload** (task 03) — iOS still uses the Vercel `/api/studio/upload-remote` path, which still works but is going away.
- **Delete obsolete Vercel paths** (task 04) — `/api/studio/upload-remote`, `/api/studio/upload`, `/lib/studio-auth.ts`, `/lib/drive-upload.ts`, and the `STUDIO_UPLOAD_TOKEN` env var. Only safe after both clients are confirmed working.
- **Polish** (task 05) — drag-from-OS visual feedback, sign-in error UX, launch screen, README updates.

## Pre-flight context

Architecture overview of what we're building toward (after all tasks complete):

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
     /studio                  ← page still exists, but only useful inside Tauri
     /api/studio/destinations ← keep (returns folder IDs, used by both clients)
     /api/studio/upload       ← DELETE (Tauri now uploads directly)
     /api/studio/upload-remote ← DELETE (iOS will too, post-task-03)
     /lib/drive-upload.ts     ← DELETE
     /lib/studio-auth.ts      ← DELETE
     STUDIO_UPLOAD_TOKEN env   ← REMOVE from Vercel project settings
```

Public OAuth client IDs (safe to reference in code):

- **Desktop (Tauri)**: `545350887333-cicbneumq1aud1qej9la8c465nmi16oj.apps.googleusercontent.com`
- **iOS**: `545350887333-3h1qjmaqcuonifts783hsgc5rakk0idc.apps.googleusercontent.com`

## How to hand a task to Claude

```
Implement tasks/remaining/01-tauri-oauth-test.md end to end. Stop and ask
if you hit any decision the task doc didn't anticipate.
```

Or with `--dangerously-skip-permissions`:

```
Read tasks/remaining/01-tauri-oauth-test.md and execute it. Commit and
push when verified working.
```
