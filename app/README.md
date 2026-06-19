# app/ — Next.js site + variant pipeline + Upload Studio

This is the npm-managed root of the project. The Next.js public site, the image-variant build pipeline (`scripts/`), and the authenticated web Upload Studio (`src/app/studio/`) all live here.

For the project's overall architecture and the auto-publish loop, see the [repo-root README](../README.md). This file covers the dev loop inside `app/`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on http://localhost:3000 (Turbopack) |
| `npm run build` | Production build. Includes typecheck + lint. |
| `npm run start` | Serve a production build locally |
| `npm run lint` | ESLint over `src/` |
| `npm run test` | Vitest unit tests |
| `npm run generate-galleries` | Supabase → Sharp → R2 → JSON pipeline. Manual entry point; the same script runs in GitHub Actions on every Studio publish. Also regenerates the hero + about images from `site_settings`. |
| `npm run set-admin-password` | Bootstrap / reset the admin password (service-role; see `scripts/set-admin-password.ts`) |

---

## Routes

| Path | Type | Purpose |
|---|---|---|
| `/` | Static | Cinematic hero + Selected Work index |
| `/about` | Static | About page |
| `/contact` | Static | Contact form (calls `/api/contact`) |
| `/gallery` | Static | Project index |
| `/gallery/[slug]` | SSG | Per-project sequence page; reads `src/generated/project-{slug}.json` |
| `/studio` | Client | Authenticated Upload Studio (passkey / password). Composes projects, uploads to Supabase, triggers the rebuild. Installable as a PWA. |
| `/api/contact` | Dynamic | Contact form handler (rate-limited; verifies Turnstile) |
| `/api/revalidate` | Dynamic | ISR revalidate webhook |
| `/api/studio/publish` | Dynamic | Studio publish trigger. Forwards a `repository_dispatch` to GitHub Actions, which runs `npm run generate-galleries` and commits back to `main`. Rate-limited 5/min/IP. |

---

## Where the gallery data lives

- **Originals**: Supabase Storage (`originals` bucket, private), keyed by image UUID under `{slug}/`. The photographer uploads via the Studio.
- **Variants (AVIF + WebP, four sizes each + a 24px base64 webp LQIP)**: Cloudflare R2, at `pub-bd79df0de9c640f7a1e7e492d578ae53.r2.dev/galleries/{slug}/...`
- **Metadata (which images, dimensions, R2 URLs, LQIP, EXIF)**: `src/generated/projects.json` (index) + `project-{slug}.json` (per project) + `hero.json` / `about-image.json`. Committed to git; updated by the auto-publish workflow or by running `npm run generate-galleries` locally.
- **Manifest cache (per-image Storage file token for skip-unchanged)**: `scripts/.manifests/project-{slug}.json`. Also committed.

Vercel deploys ship just the JSON. The build does no image work; the pipeline is incremental on each image's Storage file token (eTag).

---

## Dev loop

```bash
cd app
npm install
npm run dev          # site at localhost:3000; Studio at localhost:3000/studio
```

The Studio runs in any browser at `/studio` — sign in with the password locally (passkeys are bound to the live vflics.com domain). It talks to Supabase directly (browser client, RLS-enforced) for reads/writes and to `/api/studio/publish` to trigger a rebuild.

---

## When making changes

- **Site UI**: edit `src/`, watch hot reload. `npm run build` to verify a production build before committing.
- **Studio** (`src/app/studio/`): the composer, auth, and publish flow. Drafts persist to `localStorage`; published projects load from Supabase.
- **`/api/studio/publish` or the GH Actions workflow**: see [tasks/ops-autopublish-setup.md](../tasks/ops-autopublish-setup.md) for the full pipeline + failure modes.
- **Sharp variant pipeline** (`scripts/generate-gallery-data.ts`): runs locally with `npm run generate-galleries`. The same script runs in CI; if something works locally but not in CI, check the env var handling (quoting differs between GitHub Secrets and dotenv).
