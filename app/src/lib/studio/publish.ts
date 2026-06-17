/**
 * Publish path: Studio drafts → Supabase (Storage originals + Postgres rows).
 *
 * For each project, in FK-safe order:
 *   1. Upsert the `projects` row (without cover) onConflict slug; resolve the
 *      real row id by selecting it back (a slug may already exist).
 *   2. For each image in order: upload the original blob to Storage at
 *      `originals/{slug}/{imageId}.{ext}` then insert the `images` row.
 *   3. Update `projects.cover_image_id` to the chosen image (default: first).
 *
 * Standard `.upload` is used; this is fine for current sizes.
 * TODO: resumable/tus for very large RAW originals.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@/types/supabase';
import { fileExt } from './ingest';
import type { ImageExif, PublishProgress, StudioProject } from './types';

const BUCKET = 'originals';

type Client = SupabaseClient<Database>;

export interface PublishResult {
  publishedIds: string[];
  slugs: string[];
}

function exifToJson(exif: ImageExif | undefined): Database['public']['Tables']['images']['Insert']['exif'] {
  return (exif ?? {}) as Database['public']['Tables']['images']['Insert']['exif'];
}

/**
 * Publish a list of (validated) projects. Throws on the first hard failure
 * so the caller can surface it; partial progress is reported via onProgress.
 */
export async function publishProjects(
  supabase: Client,
  projects: StudioProject[],
  onProgress: (p: PublishProgress) => void
): Promise<PublishResult> {
  const publishedIds: string[] = [];
  const slugs: string[] = [];

  for (let projectIdx = 0; projectIdx < projects.length; projectIdx++) {
    const project = projects[projectIdx];
    const fileTotal = project.images.length;

    // ── 1. Upsert the project row (without cover yet) ──
    onProgress({
      projectIdx,
      projectTotal: projects.length,
      projectTitle: project.title,
      fileIdx: 0,
      fileTotal,
      phase: 'rows',
    });

    const projectRow: TablesInsert<'projects'> = {
      id: project.id,
      slug: project.slug,
      title: project.title,
      category: project.category,
      blurb: project.blurb,
      location: project.location || null,
      shot_date: project.shotDate || null,
      sort_order: project.sortOrder,
      published: true,
    };

    const { error: upsertErr } = await supabase
      .from('projects')
      .upsert(projectRow, { onConflict: 'slug' });
    if (upsertErr) {
      throw new Error(`"${project.title}": project save failed — ${upsertErr.message}`);
    }

    // Resolve the real row id (slug may have pre-existed under a different id).
    const { data: resolved, error: resolveErr } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', project.slug)
      .single();
    if (resolveErr || !resolved) {
      throw new Error(`"${project.title}": could not resolve project id — ${resolveErr?.message ?? 'not found'}`);
    }
    const projectId = resolved.id;

    // ── 2. Upload originals + insert image rows, in order ──
    let chosenCoverId: string | null = null;
    for (let i = 0; i < project.images.length; i++) {
      const image = project.images[i];
      if (!image.blob) {
        throw new Error(`"${project.title}" has images to re-attach before publishing.`);
      }

      onProgress({
        projectIdx,
        projectTotal: projects.length,
        projectTitle: project.title,
        fileIdx: i,
        fileTotal,
        phase: 'upload',
      });

      const ext = fileExt(image.name, image.type);
      const path = `${project.slug}/${image.id}${ext}`;
      const contentType = image.type || 'application/octet-stream';

      // TODO: resumable/tus for very large RAW originals (Storage resumable
      // endpoint) — standard upload is fine for current JPEG/PNG sizes.
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, image.blob, { upsert: true, contentType });
      if (uploadErr) {
        throw new Error(`"${project.title}" / ${image.name}: upload failed — ${uploadErr.message}`);
      }

      const imageRow: TablesInsert<'images'> = {
        id: image.id,
        project_id: projectId,
        storage_path: path,
        alt: image.alt ?? '',
        title: image.name,
        width: image.width ?? null,
        height: image.height ?? null,
        exif: exifToJson(image.exif),
        sort_order: i,
      };
      const { error: imgErr } = await supabase
        .from('images')
        .upsert(imageRow, { onConflict: 'id' });
      if (imgErr) {
        throw new Error(`"${project.title}" / ${image.name}: row insert failed — ${imgErr.message}`);
      }

      if (project.coverImageId === image.id) chosenCoverId = image.id;
      if (i === 0 && chosenCoverId === null) chosenCoverId = image.id; // default
    }

    // ── 3. Set the cover ──
    if (chosenCoverId) {
      onProgress({
        projectIdx,
        projectTotal: projects.length,
        projectTitle: project.title,
        fileIdx: fileTotal,
        fileTotal,
        phase: 'cover',
      });
      const { error: coverErr } = await supabase
        .from('projects')
        .update({ cover_image_id: chosenCoverId })
        .eq('id', projectId);
      if (coverErr) {
        throw new Error(`"${project.title}": cover update failed — ${coverErr.message}`);
      }
    }

    publishedIds.push(project.id);
    slugs.push(project.slug);
  }

  return { publishedIds, slugs };
}

/** Trigger the GitHub rebuild via the existing publish proxy. */
export async function triggerRebuild(slugs: string[], note: string): Promise<string | null> {
  try {
    const res = await fetch('/api/studio/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'web', projectSlugs: slugs, note }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return err?.error ?? `Publish trigger HTTP ${res.status}`;
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Publish trigger failed';
  }
}
