/**
 * GalleryView Client Component
 *
 * Handles the interactive parts of the gallery (Lightbox + MasonryGrid)
 * Separated from the page component to allow Server Component rendering
 *
 * Note: react-masonry-css distributes items round-robin across columns,
 * so the visual order (left-to-right, top-to-bottom) matches the array order.
 * The lightbox navigation uses the same order as the masonry grid.
 */

'use client';

import { useMemo, useState } from 'react';
import { PhotoSlider } from 'react-photo-view';
import { MasonryGrid } from '@/components/gallery/MasonryGrid';
import { GalleryCard } from '@/components/gallery/GalleryCard';
import { LightboxStyles } from '@/components/gallery/Lightbox';
import type { GalleryImage } from '@/types/image';
import 'react-photo-view/dist/react-photo-view.css';

interface GalleryViewProps {
  images: GalleryImage[];
}

/**
 * Loading spinner for lightbox
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
    </div>
  );
}

export function GalleryView({ images }: GalleryViewProps) {
  const [visible, setVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Convert to PhotoSlider format - order matches masonry grid (round-robin distribution)
  const sliderImages = useMemo(
    () => images.map((img) => ({ src: img.src, key: img.id })),
    [images]
  );

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

  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setVisible(true);
  };

  return (
    <>
      {/* Masonry grid */}
      <MasonryGrid images={images}>
        {(image: GalleryImage, index: number) => (
          <div
            key={image.id}
            onClick={() => handleImageClick(index)}
            style={{ cursor: 'pointer' }}
          >
            <GalleryCard
              image={image}
              priority={index < 6}
              onClick={() => {}}
            />
          </div>
        )}
      </MasonryGrid>

      {/* Controlled PhotoSlider for lightbox with visual order navigation */}
      <PhotoSlider
        images={sliderImages}
        visible={visible}
        onClose={() => setVisible(false)}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        speed={() => 300}
        easing={(type) =>
          type === 2
            ? 'cubic-bezier(0.36, 0, 0.66, -0.56)'
            : 'cubic-bezier(0.34, 1.56, 0.64, 1)'
        }
        maskOpacity={0.95}
        loadingElement={<LoadingSpinner />}
      />

      <LightboxStyles />
    </>
  );
}
