/**
 * Revalidation API Route
 *
 * Endpoint: POST /api/revalidate
 * Triggers on-demand revalidation of gallery pages when new images are added to Google Drive
 *
 * Usage:
 * curl -X POST https://yoursite.com/api/revalidate \
 *   -H "Content-Type: application/json" \
 *   -H "x-revalidate-secret: your-secret-key" \
 *   -d '{"paths": ["/gallery/portraits", "/gallery"]}'
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAllGallerySlugs } from '@/config/galleries';

/**
 * POST handler - Revalidate specified paths
 */
export async function POST(request: NextRequest) {
  try {
    // Verify secret key
    const secret = request.headers.get('x-revalidate-secret');
    const expectedSecret = process.env.REVALIDATE_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'Revalidation is not configured. Please set REVALIDATE_SECRET in environment variables.' },
        { status: 500 }
      );
    }

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Invalid revalidation secret' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { paths, category } = body;

    const revalidatedPaths: string[] = [];

    // Option 1: Revalidate specific paths
    if (paths && Array.isArray(paths)) {
      for (const path of paths) {
        revalidatePath(path);
        revalidatedPaths.push(path);
      }
    }
    // Option 2: Revalidate specific category
    else if (category) {
      const categoryPath = `/gallery/${category}`;
      revalidatePath(categoryPath);
      revalidatedPaths.push(categoryPath);
    }
    // Option 3: Revalidate all galleries
    else {
      // Revalidate gallery overview page
      revalidatePath('/gallery');
      revalidatedPaths.push('/gallery');

      // Revalidate all category pages
      const slugs = getAllGallerySlugs();
      for (const slug of slugs) {
        const path = `/gallery/${slug}`;
        revalidatePath(path);
        revalidatedPaths.push(path);
      }

      // Revalidate home page (featured images)
      revalidatePath('/');
      revalidatedPaths.push('/');
    }

    return NextResponse.json(
      {
        success: true,
        revalidated: revalidatedPaths,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in revalidation API route:', error);

    return NextResponse.json(
      {
        error: 'Failed to revalidate paths',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - Return revalidation endpoint information
 */
export async function GET() {
  return NextResponse.json(
    {
      endpoint: '/api/revalidate',
      method: 'POST',
      authentication: 'Required: x-revalidate-secret header',
      body: {
        paths: 'Optional: Array of paths to revalidate (e.g., ["/gallery/portraits"])',
        category: 'Optional: Category slug to revalidate (e.g., "portraits")',
        note: 'If neither paths nor category is provided, all galleries will be revalidated',
      },
      examples: [
        {
          description: 'Revalidate specific paths',
          curl: 'curl -X POST /api/revalidate -H "x-revalidate-secret: YOUR_SECRET" -d \'{"paths": ["/gallery/portraits"]}\'',
        },
        {
          description: 'Revalidate specific category',
          curl: 'curl -X POST /api/revalidate -H "x-revalidate-secret: YOUR_SECRET" -d \'{"category": "portraits"}\'',
        },
        {
          description: 'Revalidate all galleries',
          curl: 'curl -X POST /api/revalidate -H "x-revalidate-secret: YOUR_SECRET" -d \'{}\'',
        },
      ],
    },
    { status: 200 }
  );
}
