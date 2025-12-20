/**
 * Google Drive API Route
 *
 * Endpoint: GET /api/google-drive?category=portraits
 * Returns images from the specified gallery category's Google Drive folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchImagesFromDrive } from '@/lib/google-drive';
import { getGalleryBySlug, getFolderIdForGallery } from '@/config/galleries';

export const dynamic = 'force-dynamic'; // Route uses search params, must be dynamic
export const revalidate = 3600; // Revalidate every 1 hour (ISR)

/**
 * GET handler - Fetch images from Google Drive folder
 */
export async function GET(request: NextRequest) {
  try {
    // Get category from query parameters
    const searchParams = request.nextUrl.searchParams;
    const categorySlug = searchParams.get('category');

    if (!categorySlug) {
      return NextResponse.json(
        { error: 'Missing required parameter: category' },
        { status: 400 }
      );
    }

    // Find gallery configuration
    const gallery = getGalleryBySlug(categorySlug);

    if (!gallery) {
      return NextResponse.json(
        { error: `Invalid category: ${categorySlug}` },
        { status: 404 }
      );
    }

    // Get folder ID from environment variables
    const folderId = getFolderIdForGallery(gallery);

    if (!folderId) {
      return NextResponse.json(
        {
          error: `Folder ID not configured for category: ${categorySlug}`,
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
    console.error('Error in Google Drive API route:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch images from Google Drive',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
