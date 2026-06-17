'use client';

/**
 * A single image card in the project composer grid. Click to select; drag to
 * reorder. Adds (vs. the legacy Thumb): a "Set as cover" toggle, an inline
 * alt/caption field, a dimensions/EXIF readout, and (for published images) a
 * per-image delete.
 *
 * Motion: the card is a `motion.div` with `layout` so reorder/add/remove animate
 * to their new slots, on a tight spring; hover/press use GPU transforms only
 * (scale), never width/height. While a drag is actively in progress `layout` is
 * disabled so the native drag ghost / drop targeting isn't fought by FLIP. The
 * image is rendered from a lightweight thumbnail: `thumbDataURL` for staged
 * files, and for published ones the small R2 webp variant (`remoteThumb`, a few
 * KB on the public CDN) with the heavier signed Storage URL kept only as an
 * `onError` fallback — this is the fix for the scroll/reorder jank.
 * Honors prefers-reduced-motion via the `reducedMotion` prop.
 */

import { memo, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { motion } from 'framer-motion';
import { formatBytes } from '@/lib/studio/ingest';
import type { StudioImage } from '@/lib/studio/types';
import { Cap } from './ui';

const EASE = [0.16, 1, 0.3, 1] as const;

export interface ImageTileProps {
  image: StudioImage;
  index: number;
  selected: boolean;
  isCover: boolean;
  draggedId: string | null;
  dragOverId: string | null;
  thumbSize: number;
  reducedMotion: boolean;
  /** id-parameterized callbacks so the parent can pass stable refs and let
   * `memo` skip tiles that didn't change between renders. */
  onToggleSelect: (id: string) => void;
  onSetCover: (id: string) => void;
  onAltChange: (id: string, alt: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, e: ReactDragEvent) => void;
  onDragEnd: () => void;
}

function ImageTileBase({
  image,
  index,
  selected,
  isCover,
  draggedId,
  dragOverId,
  thumbSize,
  reducedMotion,
  onToggleSelect,
  onSetCover,
  onAltChange,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
}: ImageTileProps) {
  const isDragged = draggedId === image.id;
  const isDragOver = dragOverId === image.id && draggedId !== image.id;
  const anyDragging = draggedId !== null;
  const ratioHeight = thumbSize * 1.25;
  const dims = image.width && image.height ? `${image.width}×${image.height}` : '';
  // Staged files render the in-memory thumbnail; published images render the
  // lightweight R2 webp variant, falling back (via onError below) to the signed
  // Storage original only if the variant 404s.
  const [variantFailed, setVariantFailed] = useState(false);
  const primarySrc = image.thumbDataURL
    || (variantFailed ? undefined : image.remoteThumb)
    || image.signedThumb
    || image.dataURL
    || '';
  // Suppress gesture transforms during an active HTML5 drag so the scale
  // doesn't fight the native drag ghost / drop targeting.
  const gesturesOn = !reducedMotion && !image.missing && !anyDragging;

  return (
    <motion.div
      // Disable FLIP layout animation while a drag is actively in progress so it
      // doesn't fight the native drag ghost / drop targeting; otherwise a tight
      // spring snaps tiles to their reordered slots.
      layout={!reducedMotion && !anyDragging}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: isDragged ? 0.4 : 1, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { layout: { type: 'spring', stiffness: 700, damping: 42 }, duration: 0.22, ease: EASE }
      }
      whileHover={gesturesOn ? { scale: 1.03 } : undefined}
      whileTap={gesturesOn ? { scale: 0.98 } : undefined}
      draggable={!image.missing}
      onDragStart={() => onDragStart(image.id)}
      onDragOver={(e) => onDragOver(image.id, e)}
      onDragEnd={onDragEnd}
      style={{
        position: 'relative',
        willChange: 'transform',
        outline: isDragOver
          ? '3px solid #f5f3ee'
          : isCover
            ? '2px solid #d4a93e'
            : selected
              ? '2px solid #f5f3ee'
              : '1px solid rgba(245,243,238,0.08)',
        outlineOffset: 0,
        background: '#1a1a1a',
        userSelect: 'none',
      }}
    >
      <div
        onClick={() => onToggleSelect(image.id)}
        style={{
          width: '100%',
          height: ratioHeight,
          cursor: image.missing ? 'not-allowed' : 'grab',
          background: '#1a1a1a',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {primarySrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primarySrc}
            alt=""
            draggable={false}
            // If the R2 variant 404s (rare — not yet built), fall back to the
            // signed Storage original by dropping remoteThumb from the source list.
            onError={() => {
              if (!variantFailed && image.remoteThumb && primarySrc === image.remoteThumb) {
                setVariantFailed(true);
              }
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none',
            }}
          />
        )}
        {image.missing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Cap style={{ color: '#d4a93e' }}>Re-attach</Cap>
          </div>
        )}
        {image.duplicate && !image.missing && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              padding: '3px 8px',
              background: 'rgba(231,76,60,0.85)',
              color: '#fff',
              fontFamily: 'DM Mono, monospace',
              fontSize: 8,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            Dup
          </div>
        )}
        {selected && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              width: 22,
              height: 22,
              borderRadius: 999,
              background: '#f5f3ee',
              color: '#0a0a0a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'DM Mono, monospace',
              fontSize: 12,
            }}
          >
            ✓
          </div>
        )}
        {isCover && (
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              left: 6,
              padding: '3px 8px',
              background: 'rgba(212,169,62,0.92)',
              color: '#0a0a0a',
              fontFamily: 'DM Mono, monospace',
              fontSize: 8,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            Cover
          </div>
        )}
      </div>

      <div style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontStyle: 'italic',
              fontSize: 13,
              color: '#f5f3ee',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {index + 1}. {image.name}
          </span>
          <Cap style={{ color: 'rgba(245,243,238,0.4)', fontSize: 8 }}>
            {image.size ? formatBytes(image.size) : ''}
          </Cap>
        </div>

        {(dims || image.exif?.settings) && (
          <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dims && <Cap style={{ color: 'rgba(245,243,238,0.35)', fontSize: 8 }}>{dims}</Cap>}
            {image.exif?.settings && (
              <Cap style={{ color: 'rgba(245,243,238,0.35)', fontSize: 8 }}>{image.exif.settings}</Cap>
            )}
          </div>
        )}

        <input
          value={image.alt ?? ''}
          placeholder="caption / alt…"
          onChange={(e) => onAltChange(image.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 6,
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(245,243,238,0.12)',
            padding: '2px 0 4px',
            fontFamily: 'Cormorant Garamond, serif',
            fontStyle: 'italic',
            fontSize: 12,
            color: 'rgba(245,243,238,0.8)',
            outline: 'none',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetCover(image.id);
            }}
            disabled={isCover}
            style={{
              marginTop: 6,
              background: 'transparent',
              border: 'none',
              color: isCover ? '#d4a93e' : 'rgba(245,243,238,0.45)',
              cursor: isCover ? 'default' : 'pointer',
              fontFamily: 'DM Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              padding: 0,
            }}
          >
            {isCover ? '★ Cover' : '☆ Set cover'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(image.id);
            }}
            style={{
              marginTop: 6,
              background: 'transparent',
              border: 'none',
              color: 'rgba(231,76,60,0.7)',
              cursor: 'pointer',
              fontFamily: 'DM Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              padding: 0,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export const ImageTile = memo(ImageTileBase);
