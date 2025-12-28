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

// Edge runtime for faster cold starts and better global distribution
export const runtime = 'nodejs'; // Use nodejs for Sharp support
export const dynamic = 'force-dynamic'; // Always dynamic as it proxies external content

// Configure Sharp for optimal serverless performance with large files
sharp.cache({ memory: 100, files: 0, items: 50 }); // More memory cache, no file cache
sharp.simd(true); // Enable SIMD optimizations for faster processing
sharp.concurrency(1); // Limit concurrent operations in serverless environment

/**
 * Initialize Google Drive API client with service account credentials
 * Uses JWT constructor to avoid deprecation warnings
 */
function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Google Drive credentials not found');
  }

  // Use JWT constructor instead of GoogleAuth to avoid deprecation warning
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
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
  const startTime = Date.now();

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

    console.log(`[Image API] Fetching ${size} image for fileId: ${fileId}`);

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
      // 1600px for medium quality
      processedImage = processedImage.resize(1600, null, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3',
        fastShrinkOnLoad: true,
      });
    } else if (size === 'full') {
      // Full quality: resize to 2048px max for optimal balance
      // 2048px is excellent for all displays while processing faster
      // Still exceeds most 4K requirements and maintains professional quality
      processedImage = processedImage.resize(2048, 2048, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3',
        fastShrinkOnLoad: true,
      });
    }
    // No other resize - maximum quality within 2400px limit

    // Convert to optimal format
    let outputBuffer: Buffer;
    let contentType: string;

    // Quality settings optimized for size and format
    // WebP can use 100% quality with smaller file sizes than JPEG at 95%
    let quality: number;
    let effort: number;

    if (size === 'full') {
      // For full size: WebP at 98% delivers near-lossless quality, faster than JPEG
      // WebP's superior compression means 98% looks better than JPEG 95%
      quality = outputFormat === 'webp' ? 98 : 95;
      effort = outputFormat === 'webp' ? 3 : 4; // WebP is faster, can use lower effort
    } else if (size === 'thumbnail') {
      quality = 90;
      effort = 3;
    } else {
      quality = 93;
      effort = 3;
    }

    if (outputFormat === 'avif') {
      outputBuffer = await processedImage
        .avif({
          quality,
          effort,
        })
        .toBuffer();
      contentType = 'image/avif';
    } else if (outputFormat === 'webp') {
      outputBuffer = await processedImage
        .webp({
          quality,
          effort,
          // nearLossless: size === 'full', // Near-lossless preprocessing for maximum quality
        })
        .toBuffer();
      contentType = 'image/webp';
    } else {
      // JPEG fallback
      outputBuffer = await processedImage
        .jpeg({
          quality,
          progressive: true,
          mozjpeg: true,
        })
        .toBuffer();
      contentType = 'image/jpeg';
    }

    const processingTime = Date.now() - startTime;
    const fileSizeKB = (outputBuffer.length / 1024).toFixed(2);
    console.log(`[Image API] ✅ ${size} image (${contentType}, q:${quality}) → ${fileSizeKB} KB in ${processingTime}ms`);

    // Return the optimized image with aggressive caching
    return new NextResponse(outputBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'Vary': 'Accept', // Cache separately based on Accept header
        'Content-Length': outputBuffer.length.toString(),
        'X-Processing-Time': `${processingTime}ms`,
      },
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`[Image API] Error after ${errorTime}ms:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch image from Google Drive',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime: `${errorTime}ms`,
      },
      { status: 500 }
    );
  }
}
