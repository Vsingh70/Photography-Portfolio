# tasks/

Planning and implementation docs for the vflics portfolio.

## Current direction → `redesign/`

The project is repositioning from a five-genre freelance portfolio to a focused **editorial** site, with a backend migration from **Google Drive → Supabase** and the Studio rebuilt as a single **web/PWA** app (retiring the native Tauri + iOS clients).

| Doc | Purpose |
|---|---|
| [`redesign/00-editorial-redesign-roadmap.md`](redesign/00-editorial-redesign-roadmap.md) | The strategy + phased plan. Positioning, curation, IA (Gallery → Project → Images), backend tracks, design, and sequencing. Start here. |
| [`redesign/01-refactor-plan.md`](redesign/01-refactor-plan.md) | The technical implementation spec for Claude Code. Supabase schema, web/PWA Studio rebuild, pipeline rework, native-client deletion, data-model migration. The frontend/visual section is stubbed pending the Phase 3 designs. |
| [`redesign/02-design-brief.md`](redesign/02-design-brief.md) | The design brief. Locked tokens (Canela, neutral+cream, adaptive light/dark), magazine-whitespace direction, page-by-page intent, filled positioning. Reference sites still to add. |
| [`redesign/designs/`](redesign/designs/) | Page design mockups built from the brief — `home.html` + `project.html`. Standalone, responsive, light/dark toggle, real photographs. Open in a browser. These feed the frontend section (§7) of the refactor plan. |

## Reference (still valid)

- [`ops-autopublish-setup.md`](ops-autopublish-setup.md) — publish-trigger → GitHub Action → deploy loop setup (the loop *stays*; only its data source changes from Drive to Supabase).
- [`guides/`](guides/) — performance, deployment, and gallery-optimization notes for the **serving path** (R2 CDN + AVIF/WebP + LQIP), which is being kept. Useful for not regressing performance during the refactor. Note: references to genre galleries and Drive pre-generation are dated.

## Archive

- [`archive/`](archive/) — superseded pre-redesign docs (Drive/native era). Historical only; do not build against them.
