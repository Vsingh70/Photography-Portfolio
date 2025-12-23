import { GalleryImage } from './image';

/**
 * Gallery category types
 */
export type GalleryCategory = 'portraits' | 'landscapes' | 'events' | 'commercial' | 'featured';

/**
 * Gallery data structure
 */
export interface Gallery {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImage: string;
  category: GalleryCategory;
  images: GalleryImage[];
  imageCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Gallery configuration for Google Drive folders
 */
export interface GalleryConfig {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: GalleryCategory;
  driveFolderId: string;
  coverImageId?: string;
  enabled: boolean;
  order: number;
}

/**
 * Gallery filter options
 */
export interface GalleryFilter {
  category?: GalleryCategory;
  search?: string;
  sortBy?: 'date' | 'title' | 'popular';
  order?: 'asc' | 'desc';
}

/**
 * Gallery cover image for main gallery page
 */
export interface GalleryCover {
  id: string;
  category: string;
  slug: string;
  title: string;
  imageUrl: string;
  width: number;
  height: number;
}

/**
 * API response for gallery covers endpoint
 */
export interface GalleryCoversResponse {
  success: boolean;
  count: number;
  covers: GalleryCover[];
}
