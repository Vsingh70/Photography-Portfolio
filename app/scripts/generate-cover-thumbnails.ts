#!/usr/bin/env tsx
/**
 * Generate Gallery Cover Thumbnails Script
 *
 * This script downloads gallery cover images from Google Drive and pre-generates
 * optimized thumbnails at build time. This eliminates serverless cold starts
 * and Google Drive API latency for gallery cover images.
 *
 * Usage:
 *   npm run generate-covers
 *
 * Output:
 *   - WebP thumbnails saved to public/gallery-covers/
 *   - Metadata JSON saved to src/generated/cover-thumbnails.json
 */

import { google } from 'googleapis';
import sharp from 'sharp';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Load environment variables from .env.local
async function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const envContent = await readFile(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        process.env[key] = cleanValue;
      }
    });
  }
}

// Import gallery cover mappings
interface GalleryCoverMapping {
  filename: string;
  categorySlug: string;
  displayTitle: string;
  displayOrder: number;
  fileId?: string;
  width?: number;
  height?: number;
}

const GALLERY_COVER_MAPPINGS: GalleryCoverMapping[] = [
  {
    filename: 'editorial_cover.jpg',
    categorySlug: 'editorial',
    displayTitle: 'Editorial',
    displayOrder: 1,
    fileId: '1zPR5I5kLAv-MIq6ZcMYf2WndBHXA6iPy',
    width: 1920,
    height: 1280,
  },
  {
    filename: 'grad_cover.jpg',
    categorySlug: 'graduation',
    displayTitle: 'Graduation',
    displayOrder: 2,
    fileId: '15AyXLwX-ktsogZ3ZdAFSEJtYIC5eb5fd',
    width: 1920,
    height: 1280,
  },
  {
    filename: 'portrait_cover.jpg',
    categorySlug: 'portraits',
    displayTitle: 'Portrait',
    displayOrder: 3,
    fileId: '1QGtxSiB8M5FfUxZluLVlFew5LNFX-GlU',
    width: 1920,
    height: 1280,
  },
  {
    filename: 'engagement_cover.jpg',
    categorySlug: 'engagement',
    displayTitle: 'Engagement',
    displayOrder: 4,
    fileId: '1OmFSoqc_lJQT2GoI-PWn6dFrCcVudgSC',
    width: 1920,
    height: 1280,
  },
  {
    filename: 'event_cover.jpg',
    categorySlug: 'events',
    displayTitle: 'Event',
    displayOrder: 5,
    fileId: '1wQzZkiXk1z71LUCvBLZDiVd2dWJoYjd8',
    width: 1920,
    height: 1280,
  },
];

// Configure Sharp
sharp.cache({ memory: 50, files: 20, items: 100 });
sharp.simd(true);
sharp.concurrency(4); // Allow parallel processing for build-time

/**
 * Initialize Google Drive API client
 */
function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Google Drive credentials not found. Please set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Download image from Google Drive
 */
async function downloadImage(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();

  console.log(`  Downloading from Google Drive (ID: ${fileId})...`);

  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
    },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Generate optimized thumbnail in WebP format
 */
async function generateThumbnail(
  imageBuffer: Buffer,
  outputPath: string,
  width: number = 800
): Promise<{ width: number; height: number; size: number }> {
  console.log(`  Generating ${width}px WebP thumbnail...`);

  const processed = await sharp(imageBuffer)
    .resize(width, null, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
      fastShrinkOnLoad: true,
    })
    .webp({
      quality: 93,
      effort: 6, // Higher effort for build-time (better compression)
    })
    .toBuffer({ resolveWithObject: true });

  await writeFile(outputPath, processed.data);

  return {
    width: processed.info.width,
    height: processed.info.height,
    size: processed.data.length,
  };
}

/**
 * Generate blur placeholder (base64 data URL)
 */
async function generateBlurPlaceholder(imageBuffer: Buffer): Promise<string> {
  console.log(`  Generating blur placeholder...`);

  const blurBuffer = await sharp(imageBuffer)
    .resize(32, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 20 })
    .toBuffer();

  return `data:image/webp;base64,${blurBuffer.toString('base64')}`;
}

/**
 * Main execution
 */
async function main() {
  // Load environment variables first
  await loadEnv();

  console.log('🎨 Gallery Cover Thumbnail Generator\n');
  console.log('This will pre-generate optimized thumbnails for instant loading.\n');

  // Setup directories
  const publicDir = path.join(process.cwd(), 'public', 'gallery-covers');
  const generatedDir = path.join(process.cwd(), 'src', 'generated');

  if (!existsSync(publicDir)) {
    await mkdir(publicDir, { recursive: true });
    console.log(`✅ Created directory: ${publicDir}\n`);
  }

  if (!existsSync(generatedDir)) {
    await mkdir(generatedDir, { recursive: true });
    console.log(`✅ Created directory: ${generatedDir}\n`);
  }

  // Process each cover image
  const results = [];
  let totalSaved = 0;

  for (const mapping of GALLERY_COVER_MAPPINGS) {
    if (!mapping.fileId) {
      console.log(`⚠️  Skipping ${mapping.displayTitle}: No file ID configured\n`);
      continue;
    }

    console.log(`📸 Processing: ${mapping.displayTitle} (${mapping.categorySlug})`);

    try {
      // Download original from Google Drive
      const imageBuffer = await downloadImage(mapping.fileId);
      console.log(`  Original size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      // Generate WebP thumbnail
      const outputFilename = `${mapping.categorySlug}.webp`;
      const outputPath = path.join(publicDir, outputFilename);
      const thumbnailInfo = await generateThumbnail(imageBuffer, outputPath, 800);

      // Generate blur placeholder
      const blurDataURL = await generateBlurPlaceholder(imageBuffer);

      const savings = ((1 - thumbnailInfo.size / imageBuffer.length) * 100).toFixed(1);
      totalSaved += imageBuffer.length - thumbnailInfo.size;

      console.log(`  ✅ Saved: ${(thumbnailInfo.size / 1024).toFixed(0)} KB (${savings}% smaller)`);
      console.log(`  📐 Dimensions: ${thumbnailInfo.width}x${thumbnailInfo.height}`);

      // Store metadata
      results.push({
        categorySlug: mapping.categorySlug,
        displayTitle: mapping.displayTitle,
        displayOrder: mapping.displayOrder,
        filename: outputFilename,
        path: `/gallery-covers/${outputFilename}`,
        width: thumbnailInfo.width,
        height: thumbnailInfo.height,
        size: thumbnailInfo.size,
        format: 'webp',
        blurDataURL,
      });

      console.log(`  ✅ Complete!\n`);
    } catch (error) {
      console.error(`  ❌ Error processing ${mapping.displayTitle}:`, error);
      console.log('');
    }
  }

  // Save metadata JSON
  const metadataPath = path.join(generatedDir, 'cover-thumbnails.json');
  await writeFile(metadataPath, JSON.stringify(results, null, 2));

  console.log(`\n✨ Generation Complete!\n`);
  console.log(`📊 Summary:`);
  console.log(`   - Thumbnails generated: ${results.length}/${GALLERY_COVER_MAPPINGS.length}`);
  console.log(`   - Total size saved: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   - Output directory: ${publicDir}`);
  console.log(`   - Metadata file: ${metadataPath}`);
  console.log(`\n🚀 Gallery covers will now load instantly!\n`);
}

// Run the script
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
