/**
 * Gallery Categories Configuration
 *
 * Defines all gallery categories, their metadata, and Google Drive folder mappings.
 * Update this file to add/remove gallery categories.
 */

export interface GalleryCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  folderIdEnvVar: string; // Environment variable name for folder ID
  order: number; // Display order
}

/**
 * All gallery categories available in the portfolio
 */
export const GALLERY_CATEGORIES: GalleryCategory[] = [
  {
    id: 'editorial',
    name: 'Editorial',
    slug: 'editorial',
    description: 'Editorial photography showcasing creative storytelling',
    folderIdEnvVar: 'GOOGLE_DRIVE_EDITORIAL_FOLDER_ID',
    order: 1,
  },
  {
    id: 'graduation',
    name: 'Graduation',
    slug: 'graduation',
    description: 'Graduation photography celebrating achievements',
    folderIdEnvVar: 'GOOGLE_DRIVE_GRADUATION_FOLDER_ID',
    order: 2,
  },
  {
    id: 'portraits',
    name: 'Portraits',
    slug: 'portraits',
    description: 'Portrait photography capturing personality and emotion',
    folderIdEnvVar: 'GOOGLE_DRIVE_PORTRAITS_FOLDER_ID',
    order: 3,
  },
  {
    id: 'engagement',
    name: 'Engagement',
    slug: 'engagement',
    description: 'Engagement photography capturing love and connection',
    folderIdEnvVar: 'GOOGLE_DRIVE_ENGAGEMENT_FOLDER_ID',
    order: 4,
  },
  {
    id: 'events',
    name: 'Events',
    slug: 'events',
    description: 'Event photography capturing memorable moments',
    folderIdEnvVar: 'GOOGLE_DRIVE_EVENTS_FOLDER_ID',
    order: 5,
  },
  {
    id: 'dance',
    name: 'Dance',
    slug: 'dance',
    description: 'Dynamic dance photography capturing movement and grace',
    folderIdEnvVar: 'GOOGLE_DRIVE_DANCE_FOLDER_ID',
    order: 6,
  },
  {
    id: 'wedding',
    name: 'Wedding',
    slug: 'wedding',
    description: 'Wedding photography documenting your special day',
    folderIdEnvVar: 'GOOGLE_DRIVE_WEDDING_FOLDER_ID',
    order: 7,
  },
];

/**
 * Get gallery category by slug
 */
export function getGalleryBySlug(slug: string): GalleryCategory | undefined {
  return GALLERY_CATEGORIES.find((gallery) => gallery.slug === slug);
}

/**
 * Get gallery category by ID
 */
export function getGalleryById(id: string): GalleryCategory | undefined {
  return GALLERY_CATEGORIES.find((gallery) => gallery.id === id);
}

/**
 * Get all gallery slugs (useful for static path generation)
 */
export function getAllGallerySlugs(): string[] {
  return GALLERY_CATEGORIES.map((gallery) => gallery.slug);
}

/**
 * Get folder ID from environment variables
 */
export function getFolderIdForGallery(category: GalleryCategory): string | undefined {
  return process.env[category.folderIdEnvVar];
}
