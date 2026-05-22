/**
 * GalleryCard — editorial masonry plate.
 *
 * At rest: pure photo + tiny mono "Nº NN" stamp in the bottom-left corner.
 * On hover: dark gradient strip slides up from the bottom, italic title
 * fades in on the right. The corner Nº stays put and reads as the strip's
 * left element when revealed — one unified caption row in both states.
 *
 * Aspect-ratio reserves space before load: zero CLS.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { GalleryImage, ImageVariants } from '@/types/image';

interface GalleryCardProps {
  image: GalleryImage;
  index: number;
  onClick?: () => void;
  priority?: boolean;
}

// Browser picks the right width for the rendered slot.
// Masonry: ~50vw on mobile (2 cols), ~33vw on tablet+ (3 cols).
const CARD_SIZES = '(min-width: 768px) 33vw, 50vw';

function srcset(v: ImageVariants | undefined): string | undefined {
  if (!v) return undefined;
  return `${v.sm} 320w, ${v.md} 640w, ${v.lg} 1280w, ${v.xl} 2400w`;
}

export function GalleryCard({
  image,
  index,
  onClick,
  priority = false,
}: GalleryCardProps) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  const aspectRatio =
    image.width && image.height ? `${image.width} / ${image.height}` : '4 / 5';

  return (
    <figure
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className="group relative m-0 mb-4 cursor-pointer overflow-hidden break-inside-avoid"
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: '0 600px',
      }}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio,
          backgroundImage: image.blurDataURL
            ? `url("${image.blurDataURL}")`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <picture>
          {image.avif && (
            <source type="image/avif" srcSet={srcset(image.avif)} sizes={CARD_SIZES} />
          )}
          {image.webp && (
            <source type="image/webp" srcSet={srcset(image.webp)} sizes={CARD_SIZES} />
          )}
          <img
            ref={ref}
            src={image.webp?.md || image.thumbnail || image.src}
            alt={image.alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full object-cover transition-[opacity,filter] duration-500 ease-out"
            style={{
              opacity: loaded ? 1 : 0,
              filter: loaded ? 'blur(0)' : 'blur(18px)',
              transform: loaded ? 'none' : 'scale(1.04)',
            }}
          />
        </picture>
      </div>

      <div
        className="
          pointer-events-none absolute inset-x-0 bottom-0 h-[60px]
          translate-y-full opacity-0 transition-all duration-500
          group-hover:translate-y-0 group-hover:opacity-100
        "
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0) 100%)',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      <span
        className="
          pointer-events-none absolute bottom-3 right-3 left-[50px]
          translate-y-2 text-right text-[15px] italic leading-snug text-[#f5f3ee]
          opacity-0 transition-all duration-500
          group-hover:translate-y-0 group-hover:opacity-100
        "
        style={{
          fontFamily: 'var(--font-canela), serif',
          transitionDelay: '50ms',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          textShadow: '0 1px 4px rgba(0,0,0,0.35)',
        }}
      >
        {image.title}
      </span>

      <span
        className="
          pointer-events-none absolute bottom-3 left-3 font-mono text-[9px]
          uppercase tracking-[0.22em] text-white opacity-90
        "
        style={{ textShadow: '0 0 8px rgba(0,0,0,0.55)' }}
      >
        Nº {String(index + 1).padStart(2, '0')}
      </span>
    </figure>
  );
}
