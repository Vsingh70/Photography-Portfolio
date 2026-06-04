# Task 06 — Auto-publish: manual setup for the Studio → GitHub Actions pipeline

**Depends on**: nothing committed yet
**Blocks**: end-to-end testing of automatic publishing
**Estimated effort**: 20–30 min (mostly clicking through dashboards)

## What this connects

The code is already shipped (commits land in this same session):

- [.github/workflows/generate-galleries.yml](../../.github/workflows/generate-galleries.yml) — Action that runs `npm run generate-galleries`, then commits + pushes the resulting JSON / manifests
- [app/src/app/api/studio/publish/route.ts](../../app/src/app/api/studio/publish/route.ts) — Vercel function that forwards a `repository_dispatch` to GitHub when called
- Studio clients (Tauri + iOS) both POST to `/api/studio/publish` after Drive uploads complete

What the code can't do without your help:

- It can't create the GitHub PAT (that requires your account)
- It can't paste the Drive/R2 credentials into GitHub Actions secrets
- It can't set `GH_DISPATCH_PAT` on Vercel

Without these three setups, the publish endpoint will return a 503 ("Server not configured") and the Studio will show "Pushed (publish failed)" while still successfully uploading to Drive.

## Step 1 — Create a GitHub PAT

Go to https://github.com/settings/personal-access-tokens/new

- **Token name**: `vflics-publish` (or anything memorable)
- **Resource owner**: your personal account (whoever owns `Vsingh70/Photography-Portfolio`)
- **Expiration**: 1 year is fine; you can rotate at any time without touching code
- **Repository access**: **Only select repositories** → pick **`Vsingh70/Photography-Portfolio`** (not "All repositories")
- **Repository permissions**: scroll the list and grant:
  - **Contents**: Read and write (required — the workflow pushes commits)
  - **Metadata**: Read-only (auto-included)
- All other permissions: leave at "No access"

Click **Generate token**. **Copy it immediately** — GitHub won't show it again.

The token will look like `github_pat_11AABBC...` (roughly 90 characters).

Save it to your password manager. You'll paste it into Vercel in step 3 and never again.

## Step 2 — Populate GitHub Actions secrets

Go to https://github.com/Vsingh70/Photography-Portfolio/settings/secrets/actions

For each row below, click **New repository secret**, type the name, paste the value from your local `.env.local`. **All values are the same as your existing local environment**, so just copy them across.

| Secret name | Source (`.env.local` line) |
|---|---|
| `GOOGLE_DRIVE_CLIENT_EMAIL` | identical line |
| `GOOGLE_DRIVE_PRIVATE_KEY` | identical line (including `\n` escapes; GitHub stores it verbatim) |
| `GOOGLE_DRIVE_EDITORIAL_FOLDER_ID` | identical line |
| `GOOGLE_DRIVE_PORTRAITS_FOLDER_ID` | identical line |
| `GOOGLE_DRIVE_GRADUATION_FOLDER_ID` | identical line |
| `GOOGLE_DRIVE_ENGAGEMENT_FOLDER_ID` | identical line |
| `GOOGLE_DRIVE_EVENTS_FOLDER_ID` | identical line |
| `R2_ACCOUNT_ID` | identical line |
| `R2_ACCESS_KEY_ID` | identical line |
| `R2_SECRET_ACCESS_KEY` | identical line |
| `R2_BUCKET` | identical line |
| `NEXT_PUBLIC_GALLERY_CDN_BASE` | identical line |
| `GH_DISPATCH_PAT` | the PAT you just created in step 1 |

That's 13 secrets. After adding them, the secrets list should show 13 rows. None of the values are recoverable from the GitHub UI after save — they can only be replaced.

## Step 3 — Set Vercel env vars

Go to https://vercel.com/dashboard → select **Photography-Portfolio** → **Settings → Environment Variables**.

Add two:

| Name | Value | Environments |
|---|---|---|
| `GH_DISPATCH_PAT` | the same PAT from step 1 | Production |
| `GH_DISPATCH_REPO` | `Vsingh70/Photography-Portfolio` | Production |

After adding both, **redeploy from the Deployments tab** (the env vars only apply to deploys created *after* they're added).

## Step 4 — Verify end-to-end

After the redeploy goes live, do a small test push:

1. Open the rebuilt Tauri `.app`
2. Sign in if needed
3. Create a set with **one** test photo (use a destination you don't mind cluttering, like a fresh test folder if you have one)
4. Push to Drive

Expected sequence in the modal:

- "Uploading… Set 1 of 1 · Photo 1 of 1"
- "Publishing… Triggering the gallery rebuild." (a few seconds)
- "Pushed · All sets are on their way. The site will rebuild in 2–6 minutes."

Then check:

1. **GitHub Actions**: https://github.com/Vsingh70/Photography-Portfolio/actions → there should be a new "Generate Galleries" run, triggered by `repository_dispatch`
2. **The run logs**: should show `npm run generate-galleries` listing 1 new image, building variants, uploading to R2
3. **A new auto-commit** appears on main with message like `chore(galleries): auto-update from generate-galleries (editorial)`
4. **Vercel** auto-deploys from that commit (visible in the Vercel dashboard's Deployments tab)
5. **The site** at vflics.com/gallery/editorial shows the new photo within ~2 minutes of the auto-commit

## Failure modes and what they look like

| In the modal | Meaning | Fix |
|---|---|---|
| "Publish trigger HTTP 503" | Vercel doesn't have `GH_DISPATCH_PAT` / `GH_DISPATCH_REPO` | Add them, redeploy |
| "Publish trigger HTTP 502" with "GH_DISPATCH_PAT scope" message | PAT doesn't have Contents: Read+Write on this repo | Recreate the PAT with the right scope |
| "Publish trigger HTTP 429" | Hit rate limit (5/min/IP) | Wait a minute |
| "Photos are in Drive" but the Action never appears in GitHub | Dispatch sent but workflow filter doesn't match | Verify `event_type: studio-publish` matches the workflow's `repository_dispatch.types` |
| Action runs but fails | Probably a missing GH Actions secret | Read the run log; the failing step prints which env var is missing |

## Rotating the PAT

Every year or whenever you suspect a leak:

1. Create a new PAT (step 1)
2. Update `GH_DISPATCH_PAT` on Vercel (step 3)
3. Redeploy
4. Optionally delete the old token in GitHub Settings

Studio clients don't need to be rebuilt — they don't carry the PAT.

## What this gets you

- Push photos from Tauri or iOS
- Hands-off variant generation + site deploy
- 2–6 min from push to public URL
- No more `cd app && npm run generate-galleries && git push` after every Studio session
