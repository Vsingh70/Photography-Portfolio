/**
 * localStorage draft persistence for the Studio.
 *
 * Only project + image *metadata* is persisted — File blobs and dataURL
 * thumbnails are intentionally dropped (they'd blow the storage quota). On
 * restore, images come back flagged `missing: true` so the operator re-attaches
 * the originals before publishing, exactly like the legacy behaviour.
 *
 * Remote (already-published) projects are NOT persisted as drafts — they're
 * re-loaded from Supabase on auth. Only locally-composed drafts are saved.
 */

import type { StudioImage, StudioProject } from './types';

const STORAGE_KEY = 'vflics-studio-projects';

interface DraftImage {
  id: string;
  name: string;
  size: number;
  type: string;
  hash: string;
  alt?: string;
  width?: number;
  height?: number;
  exif?: StudioImage['exif'];
}

interface DraftProject {
  id: string;
  title: string;
  slug: string;
  category: string;
  blurb: string;
  location: string;
  shotDate: string;
  sortOrder: number;
  coverImageId: string | null;
  images: DraftImage[];
}

interface DraftEnvelope {
  projects: DraftProject[];
  savedAt: number;
}

export function loadDraft(): StudioProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as DraftEnvelope;
    if (!data?.projects?.length) return [];
    return data.projects.map((p) => ({
      ...p,
      remote: false,
      images: (p.images || []).map((f) => ({ ...f, missing: true })),
    }));
  } catch {
    return [];
  }
}

export function saveDraft(projects: StudioProject[]): void {
  try {
    // Persist only local (unpublished) drafts; remote projects re-load from DB.
    const local = projects.filter((p) => !p.remote);
    if (!local.length) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const data: DraftEnvelope = {
      projects: local.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        category: p.category,
        blurb: p.blurb,
        location: p.location,
        shotDate: p.shotDate,
        sortOrder: p.sortOrder,
        coverImageId: p.coverImageId,
        images: p.images.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.type,
          hash: f.hash,
          alt: f.alt,
          width: f.width,
          height: f.height,
          exif: f.exif,
        })),
      })),
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota / SecurityError — ignore
  }
}

/** Remove specific local-draft projects after a successful publish. */
export function clearDraftProjects(projects: StudioProject[], publishedIds: Set<string>): void {
  saveDraft(projects.filter((p) => !publishedIds.has(p.id)));
}
