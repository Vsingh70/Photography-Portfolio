/**
 * Studio domain types (web/PWA Project composer, Supabase-backed).
 *
 * A composer unit is a Project: editable metadata + an ordered list of images +
 * a chosen cover. The local model mirrors the `projects` / `images` Postgres
 * rows but carries in-memory File blobs and thumbnail dataURLs that are NOT
 * persisted (only metadata survives a refresh — blobs surface as `missing`).
 */

/** EXIF distilled to the four fields the public site renders. */
export interface ImageExif {
  camera?: string;
  lens?: string;
  settings?: string;
  date?: string;
}

/** A single image staged inside a project. */
export interface StudioImage {
  /** Stable id (uuid) chosen up front so the Storage path is deterministic. */
  id: string;
  name: string;
  size: number;
  type: string;
  /** SHA-256 of the file bytes — used for dedup within a project. */
  hash: string;
  /** In-memory full-resolution dataURL; lost on refresh. Kept for completeness;
   * the grid renders from the lighter `thumbDataURL` to avoid decode jank. */
  dataURL?: string;
  /** Small (~512px) downscaled dataURL used for fast, low-jank grid display. */
  thumbDataURL?: string;
  /** In-memory original blob; lost on refresh → `missing`. */
  blob?: File;
  /** True when this image already lives in Supabase (loaded from a published
   * project). Managed directly against the DB/Storage, not re-uploaded. */
  remoteImage?: boolean;
  /** Storage path of the original (`{slug}/{id}.{ext}`) for remote images. */
  storagePath?: string;
  /** Short-lived signed URL to the original, for remote-image grid display. */
  signedThumb?: string;
  /** Optional caption / alt text. */
  alt?: string;
  /** Intrinsic pixel dimensions (decoded at ingest). */
  width?: number;
  height?: number;
  /** Extracted EXIF (may be `{}`). */
  exif?: ImageExif;
  duplicate?: boolean;
  /** True after a refresh when the blob is gone and must be re-attached. */
  missing?: boolean;
}

/** A composer unit. Persisted to Supabase as a `projects` row + `images` rows. */
export interface StudioProject {
  /** Local working id; equals the Supabase row id once known. */
  id: string;
  /** True once this project has been published to / loaded from Supabase. */
  remote?: boolean;
  title: string;
  /** kebab-case, unique. Auto-derived from title but editable. */
  slug: string;
  /** Kicker line, e.g. "Fashion · Portraiture". */
  category: string;
  blurb: string;
  location: string;
  /** ISO date string (yyyy-mm-dd) or ''. */
  shotDate: string;
  sortOrder: number;
  /** Id of the image in this project chosen as cover (or null → first image). */
  coverImageId: string | null;
  images: StudioImage[];
  /** For remote projects loaded by reference: image count from Supabase. */
  remoteImageCount?: number;
}

/** Per-image / per-project upload progress surfaced in the publish UI. */
export interface PublishProgress {
  projectIdx: number;
  projectTotal: number;
  projectTitle: string;
  fileIdx: number;
  fileTotal: number;
  phase: 'upload' | 'rows' | 'cover';
}
