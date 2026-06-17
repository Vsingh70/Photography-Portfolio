/**
 * Dedicated hero/about image uploads.
 *
 * `site_settings.hero_image_id` / `about_image_id` are FKs to `images`, and
 * every image must belong to a project (`images.project_id` is NOT NULL). So a
 * "dedicated" site image (one not part of any gallery project) is parked in a
 * single reserved, unpublished project — `site-assets` — which never appears in
 * the gallery or the Studio's project list. The picker can still reuse any
 * project image; this just adds the "upload a new one" path.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@/types/supabase';
import { ingestFile, fileExt } from './ingest';
import { SITE_ASSETS_SLUG, setSiteImage } from './remote';

const BUCKET = 'originals';
type Client = SupabaseClient<Database>;
type SiteField = 'hero_image_id' | 'about_image_id';

/** Ensure the reserved hidden project exists; return its id. */
async function ensureSiteAssetsProject(supabase: Client): Promise<string> {
  const { error } = await supabase
    .from('projects')
    .upsert(
      { slug: SITE_ASSETS_SLUG, title: 'Site Assets', category: '', blurb: '', published: false, sort_order: -1 },
      { onConflict: 'slug' }
    );
  if (error) throw new Error(error.message);
  const { data, error: selErr } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', SITE_ASSETS_SLUG)
    .single();
  if (selErr || !data) throw new Error(selErr?.message ?? 'Could not resolve the site-assets project.');
  return data.id;
}

export interface UploadedSiteImage {
  id: string;
  /** In-memory preview (the file's dataURL) for an instant thumbnail. */
  dataURL: string;
}

/**
 * Upload a brand-new image as the hero or about picture: store the original,
 * insert an `images` row under the reserved site-assets project, and point the
 * site_settings field at it. Returns the new image id + a preview dataURL.
 */
export async function uploadSiteImage(
  supabase: Client,
  file: File,
  field: SiteField
): Promise<UploadedSiteImage> {
  const img = await ingestFile(file, new Set());
  if (!img.blob) throw new Error('Could not read the selected file.');

  const projectId = await ensureSiteAssetsProject(supabase);
  const path = `${SITE_ASSETS_SLUG}/${img.id}${fileExt(img.name, img.type)}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, img.blob, { upsert: true, contentType: img.type || 'application/octet-stream' });
  if (upErr) throw new Error(upErr.message);

  const row: TablesInsert<'images'> = {
    id: img.id,
    project_id: projectId,
    storage_path: path,
    alt: img.alt ?? '',
    title: img.name,
    width: img.width ?? null,
    height: img.height ?? null,
    exif: (img.exif ?? {}) as TablesInsert<'images'>['exif'],
    sort_order: 0,
  };
  const { error: insErr } = await supabase.from('images').upsert(row, { onConflict: 'id' });
  if (insErr) throw new Error(insErr.message);

  await setSiteImage(supabase, field, img.id);
  return { id: img.id, dataURL: img.dataURL ?? '' };
}
