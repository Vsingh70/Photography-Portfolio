/**
 * Editorial work index — server/build-time only.
 *
 * Reads the generated-from-Supabase data:
 *   - `src/generated/projects.json` — the ordered WorkEntry[] index (covers,
 *     blurbs, counts), already sorted by projects.sort_order by the pipeline.
 *   - `src/generated/hero.json` — the chosen home hero (or null).
 *
 * Only the lightweight derived arrays cross to client components; the large
 * per-project image JSON stays server-side (see generated/projects-registry.ts,
 * imported only by the gallery/[slug] RSC).
 */
import projectsIndex from '@/generated/projects.json';
import heroData from '@/generated/hero.json';

export interface WorkEntry {
  slug: string;
  title: string;
  category: string;
  blurb: string;
  count: number;
  coverPath: string;
  blurDataURL?: string;
  width: number;
  height: number;
}

export interface HeroCover {
  path: string;
  blurDataURL?: string;
  width: number;
  height: number;
  alt: string;
}

/** Ordered project index for the home + gallery pages. */
export function getWorkIndex(): WorkEntry[] {
  return projectsIndex as WorkEntry[];
}

/** The home hero image, or null when none is configured in site_settings. */
export function getHeroCover(): HeroCover | null {
  return heroData as HeroCover | null;
}
