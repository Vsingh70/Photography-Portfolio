#!/usr/bin/env tsx
/**
 * Generate About Page Image Script
 *
 * This script downloads the about image from Google Drive and pre-generates
 * an optimized WebP version at build time. This eliminates serverless cold starts
 * and Google Drive API latency for the about page image.
 *
 * Usage:
 *   npm run generate-about
 *
 * Output:
 *   - WebP image saved to public/about/about.webp
 *   - Metadata JSON saved to src/generated/about-image.json
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

// Configure Sharp
sharp.cache({ memory: 50, files: 20, items: 100 });
sharp.simd(true);
sharp.concurrency(4);

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
 * Get first image from About folder
 */
async function getAboutImageFileId(): Promise<{ fileId: string; filename: string } | null> {
  const folderId = process.env.GOOGLE_DRIVE_ABOUT_FOLDER_ID;

  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_ABOUT_FOLDER_ID not configured in .env.local');
  }

  const drive = getDriveClient();

  console.log(`📁 Scanning About folder (ID: ${folderId})...`);

  const SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ];

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and (${SUPPORTED_IMAGE_TYPES.map((type) => `mimeType='${type}'`).join(' or ')})`,
    fields: 'files(id, name, mimeType)',
    orderBy: 'name',
    pageSize: 1,
  });

  const files = response.data.files || [];

  if (files.length === 0) {
    console.log('⚠️  No images found in About folder');
    return null;
  }

  const file = files[0];
  console.log(`✅ Found image: ${file.name} (ID: ${file.id})`);

  return {
    fileId: file.id!,
    filename: file.name!,
  };
}

/**
 * Download image from Google Drive
 */
async function downloadImage(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();

  console.log(`📥 Downloading from Google Drive...`);

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
 * Generate optimized WebP image
 */
async function generateWebPImage(
  imageBuffer: Buffer,
  outputPath: string,
  maxWidth: number = 1200
): Promise<{ width: number; height: number; size: number }> {
  console.log(`🎨 Generating ${maxWidth}px WebP image...`);

  const processed = await sharp(imageBuffer)
    .resize(maxWidth, null, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
      fastShrinkOnLoad: true,
    })
    .webp({
      quality: 93,
      effort: 6,
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
  console.log(`🌫️  Generating blur placeholder...`);

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

  console.log('🎨 About Image Generator\n');
  console.log('This will pre-generate an optimized about image for instant loading.\n');

  // Get the image file ID from the About folder
  const imageInfo = await getAboutImageFileId();

  if (!imageInfo) {
    console.log('❌ No image found in About folder. Please upload an image first.\n');
    process.exit(1);
  }

  // Setup directories
  const publicDir = path.join(process.cwd(), 'public', 'about');
  const generatedDir = path.join(process.cwd(), 'src', 'generated');

  if (!existsSync(publicDir)) {
    await mkdir(publicDir, { recursive: true });
    console.log(`✅ Created directory: ${publicDir}\n`);
  }

  if (!existsSync(generatedDir)) {
    await mkdir(generatedDir, { recursive: true });
    console.log(`✅ Created directory: ${generatedDir}\n`);
  }

  try {
    // Download original from Google Drive
    const imageBuffer = await downloadImage(imageInfo.fileId);
    console.log(`📦 Original size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Generate WebP image
    const outputFilename = 'about.webp';
    const outputPath = path.join(publicDir, outputFilename);
    const imageData = await generateWebPImage(imageBuffer, outputPath, 1200);

    // Generate blur placeholder
    const blurDataURL = await generateBlurPlaceholder(imageBuffer);

    const savings = ((1 - imageData.size / imageBuffer.length) * 100).toFixed(1);

    console.log(`✅ Saved: ${(imageData.size / 1024).toFixed(0)} KB (${savings}% smaller)`);
    console.log(`📐 Dimensions: ${imageData.width}x${imageData.height}`);

    // Save metadata JSON
    const metadata = {
      filename: outputFilename,
      path: `/about/${outputFilename}`,
      width: imageData.width,
      height: imageData.height,
      size: imageData.size,
      format: 'webp',
      blurDataURL,
      originalFilename: imageInfo.filename,
      generatedAt: new Date().toISOString(),
    };

    const metadataPath = path.join(generatedDir, 'about-image.json');
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`\n✨ Generation Complete!\n`);
    console.log(`📊 Summary:`);
    console.log(`   - Original: ${imageInfo.filename}`);
    console.log(`   - Output: ${outputPath}`);
    console.log(`   - Size saved: ${((imageBuffer.length - imageData.size) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Metadata: ${metadataPath}`);
    console.log(`\n🚀 About image will now load instantly!\n`);
  } catch (error) {
    console.error(`❌ Error processing about image:`, error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
