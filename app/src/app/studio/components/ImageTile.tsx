'use client';

/**
 * A single image card in the project composer grid. Click to select; drag to
 * reorder. Adds (vs. the legacy Thumb): a "Set as cover" toggle, a "Details"
 * toggle that expands an inline metadata editor (Caption→alt, Camera/Lens gear
 * comboboxes→exif, Settings free text→exif), a dimensions readout, and (for
 * published images) a per-image delete. The label is a clean derived title
 * ("{Project} ({n})") — the raw camera filename is never surfaced.
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

import { memo, useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatBytes } from '@/lib/studio/ingest';
import {
  composeSettings,
  parseLensSpec,
  parseSettings,
  reconcileWithLens,
  type ExposureFields,
} from '@/lib/studio/lens';
import type { ImageExif, StudioImage } from '@/lib/studio/types';
import { Cap, Combobox } from './ui';
import { SettingsEditor } from './SettingsEditor';

const EASE = [0.16, 1, 0.3, 1] as const;

export interface ImageTileProps {
  image: StudioImage;
  /** Clean, human label ("{Project title} ({index+1})") — never the raw filename. */
  cleanTitle: string;
  selected: boolean;
  isCover: boolean;
  draggedId: string | null;
  dragOverId: string | null;
  thumbSize: number;
  reducedMotion: boolean;
  /** Saved camera / lens labels for the metadata comboboxes. */
  cameras: string[];
  lenses: string[];
  /** id-parameterized callbacks so the parent can pass stable refs and let
   * `memo` skip tiles that didn't change between renders. */
  onToggleSelect: (id: string) => void;
  onSetCover: (id: string) => void;
  onAltChange: (id: string, alt: string) => void;
  /** Patch the image's exif (camera/lens/settings). Caller merges + autosaves
   * brand-new camera/lens labels into the gear list. */
  onExifChange: (id: string, patch: Partial<ImageExif>) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, e: ReactDragEvent) => void;
  onDragEnd: () => void;
}

function ImageTileBase({
  image,
  cleanTitle,
  selected,
  isCover,
  draggedId,
  dragOverId,
  thumbSize,
  reducedMotion,
  cameras,
  lenses,
  onToggleSelect,
  onSetCover,
  onAltChange,
  onExifChange,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
}: ImageTileProps) {
  // Inline metadata editor expansion (caption + camera/lens/settings).
  const [editing, setEditing] = useState(false);

  // ── Structured exposure fields, derived from exif.settings + lens. ──
  const settingsStr = image.exif?.settings ?? '';
  const lensLabel = image.exif?.lens ?? '';
  const lensSpec = parseLensSpec(lensLabel);
  const [fields, setFields] = useState<ExposureFields>(() => parseSettings(settingsStr));

  // Re-parse when the committed settings string changes externally (apply-to-all,
  // EXIF pre-fill) while the editor isn't the one writing it.
  const lastComposedRef = useRef(settingsStr);
  useEffect(() => {
    if (settingsStr !== lastComposedRef.current) {
      setFields(parseSettings(settingsStr));
      lastComposedRef.current = settingsStr;
    }
  }, [settingsStr]);

  // When the selected lens changes, reconcile the fields to the new guardrails
  // (prime → snap focal; aperture too wide → bump up; zoom focal → clamp) and,
  // if anything actually changed, persist the recomposed settings string.
  const prevLensRef = useRef(lensLabel);
  useEffect(() => {
    if (lensLabel === prevLensRef.current) return;
    prevLensRef.current = lensLabel;
    setFields((prev) => {
      const next = reconcileWithLens(prev, parseLensSpec(lensLabel));
      const composed = composeSettings(next);
      if (composed !== (image.exif?.settings ?? '')) {
        lastComposedRef.current = composed;
        onExifChange(image.id, { settings: composed });
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lensLabel]);

  // Apply a field patch, compose, and push the canonical settings string up.
  const patchFields = (patch: Partial<ExposureFields>) => {
    setFields((prev) => {
      const next = { ...prev, ...patch };
      const composed = composeSettings(next);
      lastComposedRef.current = composed;
      onExifChange(image.id, { settings: composed });
      return next;
    });
  };

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
            {cleanTitle}
          </span>
          <Cap style={{ color: 'rgba(245,243,238,0.4)', fontSize: 8 }}>
            {image.size ? formatBytes(image.size) : ''}
          </Cap>
        </div>

        {dims && (
          <div style={{ marginTop: 4 }}>
            <Cap style={{ color: 'rgba(245,243,238,0.35)', fontSize: 8 }}>{dims}</Cap>
          </div>
        )}

        {/* Caption preview (alt) — read-only summary; edit inside the panel. */}
        {image.alt && !editing && (
          <div
            style={{
              marginTop: 5,
              fontFamily: 'Cormorant Garamond, serif',
              fontStyle: 'italic',
              fontSize: 12,
              color: 'rgba(245,243,238,0.7)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {image.alt}
          </div>
        )}

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
              setEditing((v) => !v);
            }}
            aria-expanded={editing}
            style={{
              marginTop: 6,
              background: 'transparent',
              border: 'none',
              color: editing ? '#f5f3ee' : 'rgba(245,243,238,0.45)',
              cursor: 'pointer',
              fontFamily: 'DM Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              padding: 0,
            }}
          >
            {editing ? 'Done ▲' : 'Details ▾'}
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

        {/* Inline metadata editor */}
        <AnimatePresence initial={false}>
          {editing && (
            <motion.div
              key="meta"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <MetaField label="Caption">
                  <input
                    value={image.alt ?? ''}
                    placeholder="A descriptive line (alt text + caption)…"
                    onChange={(e) => onAltChange(image.id, e.target.value)}
                    style={metaInput}
                  />
                </MetaField>
                <MetaField label="Camera">
                  <Combobox
                    value={image.exif?.camera ?? ''}
                    options={cameras}
                    placeholder="e.g. Sony A7 IV"
                    reducedMotion={reducedMotion}
                    onCommit={(next) => onExifChange(image.id, { camera: next })}
                  />
                </MetaField>
                <MetaField label="Lens">
                  <Combobox
                    value={image.exif?.lens ?? ''}
                    options={lenses}
                    placeholder="e.g. 50mm f/1.4 GM"
                    reducedMotion={reducedMotion}
                    onCommit={(next) => onExifChange(image.id, { lens: next })}
                  />
                </MetaField>
                <MetaField label="Settings">
                  <SettingsEditor
                    fields={fields}
                    lensSpec={lensSpec}
                    reducedMotion={reducedMotion}
                    onChange={patchFields}
                  />
                </MetaField>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const metaInput: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(245,243,238,0.18)',
  padding: '5px 0 7px',
  fontFamily: 'Cormorant Garamond, serif',
  fontSize: 15,
  color: '#f5f3ee',
  outline: 'none',
};

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Cap style={{ color: 'rgba(245,243,238,0.5)', fontSize: 8 }}>{label}</Cap>
      <div style={{ marginTop: 2 }}>{children}</div>
    </div>
  );
}

export const ImageTile = memo(ImageTileBase);
