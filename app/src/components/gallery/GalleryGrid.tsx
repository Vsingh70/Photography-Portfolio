/**
 * GalleryGrid — refined editorial layout.
 *
 * First row: 3 covers. Second row: 2 covers, offset 8% inward on desktop
 * for a more asymmetric, magazine-spread feel.
 */

'use client';

import type { GalleryCover } from '@/types/gallery';
import { GalleryCoverCard } from './GalleryCoverCard';

interface GalleryGridProps {
  covers: GalleryCover[];
}

export function GalleryGrid({ covers }: GalleryGridProps) {
  const firstRow = covers.slice(0, 3);
  const secondRow = covers.slice(3, 5);

  return (
    <div className="pt-24 pb-12 md:pt-28 md:pb-16">
      <div className="mb-7 grid grid-cols-1 gap-7 md:grid-cols-3 md:gap-7">
        {firstRow.map((cover, index) => (
          <GalleryCoverCard key={cover.id} cover={cover} index={index} />
        ))}
      </div>

      {secondRow.length > 0 && (
        <div className="grid grid-cols-1 gap-7 md:grid-cols-2 md:gap-7 md:mx-[8%]">
          {secondRow.map((cover, index) => (
            <GalleryCoverCard key={cover.id} cover={cover} index={index + 3} />
          ))}
        </div>
      )}
    </div>
  );
}
