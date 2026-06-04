# app/ — Next.js site + variant pipeline + Tauri wrapper

This is the npm-managed root of the project. The Next.js public site, the image-variant build pipeline (`scripts/`), and the Tauri desktop wrapper (`src-tauri/`) all live here.

For the project's overall architecture, the auto-publish loop, and the iOS app see the [repo-root README](../README.md). This file just covers the dev-loop inside `app/`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on http://localhost:3000 (Turbopack) |
| `npm run build` | Production build. Includes typecheck + lint. |
| `npm run start` | Serve a production build locally |
| `npm run lint` | ESLint over `src/` |
| `npm run generate-galleries` | Drive → Sharp → R2 → JSON pipeline. Manual entry point; the same script runs in GitHub Actions on every Studio push |
| `npm run generate-covers` | Regenerates the gallery cover thumbnails (separate pipeline; not part of auto-publish) |
| `npm run generate-about` | Regenerates the About-page portrait variants (same) |
| `npm run tauri:dev` | Open the Tauri window pointing at the site (see [src-tauri/README.md](src-tauri/README.md)) |
| `npm run tauri:build` | Bundle the Tauri `.app`. Requires `OAUTH_CLIENT_SECRET=...` in env. |

---

## Routes

| Path | Type | Purpose |
|---|---|---|
| `/` | Static | Hero + featured galleries |
| `/about` | ISR (1h) | About page |
| `/contact` | Static | Contact form (calls `/api/contact`) |
| `/gallery` | ISR (1h) | Gallery index |
| `/gallery/[slug]` | SSG | Per-gallery masonry page; reads `src/generated/gallery-{slug}.json` |
| `/studio` | Static | Upload Studio UI. Renders an "use the desktop app" empty state in browsers; the Tauri window loads this page and runs the OAuth + Drive upload flow. |
| `/api/contact` | Dynamic | Contact form handler (rate-limited; verifies Turnstile) |
| `/api/revalidate` | Dynamic | ISR revalidate webhook |
| `/api/studio/publish` | Dynamic | Studio publish trigger. Forwards a `repository_dispatch` to GitHub Actions, which runs `npm run generate-galleries` and commits back to `main`. Rate-limited 5/min/IP. |

---

## Where the gallery data lives

- **Originals**: Google Drive folders (one per category), owned by the photographer's Google account
- **Variants (AVIF + WebP, four sizes each + a 24px base64 webp LQIP)**: Cloudflare R2 bucket, at `pub-bd79df0de9c640f7a1e7e492d578ae53.r2.dev/galleries/{slug}/...`
- **Metadata (which images, their dimensions, R2 URLs, LQIP blob)**: `src/generated/gallery-{slug}.json`. Committed to git; updated by the auto-publish workflow or by running `npm run generate-galleries` locally.
- **Manifest cache (per-image `modifiedTime` for skip-unchanged)**: `scripts/.manifests/gallery-{slug}.json`. Also committed.

Vercel deploys ship just the JSON. The build does no image work.

---

## Dev loop for site features

```bash
cd app
npm install
npm run dev
# edit src/, see changes hot-reload at localhost:3000
```

For the **Studio UI**, the page renders as an empty state in a regular browser (`!isTauri()` early-return in `src/app/studio/StudioApp.tsx`). To actually exercise the upload flow you have to run it under Tauri:

```bash
cd app
npm run tauri:dev
```

The Tauri window's URL is set in `src-tauri/tauri.conf.json#devUrl`. Default points at `https://vflics.com/studio` (the production page); if you want to run against your local dev server, copy `tauri.conf.json` to `tauri.conf.local.json` and set `devUrl` to `http://localhost:3000/studio`.

---

## When making changes

- **Site UI**: just edit `src/`, watch hot reload. `npm run build` to verify production builds before committing.
- **`/api/studio/publish` or the GH Actions workflow**: see [tasks/remaining/06-autopublish-setup.md](../tasks/remaining/06-autopublish-setup.md) for the full pipeline + failure modes.
- **Tauri Rust commands** (`src-tauri/src/oauth.rs`): need to re-bundle with `npm run tauri:build`. Adding a new command also requires a new entry in [src-tauri/permissions/oauth.toml](src-tauri/permissions/oauth.toml) and granted in [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json).
- **Sharp variant pipeline** (`scripts/generate-gallery-data.ts`): runs locally with `npm run generate-galleries`. The same script runs in CI; if something doesn't work in CI but works locally, check `normalizeEnv()` handling (env var quoting differs between GitHub Secrets and dotenv).
