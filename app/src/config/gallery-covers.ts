/**
 * Gallery Cover Mappings Configuration
 *
 * Maps cover image filenames from Google Drive to their corresponding gallery categories
 */

export interface GalleryCoverMapping {
  filename: string;
  categorySlug: string;
  displayTitle: string;
  displayOrder: number;
  fileId?: string; // Optional: Google Drive file ID for direct access
  width?: number;
  height?: number;
}

/**
 * Mapping of cover images to gallery categories
 * These images are stored in GOOGLE_DRIVE_GALLERY_FOLDER_ID
 *
 * OPTIMIZATION: Add fileId to each mapping to enable direct image access
 * without fetching the entire folder. To get file IDs:
 * 1. Run the site once to fetch all images
 * 2. Check server logs for file IDs
 * 3. Update this config with the IDs
 */
export const GALLERY_COVER_MAPPINGS: GalleryCoverMapping[] = [
  {
    filename: 'editorial_cover.jpg',
    categorySlug: 'editorial',
    displayTitle: 'Editorial',
    displayOrder: 1,
    fileId: '1zPR5I5kLAv-MIq6ZcMYf2WndBHXA6iPy', // Add this for instant loading
    width: 1920,
    height: 1280,
  },
  {
    filename: 'grad_cover.jpg',
    categorySlug: 'graduation',
    displayTitle: 'Graduation',
    displayOrder: 2,
    fileId: '15AyXLwX-ktsogZ3ZdAFSEJtYIC5eb5fd',
    width: 1920,
    height: 1280,
  },
  {
    filename: 'portrait_cover.jpg',
    categorySlug: 'portraits',
    displayTitle: 'Portrait',
    displayOrder: 3,
    fileId: '1QGtxSiB8M5FfUxZluLVlFew5LNFX-GlU',
    width: 1920,
    height: 1280,
  },
  {
    filename: 'engagement_cover.jpg',
    categorySlug: 'engagement',
    displayTitle: 'Engagement',
    displayOrder: 4,
    fileId: '1OmFSoqc_lJQT2GoI-PWn6dFrCcVudgSC',
    width: 1920,
    height: 1280,
  },
  {
    filename: 'event_cover.jpg',
    categorySlug: 'events',
    displayTitle: 'Event',
    displayOrder: 5,
    fileId: '1wQzZkiXk1z71LUCvBLZDiVd2dWJoYjd8',
    width: 1920,
    height: 1280,
  },
];

/**
 * Get cover image mapping by filename
 */
export function getCoverImageMapping(filename: string): GalleryCoverMapping | undefined {
  const normalizedFilename = filename.toLowerCase();
  return GALLERY_COVER_MAPPINGS.find(
    (m) => m.filename.toLowerCase() === normalizedFilename
  );
}

/**
 * Get all cover mappings sorted by display order
 */
export function getOrderedCoverMappings(): GalleryCoverMapping[] {
  return [...GALLERY_COVER_MAPPINGS].sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Get cover mapping by category slug
 */
export function getCoverMappingBySlug(slug: string): GalleryCoverMapping | undefined {
  return GALLERY_COVER_MAPPINGS.find((m) => m.categorySlug === slug);
}
