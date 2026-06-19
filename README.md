# Photography Portfolio

Production portfolio site for vflics photography. Public site at **[vflics.com](https://vflics.com)**.

This repo contains everything: the Next.js site, the image variant pipeline, the authenticated web **Upload Studio**, the Supabase backend, and the GitHub Actions auto-publish loop that ties them together.

---

## What's here

| Surface | Path | Purpose |
|---|---|---|
| Public site | [app/](app/) | Next.js 16 / React 19 portfolio at vflics.com (statically exported) |
| Image pipeline | [app/scripts/generate-gallery-data.ts](app/scripts/) | Reads originals from Supabase Storage, runs Sharp to produce AVIF + WebP at four sizes + a base64 LQIP, uploads to Cloudflare R2, and writes the build-time JSON |
| Backend API | [app/src/app/api/](app/src/app/api/) | Contact form + ISR revalidate + Studio publish trigger |
| Upload Studio | [app/src/app/studio/](app/src/app/studio/) | Authenticated web app (installable PWA) for composing projects + uploading photos. Passkey / password sign-in, locked to the owner |
| Supabase backend | — | Postgres (`projects`, `images`, `site_settings`, `gear`, `admin_emails`) + a private `originals` Storage bucket, behind an admin-allowlist RLS policy |
| Auto-publish workflow | [.github/workflows/](.github/workflows/) | Runs `npm run generate-galleries` and commits the resulting JSON back to main; fires automatically after every Studio publish |

---

## Architecture

### Read path (the public site)

```
Supabase Storage (originals — RAW source of truth)
        │
        │ scripts/generate-gallery-data.ts  (npm run generate-galleries)
        │ reads projects/images rows + downloads originals
        ▼
Sharp variant pipeline (4 sizes × 2 formats per image + 24px base64 webp LQIP)
        │
        ├─→ Cloudflare R2 bucket — binary variants
        │   served at pub-bd79df0de9c640f7a1e7e492d578ae53.r2.dev/galleries/{slug}/...
        │
        └─→ app/src/generated/*.json  (projects.json, project-{slug}.json, hero.json,
            about-image.json) — metadata + R2 URLs + LQIPs
                        │
                        ▼
                  next build → Vercel → vflics.com
```

Vercel deploys do **zero image work**. All variants exist on R2 before deploy; the build just ships React + small JSON manifests. The pipeline is incremental — it keys each image on its Storage file token (eTag), so a rebuild only re-processes photos whose bytes actually changed.

### Write path (Studio → site, end to end)

```
Upload Studio (web / installable PWA) at vflics.com/studio
        │
        │ 1. Passkey / password sign-in (Supabase Auth; owner-only via admin allowlist)
        │ 2. Compose a project; upload originals straight to Supabase Storage,
        │    write projects/images rows (browser client, RLS-enforced)
        ▼
Supabase (Postgres rows + private `originals` bucket)
        │
        │ 3. Studio POSTs to /api/studio/publish on Vercel
        ▼
Vercel function /api/studio/publish
        │
        │ 4. Forwards a repository_dispatch event to GitHub
        │    (Authorization: Bearer GH_DISPATCH_PAT)
        ▼
GitHub Actions: generate-galleries workflow
        │
        │ 5. npm ci + npm run generate-galleries
        │    (reads Supabase, builds variants for any changed photo, uploads to R2,
        │     regenerates app/src/generated/*.json + app/scripts/.manifests/*)
        │
        │ 6. git commit + push to main if anything changed
        ▼
Vercel auto-deploys the new commit → vflics.com updates
```

End user experience: publish from the Studio → wait 2–6 minutes → the site shows the new photos. No terminal, no manual `git push`.

---

## The Upload Studio

A single authenticated web app at **vflics.com/studio**, installable as a PWA (Add to Home Screen / Install app) so it behaves like a desktop/mobile app without a native binary.

- **Auth:** Supabase passkey (WebAuthn — Face ID / Touch ID / security key) with a password fallback. Sign-in is locked to the owner via an `admin_emails` allowlist enforced by fail-closed RLS; the build reads via the service-role key.
- **Compose:** create projects, drag-and-drop photos, reorder (marquee + group drag-select, ⌘A / ⌘D, Shift-click ranges), set a cover, edit per-image caption + camera/lens/settings (auto-filled from EXIF, with a saved-gear picker), and pick the home hero / about image.
- **Publish:** uploads originals to Supabase Storage, writes the rows, then triggers the rebuild. Saved projects can be re-published (reorders/deletes save live); site-settings changes surface a "Rebuild site →" action.

Source: [app/src/app/studio/](app/src/app/studio/).

---

## Adding new photos (the canonical workflow)

```
1. Sign in to vflics.com/studio (passkey or password).

2. Create a project: name it, add photos, set a cover, tweak metadata.

3. Click Publish. The Studio uploads to Supabase and triggers the rebuild.

4. ≈ 2–6 minutes later, the photos appear at vflics.com/gallery/<slug>.
```

Manual fallback (debugging, or if GitHub Actions is down): run `npm run generate-galleries` locally with the env below, then `git push`. The Action does exactly the same thing.

---

## Repo layout

```
.
├── .github/workflows/                   GH Actions auto-publish loop
│
├── app/                                 Next.js 16 site (npm root)
│   ├── src/
│   │   ├── app/
│   │   │   ├── studio/                  Upload Studio UI (auth, compose, publish)
│   │   │   ├── api/studio/publish/      Publish trigger → GitHub repository_dispatch
│   │   │   ├── api/contact/             Contact form handler
│   │   │   └── api/revalidate/          ISR revalidate webhook
│   │   ├── components/
│   │   │   ├── gallery/                 GalleryIndex, ProjectSequence, EditorialLightbox
│   │   │   ├── layout/                  Navbar, Footer, HamburgerMenu
│   │   │   ├── home/                    HomeView
│   │   │   ├── analytics/               AnalyticsGate (public-site-only Vercel analytics)
│   │   │   └── forms/                   ContactForm
│   │   ├── generated/                   Build-time gallery JSON (committed; updated by Action)
│   │   ├── lib/
│   │   │   ├── supabase/                Browser + service-role clients
│   │   │   ├── studio/                  Ingest, publish, remote read helpers, lens/EXIF
│   │   │   └── rate-limit.ts            Used by /api/studio/publish
│   │   └── types/
│   ├── scripts/
│   │   ├── generate-gallery-data.ts     The variant pipeline (Supabase → Sharp → R2 → JSON)
│   │   ├── set-admin-password.ts        Bootstrap the admin password
│   │   └── .manifests/                  Per-project Storage-token cache (committed)
│   └── public/                          Static assets (about, fonts, PWA icons/manifest)
│
└── tasks/                               Task notes, redesign plan, ops + archive
```

---

## Environment variables

Three places: your local `.env.local`, GitHub Actions secrets (for the auto-publish workflow), and Vercel (for the Studio + publish trigger). Setup details in [tasks/ops-autopublish-setup.md](tasks/ops-autopublish-setup.md).

**Vercel (production runtime):**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public Supabase config for the Studio browser client
- `GH_DISPATCH_PAT` — fine-scoped GitHub PAT with `Contents: write` on this repo
- `GH_DISPATCH_REPO` — `Vsingh70/Photography-Portfolio`

**GitHub Actions secrets (used by the auto-publish workflow):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — read projects/images + download originals from Storage
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — Cloudflare R2 write credentials
- `NEXT_PUBLIC_GALLERY_CDN_BASE` — the R2 public URL, baked into generated JSON
- `GH_DISPATCH_PAT` — also needed here so the workflow can `git push` its commits back to main

**Local `.env.local` (for manual `npm run generate-galleries`):**
- Same Supabase (URL + service role) + R2 + CDN vars as the Action
- `SUPABASE_SERVICE_ROLE_KEY` is secret — it lives only in `.env.local` (gitignored), GitHub Actions, and Vercel; never commit it.

---

## Local dev

```bash
cd app
npm install
npm run dev          # site at localhost:3000; Studio at localhost:3000/studio
```

The Studio runs in any browser at `/studio`. Note: passkeys are bound to the live domain, so register and use them on vflics.com; locally, sign in with the password.

---

## Stack

- **Site:** Next.js 16 (App Router, Turbopack) + React 19 + Tailwind 4 (statically exported)
- **Images:** Sharp (build time) + AVIF/WebP `<picture>` with srcset + Cloudflare R2 + 24px base64 LQIP blur-up
- **Type:** Cormorant Garamond (display, italic) + DM Mono (captions, small-caps) + Geist (system)
- **Animations:** Framer Motion + `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) everywhere
- **Lightbox:** Custom `EditorialLightbox` · **Layout:** custom flex masonry
- **Studio:** Supabase Auth (passkey + password) + RLS admin allowlist; browser client for writes, service-role for the build
- **Build pipeline:** Supabase JS + AWS S3 SDK against R2 (run by GH Actions on dispatch)
- **Backend (runtime):** Vercel + Next.js API routes (contact, revalidate, studio/publish)
- **CDN:** Vercel (HTML/JS/CSS) + Cloudflare R2 (image variants)
```
