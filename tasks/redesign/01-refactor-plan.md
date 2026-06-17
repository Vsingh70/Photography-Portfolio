# Refactor Plan — Drive → Supabase, Studio → Web/PWA

**Audience:** Claude Code (implementation). **Companion:** [`00-editorial-redesign-roadmap.md`](00-editorial-redesign-roadmap.md) (strategy + rationale).
**Status:** Backend + Studio sections are ready to build now (design-independent). The **frontend/visual** section (§7) is **stubbed** — it depends on the Phase 3 Claude-design output and must not be implemented until those designs exist.

---

## 0. Non-negotiables (read first)

1. **The public site stays a static export** (`next build` → Vercel). Do not introduce runtime DB calls on public pages. Supabase is a **write-time** (Studio) and **build-time** (pipeline) dependency only.
2. **Serving path is unchanged.** Visitor images continue to load from the **Cloudflare R2 CDN** as AVIF/WebP at four sizes with LQIP blur-up. Do not route visitor image requests through Supabase.
3. **Never break the only working uploader before its replacement is verified.** The native Tauri/iOS Studio is the current upload path. Delete it (§8) **only after** §3–§5 are built and a real publish is verified end-to-end through the new web Studio.
4. **Preserve performance.** No public-page regression vs. the baseline captured in roadmap Track A (LCP/CLS/INP). Add the baseline numbers here once measured.

---

## 1. Current state (what exists today)

- **Site:** Next.js 16 / React 19 static export on Vercel. Routes: `src/app/{page,about,contact,gallery,gallery/[slug],studio}`.
- **Serving:** R2 CDN (`pub-…r2.dev/galleries/{slug}/…`), variants built ahead of deploy. **KEEP.**
- **Pipeline:** `app/scripts/generate-gallery-data.ts` — reads originals from Google Drive (service account), Sharp → 4 sizes × {avif,webp} + base64 LQIP → uploads to R2 → writes `src/generated/gallery-{slug}.json`. Incremental via `scripts/.manifests/`.
- **Studio UI:** `src/app/studio/StudioApp.tsx` (~2,035 lines). Model: `UploadSet` (files staged for a genre `destination`), drag-reorder, thumbnails, push.
- **Native wrappers (to be deleted):** `src-tauri/` (Rust: `oauth.rs` ~409 LOC loopback Google OAuth, `main.rs`; ~2.7 GB build artifacts), `src/lib/tauri-oauth.ts` (63 LOC), `ios/` (~1,801 Swift LOC). All exist to do Google OAuth + direct Drive upload.
- **APIs:** `src/app/api/studio/publish/route.ts` (forwards `repository_dispatch` to GitHub — **KEEP, reshape source**), `api/contact`, `api/revalidate`.
- **Config:** `src/config/galleries.ts` (5 genres). `.github/workflows/generate-galleries.yml` runs the pipeline + commits.
- **Data model:** flat `gallery-{genre}.json` arrays. **REPLACE with `projects` + `images`.**
- **Frontend (already refactored toward the project model — KEEP, just re-source the data):**
  - `src/lib/projects.ts` — the data-access seam. `getWorkIndex()` + `getHeroCover()` feed the home + gallery pages. **This is the single swap point:** today it reads `cover-thumbnails.json` + a hardcoded `META` map; under Supabase it reads the generated `projects.json`. Pages don't change.
  - `src/components/home/HomeView.tsx`, `gallery/GalleryIndex.tsx`, `gallery/ProjectSequence.tsx` — the project-model UI is built. `gallery/[slug]/page.tsx` already renders `category` + `blurb` from `getWorkIndex()`.
  - **Hardcoded content to make editable (see §3.5):** hero (`getHeroCover` → editorial), project text (the `META` map), order (`META.order`), covers (`config/gallery-covers.ts` + `generate-covers`), about image (`generate-about` → `about-image.json`).

---

## 2. Target architecture

```
Web/PWA Studio (/studio, authenticated)
  │  Supabase Auth (single user)  ·  originals upload direct to Storage (resumable)
  │  writes projects + images rows to Postgres
  ▼
Supabase  ── Storage: originals (source of truth, + browse GUI)
          ── Postgres: projects, images (structure / metadata)
  │
  │  publish trigger → GitHub Action
  ▼
generate-gallery-data.ts  (reads originals from Storage + structure from Postgres)
  │  Sharp → 4 sizes × {avif,webp} + LQIP
  ▼
Cloudflare R2  ── derived variants (UNCHANGED serving path)
  ▼
Static Next.js export on Vercel → serves from R2 CDN  (UNCHANGED)
```

---

## 3. Supabase setup

> A Supabase MCP is connected — use it to create the project, run migrations, and generate types. Confirm whether a project already exists before creating one.

**3.1 Create the Supabase project — directions**

> No project exists yet. Either path works; the connected MCP is faster inside a Cowork/Claude session.

**Path A — via the connected Supabase integration (recommended in-session)**
1. Confirm the target **organization** with the user (`list_organizations`), then **create the project** (`create_project`) with: a name (e.g. `vflics`), the org, a **region** near the user / the Vercel build region, and a generated DB password (store it in the user's password manager).
2. Wait for provisioning to finish (`get_project` reports status `ACTIVE_HEALTHY`).
3. Run the schema migration from §3.2 (`apply_migration`).
4. Generate TypeScript types (`generate_typescript_types`) into `app/src/types/supabase.ts`.
5. Collect credentials: project URL (`get_project_url`) and the publishable/anon key (`get_publishable_keys`). Get the **service-role** key from the dashboard (Settings → API) — it is not exposed via MCP by design.

**Path B — manual, via the dashboard**
1. supabase.com → **New project**. Pick the org, name it `vflics`, choose a **region** near the user, set a strong DB password.
2. Once active, **SQL Editor** → paste and run the §3.2 schema.
3. **Settings → API** → copy the **Project URL**, the **anon/publishable** key, and the **service_role** key.
4. (Optional) install the Supabase CLI and run `supabase gen types typescript` for `app/src/types/supabase.ts`.

**Storage bucket (either path)**
- Create a **private** bucket named `originals`. Path convention: `originals/{project_slug}/{image_id}.{ext}`.
- Enable **resumable uploads** (tus) for large RAW/JPEG originals (Storage → settings, or via the resumable upload endpoint in the Studio client).

**Where the three keys go** (see §3.4 for the full list):
| Key | Secrecy | Goes in |
|---|---|---|
| Project URL | public | `app/.env.local` + Vercel env (`NEXT_PUBLIC_SUPABASE_URL`) |
| anon / publishable key | public | `app/.env.local` + Vercel env (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| **service_role key** | **secret** | **GitHub Actions secret + Vercel server env only** (`SUPABASE_SERVICE_ROLE_KEY`) — never in client code or `NEXT_PUBLIC_*` |

After this, §3.2 (schema) and §3.3 (auth/RLS) should already be applied; proceed to §4.

**3.2 Schema (DDL — adjust types as needed)**

```sql
create table projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,          -- shown as the project name
  category      text default '',         -- the kicker line, e.g. "Fashion · Portraiture" (req 3)
  blurb         text default '',         -- appears on BOTH gallery index + project page (req 3)
  cover_image_id uuid,                   -- chosen at upload from THIS project's images (req 2); FK below
  location      text,
  shot_date     date,
  sort_order    int  not null default 0, -- drag-orderable in the gallery index (req 5)
  published     boolean not null default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table images (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  storage_path  text not null,         -- path in the `originals` bucket
  alt           text default '',
  title         text default '',
  width         int,
  height        int,
  exif          jsonb default '{}',    -- {camera, lens, settings, date}
  sort_order    int not null default 0,
  created_at    timestamptz default now()
);

alter table projects
  add constraint projects_cover_fk
  foreign key (cover_image_id) references images(id) on delete set null;

create index images_project_idx on images(project_id, sort_order);

-- Site-level singletons: hero (req 1) + about image (req 4). One row.
create table site_settings (
  id              int primary key default 1 check (id = 1),
  hero_image_id   uuid references images(id) on delete set null,
  about_image_id  uuid references images(id) on delete set null,
  updated_at      timestamptz default now()
);
insert into site_settings (id) values (1) on conflict do nothing;
```

- **One image → one project** (FK, no join table) — confirmed requirement.
- Both `projects.sort_order` and `images.sort_order` drive sequencing.

**3.3 Auth + RLS**
- Single-user admin (the photographer). Supabase Auth (magic link or email/password).
- RLS: authenticated user has full read/write on `projects`, `images`, and the `originals` bucket. Public/anon role needs **no** access — the public site never queries Supabase at runtime; the build step uses a service role key.

**3.4 Env vars**
- Add (Studio/client): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Add (pipeline/build, server-only): `SUPABASE_SERVICE_ROLE_KEY`.
- Keep: all `R2_*`, `NEXT_PUBLIC_GALLERY_CDN_BASE`, `GH_DISPATCH_*`.
- Remove after cutover: `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, all `GOOGLE_DRIVE_*_FOLDER_ID`, the Tauri OAuth client secret.

**3.5 Editable-content requirements → where each lives.** These five things are hardcoded today (in `lib/projects.ts`'s `META` map, `config/gallery-covers.ts`, the `generate-covers`/`generate-about` scripts). They must become editable data — this is the point of the migration.

| # | Requirement | Schema field | Studio control | Pipeline / public site |
|---|---|---|---|---|
| 1 | Swap the home **hero image** | `site_settings.hero_image_id` | "Set hero" — pick any image (or upload a dedicated one) | Pipeline emits hero data; `lib/projects.ts getHeroCover()` reads it (replaces hardcoded `editorial` lookup) |
| 2 | Choose a project's **cover** at upload | `projects.cover_image_id` (an image *in that project*) | Mark one image in the set as cover | Pipeline builds the cover variant from the chosen image — **deletes the separate `generate-covers` step + `gallery-covers.ts` + `cover-thumbnails.json`** |
| 3 | Enter project **text** (gallery + project page) | `projects.title`, `projects.category`, `projects.blurb` | Text fields on the project composer | Both `GalleryIndex` and `gallery/[slug]` already render `category` + `blurb` from `getWorkIndex()` — just sourced from Postgres |
| 4 | Swap the **about image** | `site_settings.about_image_id` | "Set about image" — pick/upload | Pipeline emits `about-image.json` from this — **folds in `generate-about`** |
| 5 | **Reorder projects** in the gallery | `projects.sort_order` | Drag-reorder the project list | `getWorkIndex()` orders by `sort_order` (replaces hardcoded `META.order`) |

---

## 4. Studio rebuild (web/PWA Project composer)

**4.1 Auth.** Add `supabase-js`. Gate `/studio` behind a Supabase session (login screen if unauthenticated). Remove the `isTauri()` branch and the "use the desktop app" empty state.

**4.2 Model: `UploadSet` → `Project`.** Refactor `StudioApp.tsx`:
- A composer unit = a Project with editable **title**, **category** (kicker), **blurb** (req 3), a **cover** chosen from the set's own images (req 2), and an ordered list of images (drag-sequence — logic already exists).
- Remove `destination`/genre-folder concept and `BUILTIN_DESTINATIONS`.

**4.3 Upload.** On publish, for each image: upload the original to Storage `originals/{slug}/{id}.{ext}` (resumable), then insert the `images` row; upsert the `projects` row (title/category/blurb/sort_order); set `cover_image_id` to the chosen image. Replace all `tauri-oauth` / `upload_to_drive` calls.

**4.4 Publish trigger.** Reuse `api/studio/publish` (still fires `repository_dispatch`). Update its payload/log to reference project slugs instead of Drive destinations. The GitHub PAT stays server-side in Vercel env.

**4.5 PWA.** Add a web manifest + service worker so `/studio` installs as a standalone app (own window/icon, offline shell). This recovers the native desktop feel.

**4.6 Drag-drop.** Use HTML5 drag-and-drop for files from the OS (replaces Tauri's Finder drag bridge). Keep in-grid drag-reorder.

**4.7 Project ordering + site settings.** Two controls beyond the per-project composer:
- **Reorder projects** (req 5): a draggable list of all projects writing `projects.sort_order`. This is the gallery-index order.
- **Site settings panel** (req 1 + 4): "Set hero image" and "Set about image" — each picks an existing image (cross-project allowed) or uploads a dedicated one, writing `site_settings.hero_image_id` / `about_image_id`. Show current selections as thumbnails with a swap action.

---

## 5. Pipeline rework (`generate-gallery-data.ts`)

- Replace the `googleapis` Drive read with Supabase: query `projects` (+ their `images`, ordered by `sort_order`) and `site_settings` via the service role key; download each original from Storage.
- Keep the Sharp variant generation and R2 upload **exactly as-is** (this is the part that works).
- Output: replace `src/generated/gallery-{genre}.json` with per-project data — e.g. `src/generated/projects.json` (index: slug, title, category, blurb, cover variant URLs from `cover_image_id`, image count, ordered by `sort_order`) + `src/generated/project-{slug}.json` (ordered images with R2 variant URLs + LQIP). Final shape should match what `lib/projects.ts` / the page components already consume.
- **Fold in the two one-off pipelines:** the cover variant is now built from each project's `cover_image_id` (delete `generate-covers` + `cover-thumbnails.json` + `config/gallery-covers.ts`); the about + hero images come from `site_settings` (emit `about-image.json` and hero data here, delete `generate-about` as a separate step).
- Keep incremental manifests; key them by `images.id` + a content hash or `updated_at`.
- Update `.github/workflows/generate-galleries.yml`: swap Drive secrets for `SUPABASE_*`; everything else (commit + push) stays.

---

## 6. Data migration

- The user is **re-uploading projects from scratch** via the new Studio, so a bulk Drive→Supabase migration is **not required**.
- For any older projects worth keeping, selection happens in the curation tool (`vflics-editorial-curation.html`); its JSON export matches the `projects`/`images` shape and can seed initial rows.
- Decommission the old `gallery-{genre}.json` files and `src/config/galleries.ts` genre list once §7 no longer reads them.

---

## 7. Frontend / public site — LARGELY BUILT; visual polish still pending designs

> The project-model frontend has **already been refactored** (`lib/projects.ts`, `HomeView`, `GalleryIndex`, `ProjectSequence`, `gallery/[slug]` masthead). The remaining visual/layout polish is **blocked on the Phase 3 designs** (`tasks/redesign/designs/`). Do not re-architect what's built; do not finalize visuals until designs are approved.

Status:
- **Done:** IA `Gallery → Project → Images`; `/gallery` lists projects via `getWorkIndex()`; `/gallery/[slug]` renders `category` + `blurb` + sequence. The data seam (`lib/projects.ts`) is in place.
- **Wiring left (design-independent):** point `lib/projects.ts` and the about page at the generated-from-Supabase data (§5); make hero/cover/text/order/about read from data not the `META` map (§3.5); remove `config/galleries.ts` genre list + the legacy `MasonryGrid`/`GalleryCard`/`GalleryCoverCard` if unused after the `ProjectSequence`/`GalleryIndex` switch.
- **Visual polish (needs designs):** apply the approved `designs/` mockups to `HomeView`, `GalleryIndex`, `ProjectSequence`, about, contact.
- **Acceptance gate:** no LCP/CLS/INP regression vs. the Track A baseline.

---

## 8. Delete the native clients — LAST

Only after §3–§5 are built and a real publish is verified end-to-end through the web Studio:
- Remove `src-tauri/`, `ios/`, `src/lib/tauri-oauth.ts`.
- Remove `@tauri-apps/api`, `@tauri-apps/cli` from `package.json`; remove `tauri:dev` / `tauri:build` scripts and `scripts/tauri-build.sh`.
- Remove the Google Drive env vars and the Tauri OAuth client secret (§3.4).
- Update `README.md` to describe the web/PWA Studio + Supabase architecture.

---

## 9. Build & cutover sequence

1. §3 Supabase project, schema, buckets, auth, env vars. Generate TS types.
2. §4 Web Studio (auth + composer + Storage upload + publish trigger) — behind the live native path; do not delete anything yet.
3. §5 Pipeline reads from Supabase; update the Action.
4. **Verify:** create a test project in the web Studio → publish → Action runs → R2 variants appear → site rebuilds. Confirm public pages still serve from R2 and performance holds.
5. §8 Delete native clients + Drive env once step 4 passes.
6. (Later, after designs) §7 frontend refactor.

---

## 10. Open items

- **No Supabase project exists yet — one must be created first** (free tier is sufficient to start). Step-by-step directions are in **§3.1**. Needs: target org + region.
- Decide auth method (magic link vs password) for the single admin user.
- Originals cold-backup target (Backblaze/local) — they're the RAW source of truth (roadmap 2B.6).
- Capture the Track A performance baseline numbers and paste into §0.4 / §7.
