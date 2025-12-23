/**
 * GalleryView Client Component
 *
 * Handles the interactive parts of the gallery (Lightbox + MasonryGrid)
 * Separated from the page component to allow Server Component rendering
 */

'use client';

import { MasonryGrid } from '@/components/gallery/MasonryGrid';
import { GalleryCard } from '@/components/gallery/GalleryCard';
import { Lightbox, LightboxImage, LightboxStyles } from '@/components/gallery/Lightbox';
import type { GalleryImage } from '@/types/image';

interface GalleryViewProps {
  images: GalleryImage[];
}

export function GalleryView({ images }: GalleryViewProps) {
  if (images.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-lg text-primary-700 dark:text-primary-300">
          No images found in this gallery.
        </p>
        <p className="mt-2 text-sm text-primary-500 dark:text-primary-500">
          Check back soon for new additions.
        </p>
      </div>
    );
  }

  return (
    <>
      <Lightbox images={images}>
        <MasonryGrid images={images}>
          {(image: GalleryImage, index: number) => (
            <LightboxImage key={image.id} src={image.src}>
              <div>
                <GalleryCard
                  image={image}
                  priority={index < 6}
                  onClick={() => {}}
                />
              </div>
            </LightboxImage>
          )}
        </MasonryGrid>
      </Lightbox>
      <LightboxStyles />
    </>
  );
}
