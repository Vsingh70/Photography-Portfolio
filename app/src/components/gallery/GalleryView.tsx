'use client';

import { useState } from 'react';
import { MasonryGrid } from '@/components/gallery/MasonryGrid';
import { GalleryCard } from '@/components/gallery/GalleryCard';
import { EditorialLightbox } from '@/components/gallery/EditorialLightbox';
import type { GalleryImage } from '@/types/image';

interface GalleryViewProps {
  images: GalleryImage[];
}

export function GalleryView({ images }: GalleryViewProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
      <MasonryGrid images={images}>
        {(image: GalleryImage, index: number) => (
          <GalleryCard
            key={image.id}
            image={image}
            index={index}
            onClick={() => setOpenIndex(index)}
            priority={index < 6}
          />
        )}
      </MasonryGrid>

      <EditorialLightbox
        images={images}
        index={openIndex ?? 0}
        open={openIndex !== null}
        onChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}
