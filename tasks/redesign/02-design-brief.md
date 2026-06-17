# Design Brief — vflics Editorial Portfolio

**Paste this into Claude design.** It defines who the site is for, the aesthetic, the exact tokens, and what to design. Two blanks are marked **[FILL]** — your positioning wording and reference sites. Everything else is locked.

---

## The ask

Design a refined **editorial photography portfolio** — desktop and mobile — for **home, gallery (project index), project page, about, and contact**. The feeling is a print magazine translated to the web: lots of negative space, slow pacing, restrained type, images carrying the whole show. Prioritize the **project page** and **home** — they define the experience.

## Who it's for

vflics is the editorial practice of photographer **Viraj Singh** *(confirm name)*, specializing in **fashion & portrait** and **brand / commercial editorial**. The audience is **art directors, photo editors, and brand/creative leads** commissioning that kind of work — often remote, evaluating taste and consistency in under a minute. The site is a point-of-view statement, not a service menu.

**Positioning paragraph** *(filled — refine anytime in your own voice):*
> vflics is the editorial work of Viraj Singh — fashion, portraiture, and commissioned brand stories. The work is built on a single 50mm prime and a preference for getting close: unhurried portraits, styled stories shot with a documentary eye, and brand campaigns that read like editorial rather than advertising. The aim is images that hold attention — quiet, precise, human — and a body of work that stays consistent from one commission to the next. Available for editorial assignments and brand campaigns.

## Information architecture

```
Gallery (/gallery)        → index of editorial Projects, shown as cover cards
  └─ Project (/gallery/[slug]) → one project, images sequenced like a photo essay
       └─ Images           → frames within the project, opened in a lightbox
```

One image belongs to one project. Projects and images are explicitly ordered (sequence matters).

## Aesthetic direction

**Editorial minimalism, magazine-whitespace pacing.** The governing rules:

- **Negative space is the primary design element.** Generous margins; let pages breathe; never fill space just because it's there.
- **Slow pacing.** Few images per screen. One idea at a time. Scrolling should feel like turning pages, not browsing a grid.
- **Type restraint.** Canela does the talking; minimal weights, large quiet headings, small precise metadata. No decorative UI.
- **Images at considered scale** — not edge-to-edge by default (that's a different brief); sized and centered with intent, surrounded by air.
- **The interface disappears.** Navigation is sparse and recessive; the work is the only thing that should feel loud.

## Design tokens (locked — from the live codebase)

**Mode:** Adaptive — design **both light and dark**. Respect system preference (current behavior). Both must feel intentional, not one ported to the other.

**Color (neutral + cream — keep and refine):**
- *Light:* paper `#f8f9fa` / `#f1f3f5`; ink `#212529` and `#111`; hairlines `#e9ecef`, `#dee2e6`; muted text `#adb5bd`; slate accent `#64748b`.
- *Dark:* near-black canvas; **warm cream** text `#f5f3ee`; borders `#1f1f1f`; muted `#5c6066`.
- Palette stays neutral so the photographs carry all the color. Cream is the one warm note — use it deliberately.

**Type:**
- **Canela** (display serif) — weights 100–700 with italics, loaded locally as `--font-canela`. This is the brand voice; use it for headings, titles, project blurbs.
- A **restrained mono or sans** (Geist / system) for small metadata — captions, EXIF, nav labels — in small caps or tracked uppercase. The serif/quiet-mono pairing is the editorial signature.
- **Existing signature to preserve:** underline-only form fields (no boxes), italic placeholders. Keep this for contact.

**Motion (restrained):** fade-ins, a `0.985` scale-in on images, a small arrow-nudge on hover. Subtle, never bouncy. **Must honor `prefers-reduced-motion`.**

**Imagery:** portrait-heavy (e.g. 4672×7008), served as AVIF/WebP at four sizes with base64 LQIP blur-up. EXIF (camera, lens, settings, date) is available per image and can be used as understated editorial metadata.

## Page-by-page intent

- **Home** — one arresting moment. Either a single hero image or a spare, typographic index of projects. Name + one-line positioning, sparse nav. It should feel like a magazine cover, not a dashboard.
- **Gallery (project index)** — projects as cover cards: cover image, title, optional year/location. A considered contents page; whitespace between entries; no dense grid.
- **Project page** — the core. Title + short blurb in Canela, then the sequenced images with air between them, sized for impact but not edge-to-edge. Lightbox for full view. Optional quiet metadata strip (EXIF) per image or per project.
- **About** — a portrait + concise bio in Viraj's voice; optionally a short list of clients/publications. Restrained, personal, confident.
- **Contact** — the existing underline-field form (it's already a signature), email, and social. Minimal and direct.

## Hard constraints

- **Static export** — designs must be buildable as static pages with no runtime database calls. Images load from a CDN.
- **Performance is a gate** — the design must not regress Core Web Vitals (LCP/CLS/INP). Favor few, well-sized images and minimal heavy effects.
- **Seamless responsive** — mobile and desktop must both feel native to the medium, not one squeezed into the other. Magazine whitespace should adapt, not collapse.
- **Accessible** — sufficient contrast in both modes, alt text, reduced-motion support.

## References

**[FILL] — drop 2–3 portfolio or magazine sites you admire and what you like about each.** Look for these qualities to guide the pick: generous whitespace, serif-led type, slow scroll pacing, recessive navigation, project-as-story structure. (If you'd like, I can research current examples of editorial photographer portfolios in this style and propose a shortlist.)

## Deliverables from Claude design

- Desktop + mobile for all five pages, **project page and home first.**
- Both light and dark for at least home and project.
- Push the minimalism further than feels comfortable — it's easier to add back than to strip down.

## Out of scope

- Any genre other than editorial (no graduation/portraits-as-service/engagement/events).
- E-commerce, blog, client galleries. This is a portfolio, full stop.
