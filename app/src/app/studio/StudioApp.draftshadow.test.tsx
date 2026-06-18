import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

// Remote rows (DB has FULL exif).
const PROJECT_ROW = {
  id: 'proj-1', slug: 'editorial', title: 'Editorial', category: 'Fashion',
  blurb: '', location: null, shot_date: null, sort_order: 0, cover_image_id: null,
  images: [{ count: 1 }],
};
const IMAGE_ROW = {
  id: 'img-1', storage_path: 'editorial/img-1.jpg', alt: '', title: 'Editorial (1)',
  width: 4000, height: 6000,
  exif: { camera: 'Sony A7IV', lens: '50mm F1.4 DG DN | Art 023', settings: '50mm · f/1.4 · 1/500 · ISO 50' },
  sort_order: 0,
};

function makeQuery(table: string) {
  const resolve = () => {
    if (table === 'projects') return { data: [PROJECT_ROW], error: null };
    if (table === 'images') return { data: [IMAGE_ROW], error: null };
    return { data: [], error: null };
  };
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'order', 'update', 'delete', 'upsert']) chain[m] = () => chain;
  (chain as { then: unknown }).then = (f: (v: unknown) => unknown) => Promise.resolve(resolve()).then(f);
  (chain as { maybeSingle: unknown }).maybeSingle = () => Promise.resolve({ data: null, error: null });
  return chain;
}
const supabaseMock = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: { user: { id: 'admin' } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: () => Promise.resolve({ error: null }),
    passkey: { list: () => Promise.resolve({ data: [], error: null }) },
  },
  from: (t: string) => makeQuery(t),
  storage: { from: () => ({
    createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'x' }, error: null }),
    remove: () => Promise.resolve({ error: null }), list: () => Promise.resolve({ data: [], error: null }),
  }) },
};
vi.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => supabaseMock }));

import { StudioApp } from './StudioApp';

beforeEach(() => {
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: () => Promise.resolve() } });
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

// The exact root cause of the blank Settings editor: a draft saved before the
// settings were entered for a project that was later published under the SAME id
// lingers in localStorage. Before the fix, loadDraft brought it back with empty
// exif and the merge let the draft WIN over the remote row → the remote (full
// exif) was dropped, the lazy image-load was skipped (the shadow is remote:false),
// and the tile rendered empty exif → ALL Settings fields blank. The fix makes the
// published (remote) row win on an id collision, so the real exif loads.
const STALE_SHADOW_DRAFT = JSON.stringify({
  savedAt: Date.now(),
  projects: [
    {
      id: 'proj-1', title: 'Editorial', slug: 'editorial', category: 'Fashion',
      blurb: '', location: '', shotDate: '', sortOrder: 0, coverImageId: null,
      images: [{ id: 'img-1', name: 'img-1', size: 0, type: '', hash: '', alt: '', width: 4000, height: 6000, exif: {} }],
    },
  ],
});

describe('Stale draft shadowing a published project (root cause of blank Settings)', () => {
  it('the published row wins on id collision: Settings show the real exif, not blank', async () => {
    localStorage.setItem('vflics-studio-projects', STALE_SHADOW_DRAFT);

    await act(async () => { render(<StudioApp />); });
    await waitFor(() => expect(screen.getByText('Editorial (1)')).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByText(/Details/i)); });

    await waitFor(() => {
      const shutter = document.querySelector<HTMLInputElement>('input[placeholder="1/200"]');
      const iso = document.querySelector<HTMLInputElement>('input[placeholder="500"]');
      expect(shutter?.value).toBe('1/500');
      expect(iso?.value).toBe('50');
      expect(screen.queryByText('f/—')).toBeNull();
      expect(screen.getAllByText('f/1.4').length).toBeGreaterThan(0);
    });
  });

  it('self-heals: the shadowing draft is purged from localStorage', async () => {
    localStorage.setItem('vflics-studio-projects', STALE_SHADOW_DRAFT);
    await act(async () => { render(<StudioApp />); });
    await waitFor(() => expect(screen.getByText('Editorial (1)')).toBeTruthy());
    // The colliding draft must be removed (no local-only drafts remain).
    await waitFor(() => expect(localStorage.getItem('vflics-studio-projects')).toBeNull());
  });
});
