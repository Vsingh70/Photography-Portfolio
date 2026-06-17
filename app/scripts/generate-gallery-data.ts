#!/usr/bin/env tsx
/**
 * Generate gallery data + upload prebuilt image variants to Cloudflare R2.
 *
 * SOURCE OF TRUTH (Track B): Supabase.
 *   - Postgres `projects` (published, ordered by sort_order) + their `images`
 *     (ordered by sort_order) describe the structure.
 *   - The private Storage bucket `originals` holds the source files at
 *     `originals/{slug}/{imageId}.{ext}` (== images.storage_path).
 *   - `site_settings` (id=1) holds the hero + about image selections.
 *
 * For each image in each published project:
 *   - Download the original from Supabase Storage
 *   - Generate 4 size tiers (320, 640, 1280, 2400) × 2 formats (avif, webp)
 *   - Generate a tiny base64 webp blur for the LQIP
 *   - Upload all variants to R2 under galleries/{slug}/{imageId}-{size}.{format}
 *
 * The R2 serving path is UNCHANGED — buildAndUploadVariants is verbatim.
 *
 * Outputs to /src/generated (server/build-time only):
 *   - project-{slug}.json   GalleryImage[] for that project, ordered
 *   - projects.json          WorkEntry[] index, ordered by projects.sort_order
 *   - hero.json              { path, blurDataURL, width, height, alt } | null
 *   - about-image.json       (existing shape) + public/about/about.webp
 *
 * Incremental: a manifest at scripts/.manifests/project-{slug}.json stores
 * { updatedAt, blurDataURL, width, height } per image.id. Images whose
 * images.updated_at is unchanged AND which still have a cached blur+dims are
 * skipped (no re-download, no re-upload). Deletion sweeps remove stale R2
 * variants for removed images and for projects that no longer exist / aren't
 * published.
 *
 * Required env vars (.env.local / CI secrets):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   NEXT_PUBLIC_GALLERY_CDN_BASE (e.g. https://pub-xxxxxxxx.r2.dev)
 *
 * Usage: npm run generate-galleries
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { writeFile, mkdir, readFile, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import type { Database } from '../src/types/supabase';

async function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const envContent = await readFile(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
}

const SIZES = [
  { name: 'sm', width: 320 },
  { name: 'md', width: 640 },
  { name: 'lg', width: 1280 },
  { name: 'xl', width: 2400 },
] as const;

const FORMATS = ['avif', 'webp'] as const;

sharp.cache({ memory: 512, files: 0, items: 100 });
sharp.concurrency(4);
sharp.simd(true);

/// Defensive normalization of env values pulled from any source.
/// - .env.local lines: the in-house loader strips surrounding "..." pairs,
///   but unbalanced quotes (one " on one end) survive
/// - GitHub Actions Secrets: stored absolutely verbatim, no expansion
/// - Vercel env vars: stored verbatim
/// Strips any leading/trailing single or double quotes, then expands literal
/// \n escape sequences. Safe to call on any string env var.
function normalizeEnv(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^["']+/, '')
    .replace(/["']+$/, '')
    .replace(/\\n/g, '\n');
}

function getSupabaseClient(): SupabaseClient<Database> {
  const url = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase credentials missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  // Service role bypasses RLS — build-time only, never shipped to the client.
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getR2Client() {
  const accountId = normalizeEnv(process.env.R2_ACCOUNT_ID);
  const accessKeyId = normalizeEnv(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = normalizeEnv(process.env.R2_SECRET_ACCESS_KEY);
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 credentials missing. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.'
    );
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// ---- DB row shapes (from the generated Database type) ----
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type ImageRow = Database['public']['Tables']['images']['Row'];

interface ExifShape {
  camera?: string;
  lens?: string;
  settings?: string;
  date?: string;
}

function readExif(raw: ImageRow['exif']): ExifShape {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' && v.length ? v : undefined);
    return {
      camera: str(o.camera),
      lens: str(o.lens),
      settings: str(o.settings),
      date: str(o.date),
    };
  }
  return {};
}

interface ManifestEntry {
  updatedAt: string;
  blurDataURL: string;
  width: number;
  height: number;
}
type Manifest = Record<string, ManifestEntry>;

async function uploadVariant(opts: {
  r2: S3Client;
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const { r2, bucket, key, body, contentType } = opts;
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
}

async function buildAndUploadVariants(opts: {
  r2: S3Client;
  bucket: string;
  slug: string;
  fileId: string;
  buffer: Buffer;
}) {
  const { r2, bucket, slug, fileId, buffer } = opts;

  const source = sharp(buffer, { failOn: 'none' }).rotate();
  const meta = await source.metadata();

  await Promise.all(
    SIZES.flatMap((size) =>
      FORMATS.map(async (format) => {
        const key = `galleries/${slug}/${fileId}-${size.name}.${format}`;
        const pipeline = source
          .clone()
          .resize(size.width, null, {
            fit: 'inside',
            withoutEnlargement: true,
            kernel: 'lanczos3',
            fastShrinkOnLoad: true,
          });

        const variantBuffer =
          format === 'avif'
            ? await pipeline
                .avif({ quality: 75, effort: 6, chromaSubsampling: '4:4:4' })
                .toBuffer()
            : await pipeline.webp({ quality: 88, effort: 5 }).toBuffer();

        await uploadVariant({
          r2,
          bucket,
          key,
          body: variantBuffer,
          contentType: format === 'avif' ? 'image/avif' : 'image/webp',
        });
      })
    )
  );

  const blurBuffer = await source
    .clone()
    .resize(24, null, { fit: 'inside', kernel: 'lanczos3' })
    .webp({ quality: 40, effort: 0 })
    .toBuffer();
  const blurDataURL = `data:image/webp;base64,${blurBuffer.toString('base64')}`;

  return { width: meta.width || 1920, height: meta.height || 1080, blurDataURL };
}

// Matches src/types/image.ts GalleryImage.
interface GalleryImageOutput {
  id: string;
  avif: { sm: string; md: string; lg: string; xl: string };
  webp: { sm: string; md: string; lg: string; xl: string };
  src: string;
  thumbnail: string;
  blurDataURL: string;
  alt: string;
  title: string;
  description: string;
  category: string;
  width: number;
  height: number;
  metadata: {
    camera?: string;
    lens?: string;
    settings?: string;
    date?: string;
  };
}

// Matches src/lib/projects.ts WorkEntry.
interface WorkEntryOutput {
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

interface HeroOutput {
  path: string;
  blurDataURL?: string;
  width: number;
  height: number;
  alt: string;
}

// Per-image derived values needed after the build (covers, hero, about).
interface BuiltImage {
  id: string;
  slug: string;
  blurDataURL: string;
  width: number;
  height: number;
}

async function downloadOriginal(
  supabase: SupabaseClient<Database>,
  storagePath: string
): Promise<Buffer> {
  const { data, error } = await supabase.storage.from('originals').download(storagePath);
  if (error || !data) {
    throw new Error(`Failed to download original "${storagePath}": ${error?.message ?? 'no data'}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

const MANIFEST_DIR = () => path.join(process.cwd(), 'scripts', '.manifests');
const GENERATED_DIR = () => path.join(process.cwd(), 'src', 'generated');

/**
 * Build one published project: download + Sharp + R2 upload (incremental),
 * write project-{slug}.json, and return the built-image lookup for covers/hero.
 */
async function buildProject(opts: {
  supabase: SupabaseClient<Database>;
  r2: S3Client;
  bucket: string;
  cdnBase: string;
  project: ProjectRow;
  images: ImageRow[];
}): Promise<{ count: number; built: Map<string, BuiltImage> }> {
  const { supabase, r2, bucket, cdnBase, project, images } = opts;
  const slug = project.slug;

  const manifestPath = path.join(MANIFEST_DIR(), `project-${slug}.json`);
  const prior: Manifest = existsSync(manifestPath)
    ? JSON.parse(await readFile(manifestPath, 'utf-8'))
    : {};

  const currentIds = new Set(images.map((img) => img.id));

  // Deletion sweep: image ids in the prior manifest but absent now → delete
  // their 8 R2 variants. R2 accepts up to 1000 keys per DeleteObjects call.
  const staleIds = Object.keys(prior).filter((id) => !currentIds.has(id));
  let deleted = 0;
  if (staleIds.length > 0) {
    console.log(`  Deleting ${staleIds.length} stale images from R2…`);
    const objects = staleIds.flatMap((id) =>
      SIZES.flatMap((size) =>
        FORMATS.map((fmt) => ({ Key: `galleries/${slug}/${id}-${size.name}.${fmt}` }))
      )
    );
    for (let i = 0; i < objects.length; i += 1000) {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects.slice(i, i + 1000), Quiet: true },
        })
      );
    }
    deleted = staleIds.length;
  }

  const next: Manifest = {};
  const built = new Map<string, BuiltImage>();
  const out: GalleryImageOutput[] = [];
  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const id = img.id;
    const stamp = img.updated_at || '';
    const title = img.title || img.alt || `Image ${i + 1}`;
    const alt = img.alt || img.title || title;
    const exif = readExif(img.exif);

    const cached = prior[id];
    const canSkip =
      !!cached &&
      cached.updatedAt === stamp &&
      !!cached.blurDataURL &&
      !!cached.width &&
      !!cached.height;

    let entry: ManifestEntry;
    if (canSkip) {
      entry = cached;
      skipped++;
    } else {
      console.log(`  [${i + 1}/${images.length}] Building + uploading ${title}…`);
      const buffer = await downloadOriginal(supabase, img.storage_path);
      const result = await buildAndUploadVariants({ r2, bucket, slug, fileId: id, buffer });
      entry = {
        updatedAt: stamp,
        blurDataURL: result.blurDataURL,
        // Prefer the DB-recorded dims when present; fall back to Sharp's.
        width: img.width || result.width,
        height: img.height || result.height,
      };
      processed++;
    }

    next[id] = entry;
    built.set(id, {
      id,
      slug,
      blurDataURL: entry.blurDataURL,
      width: entry.width,
      height: entry.height,
    });

    const base = `${cdnBase}/galleries/${slug}/${id}`;
    out.push({
      id,
      avif: { sm: `${base}-sm.avif`, md: `${base}-md.avif`, lg: `${base}-lg.avif`, xl: `${base}-xl.avif` },
      webp: { sm: `${base}-sm.webp`, md: `${base}-md.webp`, lg: `${base}-lg.webp`, xl: `${base}-xl.webp` },
      src: `${base}-xl.webp`,
      thumbnail: `${base}-md.webp`,
      blurDataURL: entry.blurDataURL,
      alt,
      title,
      description: '',
      category: project.category || '',
      width: entry.width,
      height: entry.height,
      metadata: {
        camera: exif.camera,
        lens: exif.lens,
        settings: exif.settings,
        date: exif.date,
      },
    });
  }

  await mkdir(MANIFEST_DIR(), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(next, null, 2));
  await writeFile(
    path.join(GENERATED_DIR(), `project-${slug}.json`),
    JSON.stringify(out, null, 2)
  );

  console.log(
    `  ✅ ${project.title} (${slug}): ${processed} built · ${skipped} skipped · ${deleted} deleted\n`
  );
  return { count: out.length, built };
}

/**
 * Remove R2 variants + manifest + generated JSON for project slugs that no
 * longer exist or are no longer published. Prior slugs are discovered from the
 * existing project-{slug}.json manifests on disk.
 */
async function sweepRemovedProjects(opts: {
  r2: S3Client;
  bucket: string;
  liveSlugs: Set<string>;
}) {
  const { r2, bucket, liveSlugs } = opts;
  const manifestDir = MANIFEST_DIR();
  if (!existsSync(manifestDir)) return;

  const files = await readdir(manifestDir);
  const priorSlugs = files
    .filter((f) => f.startsWith('project-') && f.endsWith('.json'))
    .map((f) => f.slice('project-'.length, -'.json'.length));

  for (const slug of priorSlugs) {
    if (liveSlugs.has(slug)) continue;
    const manifestPath = path.join(manifestDir, `project-${slug}.json`);
    console.log(`  Removing dropped project "${slug}" from R2…`);
    try {
      const prior: Manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
      const ids = Object.keys(prior);
      const objects = ids.flatMap((id) =>
        SIZES.flatMap((size) =>
          FORMATS.map((fmt) => ({ Key: `galleries/${slug}/${id}-${size.name}.${fmt}` }))
        )
      );
      for (let i = 0; i < objects.length; i += 1000) {
        if (objects.length === 0) break;
        await r2.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objects.slice(i, i + 1000), Quiet: true },
          })
        );
      }
    } catch (err) {
      console.warn(`  ⚠️  Could not sweep "${slug}":`, err);
    }
    // Drop the manifest + generated per-project JSON so they don't linger.
    await unlink(manifestPath).catch(() => {});
    await unlink(path.join(GENERATED_DIR(), `project-${slug}.json`)).catch(() => {});
  }
}

/**
 * Build the about image (public/about/about.webp + about-image.json) from
 * site_settings.about_image_id. Folds in the old generate-about-image script.
 * If about_image_id is null, leaves the existing files untouched.
 */
async function buildAboutImage(opts: {
  supabase: SupabaseClient<Database>;
  aboutImage: ImageRow | null;
}) {
  const { supabase, aboutImage } = opts;
  if (!aboutImage) {
    console.log('  ℹ️  No about_image_id set — leaving about-image.json untouched.');
    return;
  }

  const publicDir = path.join(process.cwd(), 'public', 'about');
  await mkdir(publicDir, { recursive: true });

  const buffer = await downloadOriginal(supabase, aboutImage.storage_path);
  const outputPath = path.join(publicDir, 'about.webp');
  const processed = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(1200, null, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
      fastShrinkOnLoad: true,
    })
    .webp({ quality: 93, effort: 6 })
    .toBuffer({ resolveWithObject: true });
  await writeFile(outputPath, processed.data);

  const blurBuffer = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(32, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 20 })
    .toBuffer();
  const blurDataURL = `data:image/webp;base64,${blurBuffer.toString('base64')}`;

  const metadata = {
    filename: 'about.webp',
    path: '/about/about.webp',
    width: processed.info.width,
    height: processed.info.height,
    size: processed.data.length,
    format: 'webp',
    blurDataURL,
    originalFilename: aboutImage.title || aboutImage.alt || aboutImage.storage_path,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(
    path.join(GENERATED_DIR(), 'about-image.json'),
    JSON.stringify(metadata, null, 2)
  );
  console.log(`  ✅ About image built (${metadata.width}x${metadata.height}).`);
}

/**
 * Emit src/generated/projects-registry.ts — a server-only module that statically
 * imports each project-{slug}.json so the per-slug page can resolve them under
 * `output: export`. Keyed by slug. Importing JSON requires resolveJsonModule
 * (already on) and the module must only ever be imported server-side.
 */
async function writeProjectsRegistry(slugs: string[]) {
  const sanitize = (slug: string) =>
    'p_' + slug.replace(/[^a-zA-Z0-9_]/g, '_');
  const importLines = slugs
    .map((slug) => `import ${sanitize(slug)} from './project-${slug}.json';`)
    .join('\n');
  const mapLines = slugs
    .map((slug) => `  ${JSON.stringify(slug)}: ${sanitize(slug)} as GalleryImage[],`)
    .join('\n');

  const body = `// AUTO-GENERATED by scripts/generate-gallery-data.ts — do not edit by hand.
// Server-only registry of per-project image data. Statically imports each
// project-{slug}.json so gallery/[slug] resolves under \`output: export\`.
// Never import this from a client component — it would ship every project's
// image JSON to the browser.
import type { GalleryImage } from '@/types/image';
${importLines ? importLines + '\n' : ''}
export const PROJECT_IMAGES: Record<string, GalleryImage[]> = {
${mapLines}
};
`;
  await writeFile(path.join(GENERATED_DIR(), 'projects-registry.ts'), body);
}

async function main() {
  console.log('🎨 Gallery prebuild pipeline (Supabase → R2)\n');
  await loadEnv();

  const cdnBase = normalizeEnv(process.env.NEXT_PUBLIC_GALLERY_CDN_BASE).replace(/\/$/, '');
  const bucket = normalizeEnv(process.env.R2_BUCKET);
  if (!cdnBase) throw new Error('NEXT_PUBLIC_GALLERY_CDN_BASE is required.');
  if (!bucket) throw new Error('R2_BUCKET is required.');

  await mkdir(GENERATED_DIR(), { recursive: true });

  const supabase = getSupabaseClient();
  const r2 = getR2Client();

  // ---- Structure from Postgres ----
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true });
  if (projErr) throw new Error(`Failed to query projects: ${projErr.message}`);

  const { data: settingsRows, error: settingsErr } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .limit(1);
  if (settingsErr) throw new Error(`Failed to query site_settings: ${settingsErr.message}`);
  const settings = settingsRows?.[0] ?? null;

  const liveProjects = projects ?? [];
  const liveSlugs = new Set(liveProjects.map((p) => p.slug));

  // Sweep R2 + manifests for projects that dropped out / were unpublished.
  await sweepRemovedProjects({ r2, bucket, liveSlugs });

  // Build each published project; collect every built image keyed by id so we
  // can resolve cover/hero/about by their image id afterward.
  const start = Date.now();
  const allBuilt = new Map<string, BuiltImage>();
  const index: WorkEntryOutput[] = [];
  const failures: { slug: string; err: unknown }[] = [];

  for (const project of liveProjects) {
    console.log(`📸 ${project.title} (${project.slug})`);
    try {
      const { data: imgs, error: imgErr } = await supabase
        .from('images')
        .select('*')
        .eq('project_id', project.id)
        .order('sort_order', { ascending: true });
      if (imgErr) throw new Error(`Failed to query images: ${imgErr.message}`);
      const images = imgs ?? [];

      const { count, built } = await buildProject({
        supabase,
        r2,
        bucket,
        cdnBase,
        project,
        images,
      });
      built.forEach((b, id) => allBuilt.set(id, b));

      // Resolve the cover: chosen cover_image_id, or fall back to the first.
      const coverId =
        (project.cover_image_id && built.has(project.cover_image_id)
          ? project.cover_image_id
          : images[0]?.id) || null;
      const cover = coverId ? built.get(coverId) : undefined;

      index.push({
        slug: project.slug,
        title: project.title,
        category: project.category || '',
        blurb: project.blurb || '',
        count,
        coverPath: cover
          ? `${cdnBase}/galleries/${project.slug}/${cover.id}-lg.webp`
          : '',
        blurDataURL: cover?.blurDataURL,
        width: cover?.width ?? 0,
        height: cover?.height ?? 0,
      });
    } catch (err) {
      console.error(`  ❌ ${project.title}:`, err);
      failures.push({ slug: project.slug, err });
    }
  }

  // ---- Index (projects.json), already ordered by sort_order from the query ----
  await writeFile(
    path.join(GENERATED_DIR(), 'projects.json'),
    JSON.stringify(index, null, 2)
  );

  // ---- Server-only registry: slug → GalleryImage[] (static imports) ----
  // The set of project-{slug}.json files is data-dependent. A generated module
  // with explicit static imports lets `output: export` + generateStaticParams
  // resolve every project page at build time, while keeping all per-project
  // image data server-side (this module is imported only in the RSC).
  await writeProjectsRegistry(index.map((e) => e.slug));

  // ---- Hero (hero.json) from site_settings.hero_image_id ----
  let hero: HeroOutput | null = null;
  const heroId = settings?.hero_image_id ?? null;
  if (heroId) {
    const built = allBuilt.get(heroId);
    if (built) {
      // Look up the hero image's row for alt text.
      const { data: heroRow } = await supabase
        .from('images')
        .select('alt, title')
        .eq('id', heroId)
        .limit(1)
        .maybeSingle();
      hero = {
        path: `${cdnBase}/galleries/${built.slug}/${built.id}-xl.webp`,
        blurDataURL: built.blurDataURL,
        width: built.width,
        height: built.height,
        alt: heroRow?.alt || heroRow?.title || 'Editorial portrait — Viraj Singh',
      };
    } else {
      // hero_image_id points at an image whose project isn't published/built.
      console.log(
        '  ⚠️  hero_image_id is set but its image is not in a published project — writing null hero.'
      );
    }
  }
  await writeFile(path.join(GENERATED_DIR(), 'hero.json'), JSON.stringify(hero, null, 2));

  // ---- About image (folds in generate-about) from site_settings.about_image_id ----
  let aboutImage: ImageRow | null = null;
  const aboutId = settings?.about_image_id ?? null;
  if (aboutId) {
    const { data: aboutRow } = await supabase
      .from('images')
      .select('*')
      .eq('id', aboutId)
      .limit(1)
      .maybeSingle();
    aboutImage = aboutRow ?? null;
  }
  await buildAboutImage({ supabase, aboutImage });

  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✨ Built ${index.length} project(s) in ${secs}s\n`);

  if (failures.length > 0) {
    console.error(
      `\n❌ ${failures.length}/${liveProjects.length} project(s) failed: ${failures
        .map((f) => f.slug)
        .join(', ')}`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
