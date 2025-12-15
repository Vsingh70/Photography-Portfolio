/**
 * Google Drive Image Proxy API Route
 *
 * Endpoint: GET /api/google-drive/image?id={fileId}&size={thumbnail|full}
 * Proxies Google Drive images through our authenticated service account
 * to avoid rate limits and CORS issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('id');
    const size = searchParams.get('size') || 'full';

    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    const drive = getDriveClient();

    // Get file metadata to determine if it's an image
    const fileMetadata = await drive.files.get({
      fileId,
      fields: 'mimeType, name',
    });

    if (!fileMetadata.data.mimeType?.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File is not an image' },
        { status: 400 }
      );
    }

    // Download the file content
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      { responseType: 'arraybuffer' }
    );

    // Return the image with appropriate headers
    return new NextResponse(response.data as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': fileMetadata.data.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
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
