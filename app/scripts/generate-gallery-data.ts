#!/usr/bin/env tsx
/**
 * Generate gallery data + upload prebuilt image variants to Cloudflare R2.
 *
 * For each image in each Google Drive gallery folder:
 *   - Download the original
 *   - Generate 4 size tiers (320, 640, 1280, 2400) × 2 formats (avif, webp)
 *   - Generate a tiny base64 webp blur for the LQIP
 *   - Upload all variants to R2 under galleries/{slug}/{fileId}-{size}.{format}
 *   - Write the metadata JSON to /src/generated/gallery-{slug}.json with
 *     URLs pointing at NEXT_PUBLIC_GALLERY_CDN_BASE
 *
 * Incremental: a manifest at scripts/.manifests/gallery-{slug}.json stores the
 * Drive modifiedTime per fileId. Files whose modifiedTime is unchanged AND
 * which still have a blur sidecar are skipped (no re-download, no re-upload).
 *
 * Required env vars (.env.local):
 *   GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY
 *   GOOGLE_DRIVE_{EDITORIAL,GRADUATION,PORTRAITS,ENGAGEMENT,EVENTS}_FOLDER_ID
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   NEXT_PUBLIC_GALLERY_CDN_BASE (e.g. https://pub-xxxxxxxx.r2.dev)
 *
 * Usage: npm run generate-galleries
 */

import { google } from 'googleapis';
import sharp from 'sharp';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
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

interface ManifestEntry {
  modifiedTime: string;
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

async function buildGallery(gallery: GalleryConfig, cdnBase: string, bucket: string) {
  const folderId = process.env[gallery.folderIdEnvVar];
  if (!folderId) {
    console.log(`  ⚠️  Skipping ${gallery.name}: no ${gallery.folderIdEnvVar}`);
    return null;
  }

  const drive = getDriveClient();
  const r2 = getR2Client();

  const manifestDir = path.join(process.cwd(), 'scripts', '.manifests');
  if (!existsSync(manifestDir)) await mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `gallery-${gallery.slug}.json`);
  const prior: Manifest = existsSync(manifestPath)
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

  const next: Manifest = {};
  const images: GalleryImageOutput[] = [];
  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileId = file.id!;
    const stamp = file.modifiedTime || '';
    const title = file.name?.replace(/\.[^/.]+$/, '') || `Image ${i + 1}`;
    const imgMeta = file.imageMediaMetadata as ImageMediaMetadata | undefined;

    const cached = prior[fileId];
    const canSkip =
      cached &&
      cached.modifiedTime === stamp &&
      cached.blurDataURL &&
      cached.width &&
      cached.height;

    let entry: ManifestEntry;

    if (canSkip) {
      entry = cached;
      skipped++;
    } else {
      console.log(`  [${i + 1}/${files.length}] Building + uploading ${title}…`);
      const resp = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      const buffer = Buffer.from(resp.data as ArrayBuffer);
      const result = await buildAndUploadVariants({
        r2,
        bucket,
        slug: gallery.slug,
        fileId,
        buffer,
      });
      entry = {
        modifiedTime: stamp,
        blurDataURL: result.blurDataURL,
        width: result.width,
        height: result.height,
      };
      processed++;
    }

    next[fileId] = entry;

    const base = `${cdnBase}/galleries/${gallery.slug}/${fileId}`;
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
      blurDataURL: entry.blurDataURL,
      alt: title,
      title,
      description: '',
      category: gallery.name,
      width: entry.width,
      height: entry.height,
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

  await writeFile(manifestPath, JSON.stringify(next, null, 2));
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
  console.log('🎨 Gallery prebuild pipeline (R2)\n');
  await loadEnv();

  const cdnBase = process.env.NEXT_PUBLIC_GALLERY_CDN_BASE?.replace(/\/$/, '');
  const bucket = process.env.R2_BUCKET;
  if (!cdnBase) throw new Error('NEXT_PUBLIC_GALLERY_CDN_BASE is required.');
  if (!bucket) throw new Error('R2_BUCKET is required.');

  const generatedDir = path.join(process.cwd(), 'src', 'generated');
  if (!existsSync(generatedDir)) await mkdir(generatedDir, { recursive: true });

  const start = Date.now();
  let total = 0;
  for (const gallery of GALLERIES) {
    console.log(`📸 ${gallery.name} (${gallery.slug})`);
    try {
      const count = await buildGallery(gallery, cdnBase, bucket);
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
