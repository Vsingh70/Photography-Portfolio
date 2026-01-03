/**
 * Gallery Grid Component
 *
 * Responsive grid layout for gallery cover images
 * Desktop: 3 columns (first row) + 2 columns (second row)
 * Mobile: 1 column
 */

'use client';

import type { GalleryCover } from '@/types/gallery';
import { GalleryCoverCard } from './GalleryCoverCard';

interface GalleryGridProps {
  covers: GalleryCover[];
}

export function GalleryGrid({ covers }: GalleryGridProps) {
  // Split covers into two rows: first 3, then remaining 2
  const firstRow = covers.slice(0, 3);
  const secondRow = covers.slice(3, 5);

  return (
    <div className="pt-16 pb-8 md:pt-24 md:pb-12">
      {/* First Row - 3 columns on desktop, 2 on tablet, 1 on mobile */}
      <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {firstRow.map((cover, index) => (
          <GalleryCoverCard key={cover.id} cover={cover} index={index} />
        ))}
      </div>

      {/* Second Row - 2 columns on desktop and tablet, 1 on mobile */}
      {secondRow.length > 0 && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {secondRow.map((cover, index) => (
            <GalleryCoverCard key={cover.id} cover={cover} index={index + 3} />
          ))}
        </div>
      )}
    </div>
  );
}
