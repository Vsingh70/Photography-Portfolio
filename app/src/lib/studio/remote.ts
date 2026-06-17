/**
 * Read helpers for already-published Supabase data: the project list (for the
 * sidebar + reorder list), the cross-project image catalog (for the site
 * settings picker), and signed thumbnail URLs for originals in the private
 * `originals` bucket.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@/types/supabase';
import type { ImageExif, StudioImage, StudioProject } from './types';

const BUCKET = 'originals';
type Client = SupabaseClient<Database>;

/**
 * Reserved slug for the hidden, unpublished project that holds dedicated
 * hero/about images (see lib/studio/siteImages.ts). Excluded from the project
 * list + the public gallery; its images can still be picked in site settings.
 */
export const SITE_ASSETS_SLUG = 'site-assets';

/** Lightweight catalog entry for the cross-project image picker. */
export interface CatalogImage {
  id: string;
  storage_path: string;
  alt: string;
  projectId: string;
  projectTitle: string;
}

/** Load published/existing projects as reference-only StudioProjects. */
export async function loadRemoteProjects(supabase: Client): Promise<StudioProject[]> {
  const { data, error } = await supabase
    .from('projects')
    // Disambiguate: there are two FKs between projects/images (images.project_id
    // and projects.cover_image_id), so name the project_id relationship explicitly.
    .select('id, slug, title, category, blurb, location, shot_date, sort_order, cover_image_id, images!images_project_id_fkey(count)')
    .neq('slug', SITE_ASSETS_SLUG) // hide the reserved hero/about-assets project
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const countRow = row.images as unknown as Array<{ count: number }> | null;
    return {
      id: row.id,
      remote: true,
      title: row.title,
      slug: row.slug,
      category: row.category,
      blurb: row.blurb,
      location: row.location ?? '',
      shotDate: row.shot_date ?? '',
      sortOrder: row.sort_order,
      coverImageId: row.cover_image_id,
      images: [],
      remoteImageCount: countRow?.[0]?.count ?? 0,
    };
  });
}

/** Persist a new ordering of projects to `projects.sort_order`. */
export async function persistProjectOrder(supabase: Client, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('projects').update({ sort_order: index }).eq('id', id)
    )
  );
}

/** Update project metadata (used when editing a remote project's text fields). */
export async function persistProjectMeta(
  supabase: Client,
  project: StudioProject
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      title: project.title,
      slug: project.slug,
      category: project.category,
      blurb: project.blurb,
      location: project.location || null,
      shot_date: project.shotDate || null,
    })
    .eq('id', project.id);
  if (error) throw new Error(error.message);
}

/**
 * Load a published project's existing images (ordered by sort_order). Each tile
 * renders from the lightweight R2 webp variant the pipeline already built
 * (`{cdn}/galleries/{slug}/{id}-sm.webp`, a few KB on the public CDN) — that's
 * the fast path and removes the reorder lag the full-size signed original caused.
 * A short-lived signed Storage URL is still attached as `signedThumb`, used only
 * as the tile's `onError` fallback for the rare case a variant isn't built yet.
 * Images stay `remoteImage: true` and are managed (reorder/delete) against
 * Supabase directly rather than re-uploaded on publish.
 *
 * `slug` + `cdnBase` (process.env.NEXT_PUBLIC_GALLERY_CDN_BASE) are passed in by
 * the caller so this stays a pure data helper.
 */
export async function loadProjectImages(
  supabase: Client,
  projectId: string,
  slug: string,
  cdnBase: string
): Promise<StudioImage[]> {
  const { data, error } = await supabase
    .from('images')
    // Two FKs exist between projects/images — disambiguate to images.project_id.
    .select('id, storage_path, alt, title, width, height, exif, sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const signed = await Promise.all(
    rows.map((row) => signedThumb(supabase, row.storage_path))
  );
  const base = cdnBase.replace(/\/$/, '');

  return rows.map((row, i) => ({
    id: row.id,
    name: row.title || row.storage_path.split('/').pop() || 'image',
    size: 0,
    type: '',
    hash: '',
    alt: row.alt ?? '',
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    exif: (row.exif ?? {}) as ImageExif,
    remoteImage: true,
    storagePath: row.storage_path,
    remoteThumb: base ? `${base}/galleries/${slug}/${row.id}-sm.webp` : undefined,
    signedThumb: signed[i] ?? undefined,
  }));
}

/** Persist a new ordering of a project's images to `images.sort_order`. */
export async function persistImageOrder(
  supabase: Client,
  orderedImageIds: string[]
): Promise<void> {
  await Promise.all(
    orderedImageIds.map((id, index) =>
      supabase.from('images').update({ sort_order: index }).eq('id', id)
    )
  );
}

/**
 * Delete a single published image: remove the Storage original first, then the
 * `images` row. R2 variant cleanup is the pipeline's job on the next rebuild.
 */
export async function deleteImage(supabase: Client, image: StudioImage): Promise<void> {
  if (image.storagePath) {
    const { error: storageErr } = await supabase.storage.from(BUCKET).remove([image.storagePath]);
    if (storageErr) throw new Error(storageErr.message);
  }
  const { error } = await supabase.from('images').delete().eq('id', image.id);
  if (error) throw new Error(error.message);
}

/**
 * Delete a whole published project: list + remove every Storage object under
 * `{slug}/`, then delete the `projects` row (DB cascade removes its images
 * rows). R2 variant cleanup is the pipeline's job on the next rebuild.
 */
export async function deleteProject(supabase: Client, project: StudioProject): Promise<void> {
  // List originals under this project's slug folder and remove them in bulk.
  const { data: listed, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list(project.slug, { limit: 1000 });
  if (listErr) throw new Error(listErr.message);

  const paths = (listed ?? [])
    .filter((obj) => obj.name) // skip folder placeholders
    .map((obj) => `${project.slug}/${obj.name}`);
  if (paths.length > 0) {
    const { error: removeErr } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeErr) throw new Error(removeErr.message);
  }

  const { error } = await supabase.from('projects').delete().eq('id', project.id);
  if (error) throw new Error(error.message);
}

/** All images across all projects, for the hero/about picker. */
export async function loadImageCatalog(supabase: Client): Promise<CatalogImage[]> {
  const { data, error } = await supabase
    .from('images')
    // Same two-FK ambiguity in reverse: name the project_id relationship.
    .select('id, storage_path, alt, project_id, projects!images_project_id_fkey(title)')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const project = row.projects as unknown as { title: string } | null;
    return {
      id: row.id,
      storage_path: row.storage_path,
      alt: row.alt,
      projectId: row.project_id,
      projectTitle: project?.title ?? '',
    };
  });
}

/** Current site_settings singleton. */
export async function loadSiteSettings(
  supabase: Client
): Promise<{ heroImageId: string | null; aboutImageId: string | null }> {
  const { data } = await supabase
    .from('site_settings')
    .select('hero_image_id, about_image_id')
    .eq('id', 1)
    .maybeSingle();
  return {
    heroImageId: data?.hero_image_id ?? null,
    aboutImageId: data?.about_image_id ?? null,
  };
}

/** Upsert the hero / about image on the site_settings singleton. */
export async function setSiteImage(
  supabase: Client,
  field: 'hero_image_id' | 'about_image_id',
  imageId: string
): Promise<void> {
  const row: TablesInsert<'site_settings'> = {
    id: 1,
    updated_at: new Date().toISOString(),
  };
  row[field] = imageId;
  const { error } = await supabase.from('site_settings').upsert(row, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

/** Gear kind discriminator (matches the `gear` table CHECK). */
export type GearKind = 'camera' | 'lens';

/** Saved gear, split by kind, label-only and ordered. */
export interface GearLists {
  cameras: string[];
  lenses: string[];
}

/**
 * Load all saved gear, split into camera + lens label lists (ordered by label).
 * Used to seed the Camera/Lens combobox dropdowns when the Studio mounts.
 */
export async function loadGear(supabase: Client): Promise<GearLists> {
  const { data, error } = await supabase
    .from('gear')
    .select('kind, label')
    .order('label', { ascending: true });
  if (error) throw new Error(error.message);

  const cameras: string[] = [];
  const lenses: string[] = [];
  for (const row of data ?? []) {
    if (row.kind === 'camera') cameras.push(row.label);
    else if (row.kind === 'lens') lenses.push(row.label);
  }
  return { cameras, lenses };
}

/**
 * Upsert a gear label (no-op on empty). Dupes are ignored via the
 * `unique(kind,label)` constraint (`onConflict: 'kind,label'`, ignoreDuplicates).
 * Tolerant: returns silently on error so an autosave never blocks an edit.
 */
export async function saveGear(supabase: Client, kind: GearKind, label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) return;
  await supabase
    .from('gear')
    .upsert({ kind, label: trimmed }, { onConflict: 'kind,label', ignoreDuplicates: true });
}

/** Short-lived signed URL for a private original (thumbnail display). */
export async function signedThumb(
  supabase: Client,
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  return data?.signedUrl ?? null;
}
