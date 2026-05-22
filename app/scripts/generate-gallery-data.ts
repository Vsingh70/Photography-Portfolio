#!/usr/bin/env tsx
/**
 * Generate gallery data + prebuilt image variants.
 *
 * For each image in each Google Drive gallery folder:
 *   - Download the original
 *   - Generate 4 size tiers (320, 640, 1280, 2400) × 2 formats (avif, webp)
 *   - Generate a ~500B base64 webp blur for the LQIP
 *   - Write all variants to /public/galleries/{slug}/{fileId}-{size}.{format}
 *   - Write the metadata JSON to /src/generated/gallery-{slug}.json
 *
 * Incremental: a .manifest.json sidecar per gallery stores the Drive
 * modifiedTime per fileId. On subsequent runs, only files whose modifiedTime
 * changed are reprocessed.
 *
 * Usage: npm run generate-galleries
 */

import { google } from 'googleapis';
import sharp from 'sharp';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

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

interface GalleryConfig {
  slug: string;
  name: string;
  folderIdEnvVar: string;
}

const GALLERIES: GalleryConfig[] = [
  { slug: 'editorial',  name: 'Editorial',  folderIdEnvVar: 'GOOGLE_DRIVE_EDITORIAL_FOLDER_ID' },
  { slug: 'graduation', name: 'Graduation', folderIdEnvVar: 'GOOGLE_DRIVE_GRADUATION_FOLDER_ID' },
  { slug: 'portraits',  name: 'Portrait',   folderIdEnvVar: 'GOOGLE_DRIVE_PORTRAITS_FOLDER_ID' },
  { slug: 'engagement', name: 'Engagement', folderIdEnvVar: 'GOOGLE_DRIVE_ENGAGEMENT_FOLDER_ID' },
  { slug: 'events',     name: 'Event',      folderIdEnvVar: 'GOOGLE_DRIVE_EVENTS_FOLDER_ID' },
];

const SIZES = [
  { name: 'sm', width: 320 },
  { name: 'md', width: 640 },
  { name: 'lg', width: 1280 },
  { name: 'xl', width: 2400 },
] as const;

const FORMATS = ['avif', 'webp'] as const;

const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
];

sharp.cache({ memory: 512, files: 0, items: 100 });
sharp.concurrency(4);
sharp.simd(true);

function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Drive credentials not found. Set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY.'
    );
  }
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

function naturalSort(a: string, b: string): number {
  const regex = /(\d+)|(\D+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    const aNum = parseInt(aPart, 10);
    const bNum = parseInt(bPart, 10);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      const c = aPart.toLowerCase().localeCompare(bPart.toLowerCase());
      if (c !== 0) return c;
    }
  }
  return 0;
}

interface ImageMediaMetadata {
  width?: number;
  height?: number;
  cameraMake?: string;
  cameraModel?: string;
  lens?: string;
  focalLength?: number;
  aperture?: number;
  exposureTime?: number;
  isoSpeed?: number;
}

function formatCameraSettings(m: ImageMediaMetadata | undefined): string | undefined {
  if (!m) return undefined;
  const parts: string[] = [];
  if (m.focalLength) parts.push(`${m.focalLength}mm`);
  if (m.aperture)    parts.push(`f/${m.aperture}`);
  if (m.exposureTime) {
    const s = m.exposureTime < 1 ? `1/${Math.round(1 / m.exposureTime)}` : `${m.exposureTime}s`;
    parts.push(s);
  }
  if (m.isoSpeed) parts.push(`ISO ${m.isoSpeed}`);
  return parts.length ? parts.join(' · ') : undefined;
}

async function buildImageVariants(opts: {
  fileId: string;
  buffer: Buffer;
  outDir: string;
}) {
  const { fileId, buffer, outDir } = opts;

  const source = sharp(buffer, { failOn: 'none' }).rotate();
  const meta = await source.metadata();

  await Promise.all(
    SIZES.flatMap((size) =>
      FORMATS.map(async (format) => {
        const outPath = path.join(outDir, `${fileId}-${size.name}.${format}`);
        const pipeline = source
          .clone()
          .resize(size.width, null, {
            fit: 'inside',
            withoutEnlargement: true,
            kernel: 'lanczos3',
            fastShrinkOnLoad: true,
          });

        if (format === 'avif') {
          await pipeline
            .avif({ quality: 75, effort: 6, chromaSubsampling: '4:4:4' })
            .toFile(outPath);
        } else {
          await pipeline.webp({ quality: 88, effort: 5 }).toFile(outPath);
        }
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

async function buildGallery(gallery: GalleryConfig) {
  const folderId = process.env[gallery.folderIdEnvVar];
  if (!folderId) {
    console.log(`  ⚠️  Skipping ${gallery.name}: no ${gallery.folderIdEnvVar}`);
    return null;
  }

  const drive = getDriveClient();
  const outDir = path.join(process.cwd(), 'public', 'galleries', gallery.slug);
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const manifestPath = path.join(outDir, '.manifest.json');
  const prior: Record<string, string> = existsSync(manifestPath)
    ? JSON.parse(await readFile(manifestPath, 'utf-8'))
    : {};

  const listResp = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and (${SUPPORTED_IMAGE_TYPES.map((t) => `mimeType='${t}'`).join(' or ')})`,
    fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, imageMediaMetadata)',
    orderBy: 'name',
    pageSize: 1000,
  });
  const files = (listResp.data.files || []).sort((a, b) =>
    naturalSort(a.name || '', b.name || '')
  );

  console.log(`  Found ${files.length} images`);

  const manifest: Record<string, string> = {};
  const images: GalleryImageOutput[] = [];
  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileId = file.id!;
    const stamp = file.modifiedTime || '';
    manifest[fileId] = stamp;

    const title = file.name?.replace(/\.[^/.]+$/, '') || `Image ${i + 1}`;
    const imgMeta = file.imageMediaMetadata as ImageMediaMetadata | undefined;

    const needsBuild =
      prior[fileId] !== stamp ||
      !existsSync(path.join(outDir, `${fileId}-xl.avif`));

    let dims = { width: imgMeta?.width || 1920, height: imgMeta?.height || 1080 };
    let blurDataURL: string;

    if (needsBuild) {
      console.log(`  [${i + 1}/${files.length}] Building ${title}…`);
      const resp = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      const buffer = Buffer.from(resp.data as ArrayBuffer);
      const result = await buildImageVariants({ fileId, buffer, outDir });
      dims = { width: result.width, height: result.height };
      blurDataURL = result.blurDataURL;
      await writeFile(path.join(outDir, `${fileId}.blur.txt`), blurDataURL);
      processed++;
    } else {
      const blurPath = path.join(outDir, `${fileId}.blur.txt`);
      blurDataURL = existsSync(blurPath)
        ? await readFile(blurPath, 'utf-8')
        : '';
      skipped++;
    }

    const base = `/galleries/${gallery.slug}/${fileId}`;
    images.push({
      id: fileId,
      avif: {
        sm: `${base}-sm.avif`,
        md: `${base}-md.avif`,
        lg: `${base}-lg.avif`,
        xl: `${base}-xl.avif`,
      },
      webp: {
        sm: `${base}-sm.webp`,
        md: `${base}-md.webp`,
        lg: `${base}-lg.webp`,
        xl: `${base}-xl.webp`,
      },
      src: `${base}-xl.webp`,
      thumbnail: `${base}-md.webp`,
      blurDataURL,
      alt: title,
      title,
      description: '',
      category: gallery.name,
      width: dims.width,
      height: dims.height,
      metadata: {
        camera:
          imgMeta?.cameraMake && imgMeta?.cameraModel
            ? `${imgMeta.cameraMake} ${imgMeta.cameraModel}`
            : undefined,
        lens: imgMeta?.lens || undefined,
        settings: formatCameraSettings(imgMeta),
        date: file.createdTime || undefined,
      },
    });
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  const jsonPath = path.join(
    process.cwd(),
    'src',
    'generated',
    `gallery-${gallery.slug}.json`
  );
  await writeFile(jsonPath, JSON.stringify(images, null, 2));

  console.log(`  ✅ ${gallery.name}: ${processed} built · ${skipped} skipped\n`);
  return images.length;
}

async function main() {
  console.log('🎨 Gallery prebuild pipeline\n');
  await loadEnv();

  const generatedDir = path.join(process.cwd(), 'src', 'generated');
  if (!existsSync(generatedDir)) await mkdir(generatedDir, { recursive: true });

  const start = Date.now();
  let total = 0;
  for (const gallery of GALLERIES) {
    console.log(`📸 ${gallery.name} (${gallery.slug})`);
    try {
      const count = await buildGallery(gallery);
      if (count) total += count;
    } catch (err) {
      console.error(`  ❌ ${gallery.name}:`, err);
    }
  }
  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✨ Built ${total} images in ${secs}s\n`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
