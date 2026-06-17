/**
 * Read helpers for already-published Supabase data: the project list (for the
 * sidebar + reorder list), the cross-project image catalog (for the site
 * settings picker), and signed thumbnail URLs for originals in the private
 * `originals` bucket.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@/types/supabase';
import type { StudioProject } from './types';

const BUCKET = 'originals';
type Client = SupabaseClient<Database>;

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
    .select('id, slug, title, category, blurb, location, shot_date, sort_order, cover_image_id, images(count)')
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

/** All images across all projects, for the hero/about picker. */
export async function loadImageCatalog(supabase: Client): Promise<CatalogImage[]> {
  const { data, error } = await supabase
    .from('images')
    .select('id, storage_path, alt, project_id, projects(title)')
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

/** Short-lived signed URL for a private original (thumbnail display). */
export async function signedThumb(
  supabase: Client,
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  return data?.signedUrl ?? null;
}
