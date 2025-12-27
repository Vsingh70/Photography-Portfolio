/**
 * Google Drive Image Proxy API Route
 *
 * Endpoint: GET /api/google-drive/image?id={fileId}&size={thumbnail|medium|full}&format={auto|webp|jpeg}
 * Proxies Google Drive images through our authenticated service account
 * Features: format conversion (WebP/AVIF), multiple sizes, aggressive caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import sharp from 'sharp';

// Configure Sharp for optimal serverless performance
sharp.cache({ memory: 50, files: 20, items: 100 });
sharp.simd(true); // Enable SIMD optimizations
sharp.concurrency(1); // Limit concurrent operations in serverless environment

/**
 * Initialize Google Drive API client with service account credentials
 */
function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Google Drive credentials not found');
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
 * Determine optimal image format based on Accept header and requested format
 */
function getOptimalFormat(acceptHeader: string | null, requestedFormat?: string): 'webp' | 'avif' | 'jpeg' {
  // If specific format requested, use it (unless it's 'auto')
  if (requestedFormat && requestedFormat !== 'auto') {
    if (requestedFormat === 'webp' || requestedFormat === 'avif') {
      return requestedFormat;
    }
    return 'jpeg';
  }

  // Check browser support via Accept header
  if (acceptHeader) {
    if (acceptHeader.includes('image/avif')) {
      return 'avif'; // Best compression
    }
    if (acceptHeader.includes('image/webp')) {
      return 'webp'; // Good compression, wide support
    }
  }

  return 'jpeg'; // Fallback for maximum compatibility
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('id');
    const size = searchParams.get('size') || 'full'; // thumbnail | medium | full
    const requestedFormat = searchParams.get('format') || 'auto';

    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    const drive = getDriveClient();

    // Download the file content directly (skip metadata check for performance)
    // Sharp will validate if it's a valid image format
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      { responseType: 'arraybuffer' }
    );

    const imageBuffer = Buffer.from(response.data as ArrayBuffer);

    // Determine optimal format based on browser support
    const acceptHeader = request.headers.get('accept');
    const outputFormat = getOptimalFormat(acceptHeader, requestedFormat);

    // Process image with sharp for optimization and format conversion
    let processedImage = sharp(imageBuffer);

    // Resize based on requested size
    if (size === 'thumbnail') {
      // 800px width for high-DPI displays (Retina, 2x displays)
      // This ensures sharp rendering on modern devices without pixelation
      processedImage = processedImage.resize(800, null, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3', // Best quality resize algorithm
        fastShrinkOnLoad: true, // Performance optimization for JPEG/WebP
      });
    } else if (size === 'medium') {
      processedImage = processedImage.resize(1200, null, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3',
        fastShrinkOnLoad: true,
      });
    }
    // For 'full', no resize - serve maximum quality

    // Convert to optimal format
    let outputBuffer: Buffer;
    let contentType: string;

    if (outputFormat === 'avif') {
      outputBuffer = await processedImage
        .avif({
          quality: size === 'full' ? 95 : 93, // Higher quality for thumbnails (professional photography)
          effort: 4, // Balance between speed and compression
        })
        .toBuffer();
      contentType = 'image/avif';
    } else if (outputFormat === 'webp') {
      outputBuffer = await processedImage
        .webp({
          quality: size === 'full' ? 95 : 93, // Higher quality for thumbnails (professional photography)
          effort: 4,
        })
        .toBuffer();
      contentType = 'image/webp';
    } else {
      // JPEG fallback
      outputBuffer = await processedImage
        .jpeg({
          quality: size === 'full' ? 95 : 93, // Higher quality for thumbnails (professional photography)
          progressive: true,
          mozjpeg: true,
        })
        .toBuffer();
      contentType = 'image/jpeg';
    }

    // Return the optimized image with aggressive caching
    return new NextResponse(outputBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'Vary': 'Accept', // Cache separately based on Accept header
        'Content-Length': outputBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error proxying Google Drive image:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch image from Google Drive',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
