/**
 * Image metadata and properties
 */
export interface ImageMetadata {
  camera?: string;
  lens?: string;
  settings?: string;
  fStop?: string;
  shutterSpeed?: string;
  iso?: number;
  focalLength?: string;
  date?: string;
  location?: string;
}

/**
 * Gallery image data structure
 */
export interface GalleryImage {
  id: string;
  src: string;
  thumbnail?: string;
  alt: string;
  title: string;
  description?: string;
  category: string;
  width?: number;
  height?: number;
  blurDataURL?: string;
  metadata?: ImageMetadata;
}

/**
 * Google Drive file response
 */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webContentLink?: string;
  thumbnailLink?: string;
  imageMediaMetadata?: {
    width: number;
    height: number;
    rotation?: number;
    cameraMake?: string;
    cameraModel?: string;
    exposureTime?: number;
    aperture?: number;
    focalLength?: number;
    isoSpeed?: number;
  };
  createdTime?: string;
  modifiedTime?: string;
}
