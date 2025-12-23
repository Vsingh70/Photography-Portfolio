/**
 * Gallery Covers API Route
 *
 * Endpoint: GET /api/gallery-covers
 * Returns the 5 cover images from the main gallery folder for the gallery landing page
 */

import { NextResponse } from 'next/server';
import { fetchImagesFromDrive } from '@/lib/google-drive';
import { GALLERY_COVER_MAPPINGS, getCoverImageMapping } from '@/config/gallery-covers';
import type { GalleryCover } from '@/types/gallery';

export const revalidate = 3600; // Revalidate every 1 hour (ISR)

/**
 * GET handler - Fetch cover images from Google Drive gallery folder
 */
export async function GET() {
  try {
    // Get gallery folder ID from environment
    const galleryFolderId = process.env.GOOGLE_DRIVE_GALLERY_FOLDER_ID;

    if (!galleryFolderId) {
      return NextResponse.json(
        {
          error: 'Gallery folder ID not configured',
          hint: 'Please set GOOGLE_DRIVE_GALLERY_FOLDER_ID in your environment variables',
        },
        { status: 500 }
      );
    }

    // Fetch all images from the gallery folder
    const allImages = await fetchImagesFromDrive(galleryFolderId, 'Gallery');

    // Filter to only include cover images and map them to gallery categories
    const covers: GalleryCover[] = [];

    for (const image of allImages) {
      // Check if this image filename matches any of our cover mappings
      const mapping = getCoverImageMapping(image.title + '.jpg');

      if (mapping) {
        covers.push({
          id: image.id,
          category: mapping.displayTitle,
          slug: mapping.categorySlug,
          title: mapping.displayTitle,
          imageUrl: image.src, // Full-size URL from proxy
          width: image.width || 1920,
          height: image.height || 1080,
        });
      }
    }

    // Sort covers by display order
    const sortedCovers = covers.sort((a, b) => {
      const orderA =
        GALLERY_COVER_MAPPINGS.find((m) => m.categorySlug === a.slug)?.displayOrder || 999;
      const orderB =
        GALLERY_COVER_MAPPINGS.find((m) => m.categorySlug === b.slug)?.displayOrder || 999;
      return orderA - orderB;
    });

    // Return covers with cache headers
    return NextResponse.json(
      {
        success: true,
        count: sortedCovers.length,
        covers: sortedCovers,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  } catch (error) {
    console.error('Error in gallery covers API route:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch gallery covers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
