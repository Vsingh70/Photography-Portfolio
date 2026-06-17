# vflics — Editorial Redesign Roadmap

**Owner:** Viraj · **Drafted:** 2026-06-16
**Goal:** Move vflics.com from a five-genre freelance portfolio to a focused editorial photographer's site — reposition the brand, push the Canela/minimalist art direction all the way, and win better-fit clients. Hold the line on performance (already strong) rather than rebuild a backend that works.

---

## The one thing to get right

This is a **curation and positioning** project wearing the costume of a "redesign + backend refactor." Your instinct that the backend is the bottleneck is wrong, and acting on it would burn weeks for marginal gain. The real levers, in order of impact:

1. **Curation** — you have 118 "Editorial" images live. That is not minimalism; it is an archive. A specialist's site is 20–40 images, sequenced like a magazine. This single decision moves the brand more than any code.
2. **Positioning** — copy and structure that say "editorial photographer with a point of view," not "available for graduation/engagement/event bookings."
3. **Art direction** — the Canela direction is right; it's currently applied tentatively. Commit to it: more negative space, slower pacing, fewer-but-larger images, restrained type.
4. **Backend** — split it in two. The **serving path** (R2 CDN + AVIF/WebP at four sizes + LQIP + static Vercel export) is best-practice; leave it. The **write path** (Studio → Google Drive) is genuinely over-engineered and worth re-architecting — Drive's per-user OAuth is the cause. This is a real refactor, but it's orthogonal to winning clients, so run it as a parallel track, not a blocker for the brand work.

---

## What you actually have (verified, not assumed)

| Layer | Reality | Verdict |
|---|---|---|
| Serving | Cloudflare R2 CDN, AVIF + WebP, 4 sizes/image, base64 LQIP blur-up | Excellent — keep |
| Site | Next.js 16 / React 19 static export on Vercel, zero image work at build | Excellent — keep |
| Ingestion | Google Drive = source-of-truth; Tauri + iOS Studio upload direct to Drive; GitHub Actions rebuilds galleries | Works; Drive is *not* your serving layer |
| Content | Editorial 118 · Events 219 · Graduation 26 · Portraits 10 · Engagement 10 | **Over-stuffed; the core problem** |
| Genres | 5 configured in `src/config/galleries.ts` | Cut to 1 (+ hedge) |

**Misconception to drop:** "Google Drive as storage isn't fast." Drive only holds originals and receives uploads. Visitors never touch Drive — they hit R2's CDN. Swapping Drive for Supabase/S3 changes your *upload* experience, not site speed.

---

## Information architecture (locked)

Three levels — the standard editorial-portfolio structure:

```
Gallery  (/gallery)            → index of all editorial Projects (cover cards)
  └─ Project  (/gallery/[slug]) → one editorial project, images sequenced as a photo essay
       └─ Images               → frames within the project, opened in the lightbox
```

The current `/gallery/[slug]` route is per-*genre*; it becomes per-*project*. With editorial as the only genre, the genre layer is removed and Projects occupy the top level.

**This is the central object model.** The Supabase schema (Track B) is essentially two tables that the curation pass (0.2) populates directly:

```
projects (id, slug, title, blurb, cover_image_id, location, shot_date, sort_order)
images   (id, project_id → projects.id, r2_variant_urls, blur, alt, exif, sort_order)
```

Assumptions to confirm: one image belongs to exactly one project (1→N); both projects and images are explicitly ordered. If an image must appear in multiple projects, `images.project_id` becomes a join table instead.

## The plan, as a sequence of tasks

Phases are ordered by dependency. **Phase 3 is where you use Claude design**; **Phase 4 is the "complete refactor plan" you asked to produce from those designs.** Phases 0–2 are the inputs that make those two phases produce something good instead of pretty-but-hollow.

### Phase 0 — Positioning & curation (do this first, it's the whole game)

- **0.1 Define the editorial positioning.** One paragraph: who you are, the kind of work you want, your point of view. This becomes the source for all copy. *(advisor + you)*
- **0.2 Curate + structure into Projects.** From 118 → a target of ~24–40 keepers. For each keeper: keep/cut, **assign to a Project**, mark the Project **cover**, and set **order within the Project**. Output maps directly to the `projects` + `images` rows. *(you decide; I build the tool + can pre-cluster by EXIF)*
- **0.3 Make the clean genre cut.** Remove Graduation, Portraits, Engagement, Events as featured galleries. The revenue risk that normally argues for caution doesn't apply here: grad season is over, the old Blacksburg/VT clientele is geographically stranded after the move, and real estate photography is a separate income floor. A "Commissions"/"Work with me" link is now **optional**, not required — include it only if you actively want local commission inquiries; omit it for a purer editorial read. *(see updated risk note below)*
- **0.4 Rewrite the site copy** for home, about, contact against the new positioning. Kill genre-service language.
- **Output:** a positioning statement, a final curated/sequenced image list, and new copy. **Nothing visual yet.**

### Phase 1 — Art-direction brief (the design constraints)

- **1.1 Lock the design tokens you keep:** current color scheme, Canela (display) + your mono small-caps, the LQIP blur-up behavior. Write them down as constraints.
- **1.2 Collect 5–8 editorial references** (magazine sites, photographer portfolios you admire) and name *why* each works.
- **1.3 Write a one-page design brief** Claude design can consume: pages in scope (home, gallery index, gallery/story, about, contact), the "more minimal" rules (negative space, image scale, type restraint, pacing), and hard constraints (tokens from 1.1, must stay a static export, must preserve performance budget).
- **Output:** `design-brief.md`. This is what you paste into Claude design.

### Phase 2 — Backend: two separate tracks

**Track A — Serving path (audit only, expect "keep").**
- **2A.1 Baseline performance.** Lighthouse on vflics.com (mobile + desktop) + real Core Web Vitals from Vercel Speed Insights. Record LCP, CLS, INP, image bytes/page.
- **2A.2 Audit genuine gaps, not imagined ones:** R2 cache-control headers, oversized variant served on mobile, the 488 KB events / 276 KB editorial JSON shipped to the client (curation in 0.2 shrinks this for free).
- **Output:** confirmation to keep, plus a short list of cheap wins.

**Track B — Write path re-architecture (the real refactor you flagged).**
The Studio→Drive design is over-engineered because Drive forces per-user Google OAuth. What that costs today:
- `src-tauri/src/oauth.rs` (409 lines) + `src/lib/tauri-oauth.ts` (63) + the iOS `ASWebAuthenticationSession`/Keychain path — all pure OAuth plumbing
- a client secret to manage/rotate (already an open housekeeping item after a past leak)
- **two** Google credential systems: per-user `drive.file` OAuth for upload + a service account for the pipeline read

**Client decision (locked): collapse to a single authenticated web Studio (installable PWA). Delete the Tauri *and* iOS apps.** This is the biggest complexity win in the project: it removes ~2,235 lines of native code (434 Rust + 1,801 Swift), two build/release toolchains (Cargo + Xcode/TestFlight), 2.7 GB of local build artifacts, and the `@tauri-apps/*` deps + `tauri:*` scripts. All of it exists to work around Drive OAuth + Vercel's upload limit — Supabase erases both reasons. The desktop-app feel is *relocated*, not lost: a PWA gives its own window, dock icon, and offline cache; HTML drag-drop replaces drag-from-Finder; Supabase resumable uploads handle large RAW originals. Only genuinely-lost capability: native phone camera-roll bulk upload (irrelevant for composing curated projects).

- **2B.1 Auth → Supabase Auth in the web app.** A single login (magic link/password) via `supabase-js` on the `/studio` route. Replaces Google loopback OAuth entirely.
- **2B.2 Upload → Supabase Storage, direct from the browser.** Originals upload straight to Storage (resumable/tus for large files) — no Drive, no Vercel hop, no `drive.file` scope, no client secret.
- **2B.3 Redesign the Studio UI: Set → Project composer.** Evolve `StudioApp.tsx`'s `UploadSet` into a Project: title, blurb, cover pick, drag-sequence. On publish it writes `projects` + `images` rows to Postgres and originals to Storage. (`UploadSet` is already ~80% of this shape; keep the React, drop the Tauri bridge calls.)
- **2B.4 Make it a PWA** — web manifest + service worker so it installs as a standalone app with its own window/icon. Recovers the native feel.
- **2B.5 Rework the pipeline** so `generate-galleries` reads originals from Supabase Storage + project structure from Postgres instead of scanning Drive. Drops the service-account Drive read. Publish trigger (→ GitHub Action → R2 variants → Vercel) keeps its shape.
- **2B.6 Originals-retention plan.** Originals live in Supabase Storage (with its browse GUI). Add a cheap cold backup (Backblaze/local) — they're your RAW source of truth.
- **2B.7 Delete the native clients — LAST.** Only after 2B.1–2B.5 are built and a real publish is verified end-to-end through the web Studio: remove `src-tauri/`, `src/lib/tauri-oauth.ts`, the `ios/` app, the `@tauri-apps/*` deps, and the `tauri:*` scripts. **Do not delete before the replacement works — the native apps are the only working uploader until then.**
- **Output:** `studio-refactor.md` — its own implementation spec, runnable independently of the redesign.

**Decision — Supabase (locked).** Chosen because the redesign already requires a new series/stories data model; doing that in Postgres now avoids building it twice. Supabase covers three jobs at once: upload target, originals browse-GUI (replaces Drive's), and the metadata DB.

**Target architecture (the critical part — preserves current performance):**

```
Studio (single authenticated web app / installable PWA — Project composer)
  │  Supabase Auth · originals upload direct to Storage via supabase-js (resumable)
  ▼
Supabase Storage  ── originals (upload destination + browse GUI; replaces Drive)
Supabase Postgres ── photo metadata + SERIES/STORY structure (source of truth; replaces flat gallery-*.json)
  │
  │  build-time: generate-galleries reads originals from Supabase Storage + series from Postgres
  ▼
Sharp variant pipeline ──► Cloudflare R2 (derived AVIF/WebP variants)
  │
  ▼
Static Next.js export on Vercel ──► serves from R2 CDN  (UNCHANGED)
```

**Non-negotiable:** the public site stays a static export served from the R2 CDN. Supabase is the *write/source* layer and a *build-time* data source — **not** a runtime dependency the public pages query. Keep serving on R2; do not route visitor image requests through Supabase. This is what protects the LCP/CLS numbers you care about.

Implication for Phase 4: the "series" data model (task 4.2) is no longer a separate invention — it's the Supabase schema, designed once in Track B and consumed by the redesign.

### Phase 3 — Design the refactored pages with Claude design *(your hands-on phase)*

- **3.1** Feed `design-brief.md` (Phase 1) + the curated image list (Phase 0) into Claude design.
- **3.2** Design the five pages, prioritizing **gallery/story** and **home** — those carry the editorial feeling. Push the minimalism harder than feels comfortable.
- **3.3** Iterate to a direction you'd stake the brand on. Export/screenshot the chosen designs.
- **Output:** approved designs for home, gallery index, gallery/story, about, contact.

### Phase 4 — Complete refactor plan, written from the designs *(the deliverable you described)*

- **4.1** Translate each approved design into a component-level build plan, mapped onto the real files: `src/app/page.tsx`, `gallery/page.tsx`, `gallery/[slug]/page.tsx`, `about/`, `contact/`, and the gallery components (`MasonryGrid`, `EditorialLightbox`, `GalleryView`, `GalleryCard`, `GalleryCoverCard`).
- **4.2** Data model is already defined — the `projects` + `images` Supabase schema from Track B (IA section above). Phase 4 just specifies how the build step turns it into the per-project static pages and project-index data, replacing the flat `gallery-*.json`.
- **4.3** Specify the genre removal in `src/config/galleries.ts` and what happens to the now-unused gallery data + Drive folders.
- **4.4** Fold in the Phase 2 backend decisions.
- **4.5** Sequence the build into shippable PRs with a performance budget as the acceptance gate (LCP/CLS/INP must not regress past Phase 2.1 baseline).
- **Output:** `refactor-plan.md` — the implementation spec you build against (or hand to me to build).

### Phase 5 — Build & verify

- Execute Phase 4 PR by PR. Each PR: build, deploy preview, Lighthouse + real-device check (mobile + desktop), visual diff. Merge only when the performance budget holds.

---

## Risk note — updated for current situation

The usual objection to "leave the other genres behind" is lost revenue. It mostly doesn't apply here, for three reasons: grad season is over, the previous Graduation/Portrait/Engagement clientele was tied to the Blacksburg/Virginia Tech area and is now geographically stranded after the move across the state, and a separate real-estate photography business already provides an income floor. That combination is exactly what makes a clean editorial cut affordable now rather than risky. Two consequences:

- **Geography matters less now, not more.** Editorial clients (magazines, brands, art directors) are largely non-local and often remote, unlike the local-by-nature genres being cut. "Haven't rebuilt a local clientele yet" is a blocker for portraits/grad and a near-non-issue for editorial — so the timing argument favors acting now.
- **Brand architecture: resolved.** Real-estate photography runs under a **completely separate LLC** (not just a separate domain). No shared brand, audience, or liability — so vflics.com is free to be 100% editorial with no acknowledgment of the real-estate work anywhere on the site. This removes the only structural risk; nothing to wall off in Phase 4.

---

## What changes vs. what you keep

**Keep:** R2 + CDN, AVIF/WebP pipeline, LQIP, static Vercel export, the publish-trigger → GitHub Action → deploy loop, the `StudioApp.tsx` React UI (refactored), the color scheme, Canela.
**Change:** image count (drastically down), genre count (5→1), copy/positioning, layout pacing and scale, the data model (flat genre JSON → `projects`+`images` in Postgres), the Studio internals (Drive→Supabase, Set→Project composer), auth (Google OAuth → Supabase Auth), Studio delivery (native → web/PWA).
**Delete (last, after the web Studio works):** `src-tauri/` (434 Rust LOC + 2.7 GB artifacts), `ios/` (1,801 Swift LOC), `tauri-oauth.ts`, `oauth.rs`, Drive upload commands, client-secret rotation, the service-account Drive read, `@tauri-apps/*` deps, `tauri:*` scripts.
**Evaluate before changing:** client-shipped JSON size, R2 cache headers, mobile variant selection.

---

## Immediate next step

Plan is to **re-upload projects from scratch**, refining older ones first — which puts the **Studio redesign on the critical path**, because you can't compose + upload editorial projects until the new Studio exists. Both the Studio and the public site read the same `projects`+`images` schema, so that schema is the foundation for everything.

Recommended order from here:

1. **Design the Supabase schema** (`projects` + `images`, Storage buckets, auth). Foundation for both the Studio and Phase 4.
2. **Write `studio-refactor.md`** — the spec to rebuild the Studio as a single Supabase-backed web/PWA Project composer and retire the native clients (Track B above).
3. **Refine the older projects** you want to keep (the curation tool covers selecting survivors), then re-upload via the new Studio.
4. Proceed to Phase 1/3 design and Phase 4 site refactor.

The curation contact-sheet tool (`vflics-editorial-curation.html`) is built and ready whenever you want to pick survivors from the existing 118.
