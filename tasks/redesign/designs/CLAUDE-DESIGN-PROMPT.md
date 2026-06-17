# Paste-ready prompt for the Claude design tool

Use this to continue designing in the Claude design tool. Paste the block below, then attach or paste the code from `home.html` and `project.html` (in this folder) as the reference style. Full direction lives in [`../02-design-brief.md`](../02-design-brief.md).

---

**Prompt:**

> Design pages for **vflics**, the editorial photography portfolio of Viraj Singh — fashion, portraiture, and brand/commercial editorial. Match the style of the two reference pages I'm providing (home + project); keep everything consistent with them.
>
> **Aesthetic:** editorial minimalism, magazine-whitespace pacing. Generous margins, slow pacing, few elements per screen, type restraint, recessive navigation. The photographs carry the page; the interface disappears.
>
> **Tokens (match exactly):**
> - Type: a refined editorial serif for headings/titles/blurbs (production font is Canela; Cormorant Garamond is the stand-in), with a small tracked-uppercase sans for metadata (captions, EXIF, nav).
> - Color, light: paper `#f8f9fa`, ink `#16181b`/`#212529`, hairlines `#e4e7ea`, muted `#adb5bd`, slate accent `#64748b`.
> - Color, dark: near-black canvas `#0e0d0c`, warm cream text `#f5f3ee`, borders `#211f1d`, muted `#5c6066`.
> - Adaptive light/dark (respect system preference + a manual toggle). Restrained motion only; honor `prefers-reduced-motion`.
>
> **IA:** Gallery → Project → Images. One image belongs to one project; projects and images are explicitly ordered.
>
> **Design these pages, consistent with the references:**
> 1. Gallery (project index) — projects as cover cards with title + year/location, lots of whitespace, a contents-page feel.
> 2. About — portrait + concise bio in a confident editorial voice, optional client/publication list.
> 3. Contact — minimal underline-only form fields (no boxes), email, social.
>
> **Constraints:** must be buildable as a static page (no runtime database), responsive (mobile + desktop both feel native), accessible (contrast in both modes, alt text). Push the minimalism further than feels comfortable.

---

**After designing:** export/screenshot the approved pages and drop them back here. They'll fill section §7 of [`../01-refactor-plan.md`](../01-refactor-plan.md), which becomes the component-level build spec for Claude Code.
