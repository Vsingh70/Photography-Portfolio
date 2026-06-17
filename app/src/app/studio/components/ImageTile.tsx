'use client';

/**
 * A single image card in the project composer grid. Click to select; drag to
 * reorder. Adds (vs. the legacy Thumb): a "Set as cover" toggle, an inline
 * alt/caption field, and a dimensions/EXIF readout.
 */

import type { DragEvent as ReactDragEvent } from 'react';
import { formatBytes } from '@/lib/studio/ingest';
import type { StudioImage } from '@/lib/studio/types';
import { Cap } from './ui';

export function ImageTile({
  image,
  index,
  selected,
  isCover,
  draggedId,
  dragOverId,
  thumbSize,
  onToggleSelect,
  onSetCover,
  onAltChange,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  image: StudioImage;
  index: number;
  selected: boolean;
  isCover: boolean;
  draggedId: string | null;
  dragOverId: string | null;
  thumbSize: number;
  onToggleSelect: () => void;
  onSetCover: () => void;
  onAltChange: (alt: string) => void;
  onDragStart: () => void;
  onDragOver: (e: ReactDragEvent) => void;
  onDragEnd: () => void;
}) {
  const isDragged = draggedId === image.id;
  const isDragOver = dragOverId === image.id && draggedId !== image.id;
  const ratioHeight = thumbSize * 1.25;
  const dims = image.width && image.height ? `${image.width}×${image.height}` : '';

  return (
    <div
      draggable={!image.missing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      style={{
        position: 'relative',
        opacity: isDragged ? 0.4 : 1,
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
        transition: 'opacity 0.15s, outline-color 0.15s, outline-width 0.15s',
      }}
    >
      <div
        onClick={onToggleSelect}
        style={{
          width: '100%',
          height: ratioHeight,
          cursor: image.missing ? 'not-allowed' : 'grab',
          background: image.dataURL
            ? `url("${image.dataURL}") center/cover no-repeat #1a1a1a`
            : '#1a1a1a',
          position: 'relative',
        }}
      >
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
          onChange={(e) => onAltChange(e.target.value)}
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

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSetCover();
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
      </div>
    </div>
  );
}
