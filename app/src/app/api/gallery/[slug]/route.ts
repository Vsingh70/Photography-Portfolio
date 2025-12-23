/**
 * Gallery API Route
 *
 * Endpoint: GET /api/gallery/[slug]
 * Returns all images for a specific gallery category
 */

import { NextResponse } from 'next/server';
import { fetchImagesFromDrive } from '@/lib/google-drive';
import { getGalleryBySlug, getFolderIdForGallery } from '@/config/galleries';

export const revalidate = 3600; // Revalidate every 1 hour (ISR)

/**
 * GET handler - Fetch images for a specific gallery category
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const gallery = getGalleryBySlug(slug);

    if (!gallery) {
      return NextResponse.json(
        {
          error: 'Gallery not found',
          hint: `Invalid gallery slug: ${slug}`,
        },
        { status: 404 }
      );
    }

    // Get folder ID from environment variables
    const folderId = getFolderIdForGallery(gallery);

    if (!folderId) {
      return NextResponse.json(
        {
          error: 'Folder ID not configured',
          hint: `Please set ${gallery.folderIdEnvVar} in your environment variables`,
        },
        { status: 500 }
      );
    }

    // Fetch images from Google Drive
    const images = await fetchImagesFromDrive(folderId, gallery.name);

    // Return images with cache headers
    return NextResponse.json(
      {
        success: true,
        category: gallery.name,
        slug: gallery.slug,
        count: images.length,
        images,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  } catch (error) {
    console.error('Error in gallery API route:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch gallery images',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
