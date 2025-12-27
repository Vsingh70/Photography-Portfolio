/**
 * Helper Script: Extract Google Drive File IDs for Gallery Covers
 *
 * This script fetches the cover images from Google Drive and prints their file IDs
 * so you can add them to gallery-covers.ts for instant loading.
 *
 * Run with: npm run dev (then visit /gallery to see the file IDs in server logs)
 * OR run this script directly: npx tsx scripts/get-cover-file-ids.ts
 *
 * Note: Make sure your .env.local has GOOGLE_DRIVE_* credentials set
 */

import { fetchImagesFromDrive } from '../src/lib/google-drive';
import { GALLERY_COVER_MAPPINGS } from '../src/config/gallery-covers';

async function getCoverFileIds() {
  try {
    const galleryFolderId = process.env.GOOGLE_DRIVE_GALLERY_FOLDER_ID;

    if (!galleryFolderId) {
      console.error('❌ Error: GOOGLE_DRIVE_GALLERY_FOLDER_ID not set in .env.local');
      process.exit(1);
    }

    console.log('🔍 Fetching images from Google Drive...');
    const allImages = await fetchImagesFromDrive(galleryFolderId, 'Gallery');

    console.log(`\n✅ Found ${allImages.length} total images\n`);
    console.log('📋 Copy and paste these file IDs into gallery-covers.ts:\n');
    console.log('export const GALLERY_COVER_MAPPINGS: GalleryCoverMapping[] = [');

    let foundCount = 0;

    for (const mapping of GALLERY_COVER_MAPPINGS) {
      const image = allImages.find((img) => {
        const imgFilename = img.title + '.jpg';
        return imgFilename.toLowerCase() === mapping.filename.toLowerCase();
      });

      if (image) {
        foundCount++;
        console.log(`  {`);
        console.log(`    filename: '${mapping.filename}',`);
        console.log(`    categorySlug: '${mapping.categorySlug}',`);
        console.log(`    displayTitle: '${mapping.displayTitle}',`);
        console.log(`    displayOrder: ${mapping.displayOrder},`);
        console.log(`    fileId: '${image.id}', // ⬅️ ADD THIS`);
        console.log(`    width: ${image.width || 1920},`);
        console.log(`    height: ${image.height || 1280},`);
        console.log(`  },`);
      } else {
        console.log(`  // ⚠️ NOT FOUND: ${mapping.filename}`);
      }
    }

    console.log('];\n');

    if (foundCount === GALLERY_COVER_MAPPINGS.length) {
      console.log(`✅ Found all ${foundCount} cover images!`);
    } else {
      console.log(`⚠️ Warning: Only found ${foundCount}/${GALLERY_COVER_MAPPINGS.length} cover images`);
    }

    console.log('\n📝 Next steps:');
    console.log('1. Copy the configuration above');
    console.log('2. Replace GALLERY_COVER_MAPPINGS in src/config/gallery-covers.ts');
    console.log('3. Deploy - gallery page will load instantly! ⚡\n');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

getCoverFileIds();
