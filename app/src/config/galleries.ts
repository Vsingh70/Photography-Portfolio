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
    id: 'featured',
    name: 'Featured Work',
    slug: 'featured',
    description: 'A curated selection of my best photography showcasing diverse styles and subjects',
    folderIdEnvVar: 'GOOGLE_DRIVE_FEATURED_FOLDER_ID',
    order: 1,
  },
  {
    id: 'portraits',
    name: 'Portraits',
    slug: 'portraits',
    description: 'Capturing the essence and personality of individuals through intimate portraiture',
    folderIdEnvVar: 'GOOGLE_DRIVE_PORTRAITS_FOLDER_ID',
    order: 2,
  },
  {
    id: 'landscapes',
    name: 'Landscapes',
    slug: 'landscapes',
    description: 'Breathtaking natural vistas and scenic landscapes from around the world',
    folderIdEnvVar: 'GOOGLE_DRIVE_LANDSCAPES_FOLDER_ID',
    order: 3,
  },
  {
    id: 'events',
    name: 'Events',
    slug: 'events',
    description: 'Dynamic event photography capturing memorable moments and celebrations',
    folderIdEnvVar: 'GOOGLE_DRIVE_EVENTS_FOLDER_ID',
    order: 4,
  },
  {
    id: 'commercial',
    name: 'Commercial',
    slug: 'commercial',
    description: 'Professional commercial photography for brands, products, and businesses',
    folderIdEnvVar: 'GOOGLE_DRIVE_COMMERCIAL_FOLDER_ID',
    order: 5,
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
