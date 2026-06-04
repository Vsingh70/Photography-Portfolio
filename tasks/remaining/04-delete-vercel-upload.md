# Task 04 — Delete the obsolete Vercel upload paths

**Depends on**: 01, 03 (both clients confirmed working with direct Drive upload)
**Blocks**: nothing
**Estimated effort**: 45 min
**Risk**: Low if 01 and 03 are confirmed; medium otherwise. The deletion is destructive.

## When to use this task

ONLY after **both** of these are confirmed end-to-end:

- Tauri desktop binary uploads to Drive directly (task 01 acceptance criteria)
- iOS app uploads to Drive directly (task 03 acceptance criteria)

If either client still uses `/api/studio/upload-remote`, **do not** execute this task — it will break that client.

## What to delete

### Code files

```bash
git rm app/src/app/api/studio/upload-remote/route.ts
git rm app/src/app/api/studio/upload/route.ts
git rm app/src/lib/studio-auth.ts
git rm app/src/lib/drive-upload.ts
```

### Code references to clean up

In `app/src/app/api/studio/destinations/route.ts`: this route may stay. Verify whether Tauri or iOS still call it for folder-ID resolution. After task 03 hardcodes folder IDs into `Config.swift`, this endpoint is unused.

If unused: `git rm app/src/app/api/studio/destinations/route.ts` and delete the now-empty parent directory.

In `app/src/app/studio/StudioApp.tsx`:

- Remove the `apiKeySuffix` constant and all its uses
- Remove the `else` branch in `performPush` that calls `/api/studio/upload` (the Tauri-path is now the only path)
- Remove the `useEffect` that fetches `/api/studio/destinations` if that endpoint was removed
- Update the file header comment to drop references to the Vercel endpoint

In `app/src/app/studio/page.tsx`:

- The `studioKeyMatches` check (against `STUDIO_UPLOAD_TOKEN`) was the only auth gate. The page itself can now be either: (a) public and let unauthenticated visitors see an empty Studio (graceful), or (b) gated on Tauri detection (visitors get redirected to a "use the desktop app" page).

Pick (a) if you want the page accessible from anywhere; (b) if you don't want random visitors hitting the page. Discuss with the user before deciding.

In `ios/vflics-studio/vflics-studio/Config.swift`:

- Remove the now-unused `endpointURL`
- The `oauthClientID` / `destinationFolderIDs` from task 03 remain

In `ios/vflics-studio/vflics-studio/KeychainStorage.swift`:

```swift
enum Key: String {
    case endpointURL    // DELETE this case
    case authToken      // DELETE this case
    case oauthAccessToken
    case oauthRefreshToken
    case oauthEmail
    case oauthExpiresAt
}
```

After deleting, also delete the migration writes for the old keys (if any leftover from task 03).

In `ios/vflics-studio/vflics-studio/Models.swift`:

- `ServerDestinationsResponse` — DELETE
- `ServerDestination` — DELETE
- `UploadResponse` / `UploadedFile` — DELETE if they're not used elsewhere

### Vercel project settings

Open the Vercel dashboard → vflics-photography project → Settings → Environment Variables:

- **DELETE** `STUDIO_UPLOAD_TOKEN`

Trigger a redeploy from the Deployments tab so the env-var removal takes effect.

### tauri.conf.local.json

The local Tauri config currently has `?key=<token>` in its URL. After this task:

- Update `tauri.conf.json` and `tauri.conf.local.json` so the window URL is `https://vflics.com/studio` (no `?key=` suffix)
- Re-build the Tauri app
- Re-install

## Verification

After all deletions:

1. `grep -rn 'STUDIO_UPLOAD_TOKEN\|upload-remote\|studio-auth\|drive-upload' app src ios | grep -v '\.md'` should return nothing
2. `npm run build` in `app/` should succeed
3. `xcodebuild -project ios/vflics-studio/vflics-studio.xcodeproj -scheme vflics-studio build` should succeed
4. `cd app && cargo check` (with `. "$HOME/.cargo/env"` first) should succeed
5. Re-run the Tauri end-to-end test from task 01 — push to Drive should still work
6. Re-run the iOS end-to-end test from task 03 — push to Drive should still work

## Commit + push

Single descriptive commit:

```
chore(studio): delete Vercel upload paths now that both clients upload directly

Removed:
- /api/studio/upload-remote and /api/studio/upload routes
- src/lib/studio-auth.ts and src/lib/drive-upload.ts
- STUDIO_UPLOAD_TOKEN env var (deleted from Vercel project settings)
- iOS endpointURL / authToken keychain keys
- iOS ServerDestinationsResponse etc

Both Tauri and iOS now upload directly to Drive via the user's OAuth
token (drive.file scope). Vercel only serves the static gallery + the
deployed /studio page.
```

## Acceptance criteria

- [ ] All listed files deleted
- [ ] All listed references in StudioApp.tsx / Config.swift / KeychainStorage.swift / Models.swift cleaned up
- [ ] `STUDIO_UPLOAD_TOKEN` removed from Vercel env vars + project redeployed
- [ ] Tauri push works after rebuild
- [ ] iOS push works after rebuild
- [ ] No grep hits for the deleted symbols anywhere in `app/`, `ios/`
