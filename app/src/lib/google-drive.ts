/**
 * Google Drive API Integration
 *
 * Handles authentication and image fetching from Google Drive folders.
 * Uses Service Account authentication for server-side access.
 */

import { google } from 'googleapis';
import type { GalleryImage } from '@/types/image';

/**
 * Initialize Google Drive API client with service account credentials
 */
function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Drive credentials not found. Please set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY environment variables.'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Supported image MIME types
 */
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

/**
 * Fetch images from a Google Drive folder
 *
 * @param folderId - Google Drive folder ID
 * @param category - Gallery category name for metadata
 * @returns Array of gallery images with metadata
 */
export async function fetchImagesFromDrive(
  folderId: string,
  category: string
): Promise<GalleryImage[]> {
  try {
    const drive = getDriveClient();

    // Query files in the specified folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (${SUPPORTED_IMAGE_TYPES.map((type) => `mimeType='${type}'`).join(' or ')})`,
      fields:
        'files(id, name, mimeType, size, createdTime, modifiedTime, imageMediaMetadata, thumbnailLink, webContentLink, webViewLink)',
      orderBy: 'name', // Order by filename (can be changed to 'createdTime desc' for newest first)
      pageSize: 1000, // Max results per request
    });

    const files = response.data.files || [];

    // Transform Drive files to GalleryImage format
    const images: GalleryImage[] = files.map((file, index) => {
      const imageMetadata = file.imageMediaMetadata;

      // Generate multi-resolution thumbnail URLs
      // All URLs go through our API for consistent quality and format optimization

      // Small blur placeholder for instant loading (32px)
      const blurUrl = file.thumbnailLink
        ? file.thumbnailLink.replace('=s220', '=s32')
        : `https://drive.google.com/thumbnail?id=${file.id}&sz=w32`;

      // Medium thumbnail for grid display - use API route for quality control
      // This processes images with Sharp at high quality (90-95%)
      const thumbnailUrl = `/api/google-drive/image?id=${file.id}&size=thumbnail`;

      // Full-size URL for lightbox - maximum quality through API
      const fullSizeUrl = `/api/google-drive/image?id=${file.id}&size=full`;

      // Extract filename without extension for title
      const title = file.name?.replace(/\.[^/.]+$/, '') || `Image ${index + 1}`;

      return {
        id: file.id || `image-${index}`,
        src: fullSizeUrl,
        thumbnail: thumbnailUrl,
        blurDataURL: blurUrl,
        alt: title,
        title: title,
        description: '', // Can be populated from file description if needed
        category: category,
        width: imageMetadata?.width || 1920,
        height: imageMetadata?.height || 1080,
        metadata: {
          camera: imageMetadata?.cameraMake && imageMetadata?.cameraModel
            ? `${imageMetadata.cameraMake} ${imageMetadata.cameraModel}`
            : undefined,
          lens: imageMetadata?.lens || undefined,
          settings: formatCameraSettings(imageMetadata),
          date: file.createdTime || undefined,
          location: imageMetadata?.location
            ? `${imageMetadata.location.latitude}, ${imageMetadata.location.longitude}`
            : undefined,
          fileSize: file.size ? formatFileSize(parseInt(file.size)) : undefined,
        },
      };
    });

    return images;
  } catch (error) {
    console.error(`Error fetching images from Google Drive folder ${folderId}:`, error);

    // More specific error messages
    if (error instanceof Error) {
      if (error.message.includes('credentials')) {
        throw new Error('Invalid Google Drive credentials. Please check your service account configuration.');
      }
      if (error.message.includes('404')) {
        throw new Error(`Folder not found: ${folderId}. Please check the folder ID and sharing permissions.`);
      }
      if (error.message.includes('403')) {
        throw new Error(
          `Access denied to folder ${folderId}. Ensure the service account has been granted access to this folder.`
        );
      }
    }

    throw new Error(`Failed to fetch images from Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Camera metadata interface
 */
interface CameraMetadata {
  focalLength?: number;
  aperture?: number;
  exposureTime?: string | number;
  isoSpeed?: number;
}

/**
 * Format camera settings into a readable string
 */
function formatCameraSettings(metadata?: CameraMetadata | null): string | undefined {
  if (!metadata) return undefined;

  const parts: string[] = [];

  if (metadata.focalLength) {
    parts.push(`${metadata.focalLength}mm`);
  }

  if (metadata.aperture) {
    parts.push(`f/${metadata.aperture}`);
  }

  if (metadata.exposureTime) {
    const formattedExposure = typeof metadata.exposureTime === 'string'
      ? metadata.exposureTime
      : formatExposureTime(metadata.exposureTime);
    parts.push(formattedExposure);
  }

  if (metadata.isoSpeed) {
    parts.push(`ISO ${metadata.isoSpeed}`);
  }

  return parts.length > 0 ? parts.join(' • ') : undefined;
}

/**
 * Format exposure time (converts decimal to fraction)
 */
function formatExposureTime(exposureTime: number): string {
  if (exposureTime >= 1) {
    return `${exposureTime}s`;
  }

  // Convert to fraction (e.g., 0.008 -> 1/125)
  const denominator = Math.round(1 / exposureTime);
  return `1/${denominator}s`;
}

/**
 * Format file size to human-readable format
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Verify Google Drive API connection and credentials
 *
 * @returns True if connection is successful
 */
export async function verifyDriveConnection(): Promise<boolean> {
  try {
    const drive = getDriveClient();
    await drive.about.get({ fields: 'user' });
    return true;
  } catch (error) {
    console.error('Failed to verify Google Drive connection:', error);
    return false;
  }
}

/**
 * Get folder metadata (name, description, etc.)
 */
export async function getFolderMetadata(folderId: string) {
  try {
    const drive = getDriveClient();
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, description, createdTime, modifiedTime',
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching folder metadata for ${folderId}:`, error);
    throw error;
  }
}
