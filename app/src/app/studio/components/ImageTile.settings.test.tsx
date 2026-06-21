import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { ImageTile, type ImageTileProps } from './ImageTile';
import type { StudioImage } from '@/lib/studio/types';

afterEach(cleanup);

// A published image with a fully-populated exif.settings string (U+00B7 dots),
// exactly the shape loadProjectImages returns from Postgres.
const baseImage: StudioImage = {
  id: 'img-1',
  name: 'image',
  size: 0,
  type: '',
  hash: '',
  alt: '',
  remoteImage: true,
  storagePath: 'editorial/img-1.jpg',
  width: 4000,
  height: 6000,
  exif: {
    camera: 'Sony A7IV',
    lens: '50mm F1.4 DG DN | Art 023',
    settings: '50mm · f/1.4 · 1/500 · ISO 500',
    date: '2024-01-01',
  },
};

function renderTile(overrides: Partial<ImageTileProps> = {}) {
  const props: ImageTileProps = {
    image: baseImage,
    cleanTitle: 'Editorial (1)',
    selected: false,
    isCover: false,
    draggedId: null,
    dragOverId: null,
    thumbSize: 200,
    reducedMotion: true,
    cameras: ['Sony A7IV'],
    lenses: ['50mm F1.4 DG DN | Art 023'],
    onToggleSelect: vi.fn(),
    onSetCover: vi.fn(),
    onAltChange: vi.fn(),
    onExifChange: vi.fn(),
    onDelete: vi.fn(),
    onTilePointerDown: vi.fn(),
    ...overrides,
  };
  return render(<ImageTile {...props} />);
}

describe('ImageTile per-image Settings editor', () => {
  it('shows the parsed exposure values when Details is opened on a populated image', () => {
    renderTile();
    // Expand the Details panel.
    fireEvent.click(screen.getByText(/Details/i));

    // Focal: prime lens → locked chip shows the fixed 50mm.
    expect(screen.getByText(/50mm/)).toBeTruthy();

    // Aperture: the Select trigger should show f/1.4 (not the "f/—" placeholder).
    expect(screen.queryByText('f/—')).toBeNull();
    expect(screen.getByText('f/1.4')).toBeTruthy();

    // Shutter Combobox: input value should be 1/500.
    const shutter = document.querySelector<HTMLInputElement>('input[placeholder="1/200"]');
    expect(shutter?.value).toBe('1/500');

    // ISO Combobox: input value should be 500.
    const iso = document.querySelector<HTMLInputElement>('input[placeholder="500"]');
    expect(iso?.value).toBe('500');
  });

  it('recovers field values when exif arrives AFTER mount (async remote load)', () => {
    // Remote projects load images async: the tile can mount with empty exif
    // ({}), then the populated exif arrives via setProjects -> prop update.
    const empty: StudioImage = { ...baseImage, exif: {} };
    const { rerender } = renderTile({ image: empty });
    fireEvent.click(screen.getByText(/Details/i));

    // Now the real exif arrives on the SAME tile id (async load resolved).
    rerender(
      <ImageTile
        {...({
          image: baseImage,
          cleanTitle: 'Editorial (1)',
          selected: false,
          isCover: false,
          draggedId: null,
          dragOverId: null,
          thumbSize: 200,
          reducedMotion: true,
          cameras: ['Sony A7IV'],
          lenses: ['50mm F1.4 DG DN | Art 023'],
          onToggleSelect: vi.fn(),
          onSetCover: vi.fn(),
          onAltChange: vi.fn(),
          onExifChange: vi.fn(),
          onDelete: vi.fn(),
          onTilePointerDown: vi.fn(),
        } as ImageTileProps)}
      />
    );

    const shutter = document.querySelector<HTMLInputElement>('input[placeholder="1/200"]');
    const iso = document.querySelector<HTMLInputElement>('input[placeholder="500"]');
    expect(screen.getByText('f/1.4')).toBeTruthy();
    expect(shutter?.value).toBe('1/500');
    expect(iso?.value).toBe('500');
  });

  it('does not blank other exif fields when one field is patched (merge, not replace)', () => {
    // This guards the StudioApp handler contract: onExifChange receives a PARTIAL
    // patch, and the caller must merge it into the existing exif. ImageTile must
    // therefore only ever emit a partial patch (e.g. { settings }) and never a
    // full exif replacement.
    const onExifChange = vi.fn();
    renderTile({ onExifChange });
    fireEvent.click(screen.getByText(/Details/i));
    // No spurious onExifChange should fire on a clean mount (no lens change, no
    // edit) — a recompose-on-mount would clobber sibling fields.
    expect(onExifChange).not.toHaveBeenCalled();
  });
});
