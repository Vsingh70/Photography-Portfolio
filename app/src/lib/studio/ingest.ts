/**
 * Image ingestion helpers for the Studio composer.
 *
 * Pure browser utilities — no React. Each ingested file gets:
 *   - a SHA-256 hash (dedup within a project)
 *   - a dataURL thumbnail (in-memory preview)
 *   - intrinsic width/height (decoded via createImageBitmap, falling back to Image)
 *   - distilled EXIF { camera, lens, settings, date } via exifr (tolerant of none)
 */

import exifr from 'exifr';
import type { ImageExif, StudioImage } from './types';

export const uid = (): string => crypto.randomUUID();

export async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

/** Decode intrinsic dimensions; resilient across formats and browsers. */
async function readDimensions(
  file: File,
  dataURL: string
): Promise<{ width?: number; height?: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (dims.width && dims.height) return dims;
    } catch {
      // fall through to <img> decode
    }
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({});
    img.src = dataURL;
  });
}

/**
 * Produce a small downscaled JPEG dataURL (~max edge `maxEdge`px) for fast,
 * low-jank grid display. The multi-MB original is never painted into the grid —
 * only this lightweight thumbnail is — which removes the decode/scroll jank the
 * full-resolution dataURL caused. Falls back to the full dataURL if the canvas
 * path is unavailable (e.g. exotic format / no createImageBitmap).
 */
export async function makeThumbnail(
  file: File,
  fallbackDataURL: string,
  maxEdge = 512
): Promise<string> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return fallbackDataURL;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    if (!width || !height) {
      bitmap.close();
      return fallbackDataURL;
    }
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return fallbackDataURL;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return fallbackDataURL;
  }
}

/** Compose a human "settings" string from the usual exposure fields. */
function composeSettings(tags: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  const fNumber = tags.FNumber as number | undefined;
  if (typeof fNumber === 'number') parts.push(`f/${Number(fNumber.toFixed(1))}`);

  const exposure = tags.ExposureTime as number | undefined;
  if (typeof exposure === 'number' && exposure > 0) {
    parts.push(exposure >= 1 ? `${exposure}s` : `1/${Math.round(1 / exposure)}s`);
  }

  const iso = (tags.ISO ?? tags.ISOSpeedRatings) as number | number[] | undefined;
  const isoValue = Array.isArray(iso) ? iso[0] : iso;
  if (typeof isoValue === 'number') parts.push(`ISO ${isoValue}`);

  const focal = tags.FocalLength as number | undefined;
  if (typeof focal === 'number') parts.push(`${Math.round(focal)}mm`);

  return parts.length ? parts.join(' · ') : undefined;
}

/** Distill EXIF to the four fields the public site renders. Tolerates none. */
async function extractExif(file: File): Promise<ImageExif> {
  try {
    const tags = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      pick: [
        'Make',
        'Model',
        'LensModel',
        'FNumber',
        'ExposureTime',
        'ISO',
        'ISOSpeedRatings',
        'FocalLength',
        'DateTimeOriginal',
      ],
    })) as Record<string, unknown> | undefined;

    if (!tags) return {};

    const exif: ImageExif = {};
    const make = (tags.Make as string | undefined)?.trim();
    const model = (tags.Model as string | undefined)?.trim();
    if (make || model) {
      // Avoid "Canon Canon EOS R5" style duplication.
      exif.camera = make && model && model.startsWith(make) ? model : [make, model].filter(Boolean).join(' ');
    }
    const lens = (tags.LensModel as string | undefined)?.trim();
    if (lens) exif.lens = lens;

    const settings = composeSettings(tags);
    if (settings) exif.settings = settings;

    const date = tags.DateTimeOriginal as Date | string | undefined;
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      exif.date = date.toISOString();
    } else if (typeof date === 'string' && date) {
      exif.date = date;
    }

    return exif;
  } catch {
    return {};
  }
}

/**
 * Ingest a batch of files into StudioImages, deduping against
 * `existingHashes`. Mutates the provided hash set so duplicates inside the
 * same batch are also caught. Non-image files are skipped by the caller.
 */
export async function ingestFile(file: File, existingHashes: Set<string>): Promise<StudioImage> {
  const [dataURL, buffer] = await Promise.all([readAsDataURL(file), readAsArrayBuffer(file)]);
  const hash = await sha256(buffer);
  const duplicate = existingHashes.has(hash);
  existingHashes.add(hash);

  const [{ width, height }, exif, thumbDataURL] = await Promise.all([
    readDimensions(file, dataURL),
    extractExif(file),
    makeThumbnail(file, dataURL),
  ]);

  return {
    id: uid(),
    name: file.name,
    size: file.size,
    type: file.type,
    hash,
    // NB: the full-resolution `dataURL` is intentionally NOT retained — it's a
    // ~1.33×-file base64 string that, multiplied across a batch, bloats the
    // React tree enough to OOM the tab (and crash `performance.measure`'s
    // structured clone). `thumbDataURL` (~512px) covers display; `blob` covers
    // upload. The full dataURL is only needed transiently above for decoding.
    thumbDataURL,
    blob: file,
    width,
    height,
    exif,
    alt: '',
    duplicate,
  };
}

/** Lowercase file extension including the dot, e.g. ".jpg". Defaults to ".jpg". */
export function fileExt(name: string, mime?: string): string {
  const fromName = name.match(/\.[^.]+$/)?.[0]?.toLowerCase();
  if (fromName) return fromName;
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/avif') return '.avif';
  if (mime === 'image/heic') return '.heic';
  return '.jpg';
}
