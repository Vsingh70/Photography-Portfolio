'use client';

import { useCallback, useState } from 'react';
import { ProjectSequence } from '@/components/gallery/ProjectSequence';
import { EditorialLightbox } from '@/components/gallery/EditorialLightbox';
import { GalleryOpenHint } from '@/components/gallery/GalleryOpenHint';
import type { GalleryImage } from '@/types/image';

interface GalleryViewProps {
  images: GalleryImage[];
  seriesLabel?: string;
}

export function GalleryView({ images, seriesLabel }: GalleryViewProps) {
  // `index` + `open` are kept separate (not `index | null`) so the viewed
  // frame stays put while the lightbox plays its exit animation.
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const openAt = useCallback((i: number) => {
    setIndex(i);
    setOpen(true);
  }, []);

  if (images.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="font-display text-lg italic text-ink-soft">
          No images found in this gallery.
        </p>
        <p className="meta mt-2 text-[10px]">Check back soon for new additions.</p>
      </div>
    );
  }

  return (
    <>
      <ProjectSequence
        images={images}
        seriesLabel={seriesLabel}
        onOpen={openAt}
      />

      <EditorialLightbox
        images={images}
        index={index}
        open={open}
        onChange={setIndex}
        onClose={() => setOpen(false)}
      />

      {/* First-ever project visit: one-time "open an image" hint. */}
      <GalleryOpenHint dismissed={open} />
    </>
  );
}
