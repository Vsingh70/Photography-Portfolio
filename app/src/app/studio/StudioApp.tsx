/**
 * vflics Studio — single authenticated web/PWA Project composer.
 *
 * Supabase-backed (Track B). A composer unit is a Project: title, slug,
 * category (kicker), blurb, optional location/shot_date, an ordered list of
 * images, and a chosen cover. On publish, originals upload to Supabase Storage
 * and projects/images rows are written, then the existing GitHub rebuild is
 * triggered. The R2 serving path + static public site are untouched.
 *
 * Auth: Supabase passkey (WebAuthn) primary, password fallback. The admin
 * allowlist + RLS are the real gate.
 * Persistence: localStorage stores draft *metadata* only — blobs are lost on
 * refresh and resurface as `missing` until re-attached.
 */

'use client';

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type DragEvent as ReactDragEvent,
} from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';
import { ingestFile, fileExt, uid } from '@/lib/studio/ingest';
import { slugify, slugifyInput, uniqueSlug } from '@/lib/studio/slug';
import { loadDraft, saveDraft, clearDraftProjects } from '@/lib/studio/draft';
import { publishProjects, publishProjectChanges, triggerRebuild } from '@/lib/studio/publish';
import {
  loadRemoteProjects,
  persistProjectOrder,
  loadProjectImages,
  persistImageOrder,
  deleteImage,
  deleteProject,
  loadGear,
  saveGear,
  type GearKind,
  type GearLists,
} from '@/lib/studio/remote';
import type { ImageExif, PublishProgress, StudioImage, StudioProject } from '@/lib/studio/types';
import {
  composeSettings,
  parseLensSpec,
  parseSettings,
  reconcileWithLens,
  type ExposureFields,
} from '@/lib/studio/lens';
import { Cap, Pill, Rule, Heading, Combobox, INK, CREAM, DIM } from './components/ui';
import { LoginScreen } from './components/LoginScreen';
import { ImageTile } from './components/ImageTile';
import { SettingsEditor } from './components/SettingsEditor';
import { DateField } from './components/DateField';
import { SettingsPanel } from './components/SettingsPanel';
import { SecurityPanel } from './components/SecurityPanel';
import { ReorderPanel } from './components/ReorderPanel';
import { StudioProgress, type StudioActivity } from './components/StudioProgress';

type Client = SupabaseClient<Database>;
type Tab = 'compose' | 'reorder' | 'settings' | 'security';

const SERIF = 'Cormorant Garamond, serif';
const PANEL_EASE = [0.16, 1, 0.3, 1] as const;
// Public R2 CDN base — used to build the lightweight webp thumbnail URLs that
// remote (published) project tiles render from. NEXT_PUBLIC_* so it's inlined
// client-side; '' if unset (tiles then fall back to the signed Storage URL).
const CDN_BASE = process.env.NEXT_PUBLIC_GALLERY_CDN_BASE ?? '';

/**
 * Clean, human image title — "{Project title} ({index+1})" — used as the tile
 * label and the published `images.title`. Never the raw camera filename. Falls
 * back to "Untitled" while a project has no title yet.
 */
function cleanImageTitle(projectTitle: string, index: number): string {
  return `${projectTitle.trim() || 'Untitled'} (${index + 1})`;
}

function newProject(sortOrder: number): StudioProject {
  return {
    id: uid(),
    remote: false,
    title: '',
    slug: '',
    category: '',
    blurb: '',
    location: '',
    shotDate: '',
    sortOrder,
    coverImageId: null,
    images: [],
  };
}

export function StudioApp() {
  const supabase = useMemo<Client>(() => getSupabaseBrowserClient(), []);

  // ── Auth ──
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // Set when this session began via the password fallback, so the composer can
  // surface a one-time "add a passkey" nudge (only if zero passkeys exist).
  const [cameFromPassword, setCameFromPassword] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // ── Service worker (Studio scope only) ──
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/studio-sw.js', { scope: '/studio' })
        .catch(() => {});
    }
  }, []);

  if (!authReady) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: INK,
          color: DIM,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontSize: 20,
        }}
      >
        Loading…
      </div>
    );
  }

  if (!session) {
    return <LoginScreen supabase={supabase} onPasswordSignedIn={() => setCameFromPassword(true)} />;
  }

  return <Composer supabase={supabase} session={session} cameFromPassword={cameFromPassword} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated composer
// ─────────────────────────────────────────────────────────────────────────────

function Composer({
  supabase,
  session,
  cameFromPassword,
}: {
  supabase: Client;
  session: Session;
  cameFromPassword: boolean;
}) {
  const reducedMotion = useReducedMotion() ?? false;

  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('compose');
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [thumbSize, setThumbSize] = useState(150);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [dragOverImageId, setDragOverImageId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [restoreBanner, setRestoreBanner] = useState<{ count: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);
  // Remote projects whose existing images we've already lazily fetched.
  const loadedRemoteImagesRef = useRef<Set<string>>(new Set());
  const [loadingImagesId, setLoadingImagesId] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // ── Gear (cameras + lenses) ──
  // Loaded once on mount; new values (typed in a combobox or seen in EXIF on
  // ingest) are appended in-memory and persisted via saveGear so the dropdowns
  // grow from real shots without a reload.
  const [gear, setGear] = useState<GearLists>({ cameras: [], lenses: [] });
  useEffect(() => {
    let cancelled = false;
    loadGear(supabase)
      .then((g) => {
        if (!cancelled) setGear(g);
      })
      .catch(() => {
        /* non-fatal — dropdowns just start empty */
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Append a gear label to the in-memory list (deduped, sorted) and persist it.
  // No-op on empty / already-present. Tolerant: a failed save never blocks edits.
  const rememberGear = useCallback(
    (kind: GearKind, label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      setGear((prev) => {
        const list = kind === 'camera' ? prev.cameras : prev.lenses;
        if (list.some((l) => l.toLowerCase() === trimmed.toLowerCase())) return prev;
        const nextList = [...list, trimmed].sort((a, b) => a.localeCompare(b));
        return kind === 'camera' ? { ...prev, cameras: nextList } : { ...prev, lenses: nextList };
      });
      saveGear(supabase, kind, trimmed).catch(() => {});
    },
    [supabase]
  );

  // ── One-time "add a passkey" nudge after a password sign-in ──
  // Only shows when the session began via password AND the account has zero
  // passkeys (don't nag once at least one is registered).
  const [showPasskeyNudge, setShowPasskeyNudge] = useState(false);
  useEffect(() => {
    if (!cameFromPassword) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.passkey.list();
      if (cancelled || error) return;
      if ((data ?? []).length === 0) setShowPasskeyNudge(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [cameFromPassword, supabase]);

  // ── Load drafts + remote projects on mount ──
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const drafts = loadDraft();
    (async () => {
      let remote: StudioProject[] = [];
      try {
        remote = await loadRemoteProjects(supabase);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Could not load projects.');
      }
      // A draft and a published project can share an id (a project keeps its id
      // through publish). The published row is the source of truth — it carries
      // the real per-image metadata (exif/alt/cover) and lazily loads its images
      // with full exif. A leftover draft only holds STALE metadata and `missing`
      // images (blobs are dropped on save), so letting it win silently shadows a
      // published project with empty exif → the Settings editor renders blank.
      // Prefer the remote row on collision and keep only drafts with no remote
      // counterpart (true unpublished, local-only work).
      const remoteIds = new Set(remote.map((r) => r.id));
      const localOnlyDrafts = drafts.filter((d) => !remoteIds.has(d.id));
      const merged = [...localOnlyDrafts, ...remote];
      setProjects(merged);
      setActiveId(merged[0]?.id ?? null);
      // Purge any now-shadowing drafts from localStorage so the stale empty-exif
      // copy can't resurface on a later reload (self-healing). `merged` is all
      // local-only drafts + remote rows, so saveDraft (local-only filter) writes
      // back exactly the surviving drafts.
      if (localOnlyDrafts.length !== drafts.length) saveDraft(merged);
      const missing = localOnlyDrafts.reduce((n, p) => n + p.images.length, 0);
      if (missing > 0) setRestoreBanner({ count: missing });
    })();
  }, [supabase]);

  // ── Persist drafts on change ──
  useEffect(() => {
    saveDraft(projects);
  }, [projects]);

  const active = projects.find((p) => p.id === activeId) ?? null;
  const localProjects = projects.filter((p) => !p.remote);
  const totalPhotos = localProjects.reduce((n, p) => n + p.images.length, 0);
  // Latest active-project images, read by stable callbacks (Cmd+A, marquee)
  // without re-creating them on every edit.
  const activeImagesRef = useRef<StudioImage[]>([]);
  activeImagesRef.current = active?.images ?? [];

  // ── Lazily load a published project's existing images when it's opened ──
  // Remote projects load with `images: []` + a count; the first time one is
  // selected we fetch its images (with signed thumbnail URLs) into the grid so
  // they can be viewed, reordered, and deleted directly against Supabase.
  const activeProjectId = active?.id ?? null;
  const activeIsRemote = active?.remote ?? false;
  const activeSlug = active?.slug ?? '';
  useEffect(() => {
    if (!activeProjectId || !activeIsRemote || tab !== 'compose') return;
    if (loadedRemoteImagesRef.current.has(activeProjectId)) return;
    const projectId = activeProjectId;
    loadedRemoteImagesRef.current.add(projectId);
    let cancelled = false;
    setLoadingImagesId(projectId);
    setImageError(null);
    (async () => {
      try {
        const remoteImages = await loadProjectImages(supabase, projectId, activeSlug, CDN_BASE);
        if (cancelled) return;
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  // Prepend the just-loaded remote images; keep any locally
                  // appended (not-yet-published) originals after them.
                  ...p,
                  images: [...remoteImages, ...p.images.filter((f) => !f.remoteImage)],
                }
              : p
          )
        );
      } catch (e) {
        if (cancelled) return;
        loadedRemoteImagesRef.current.delete(projectId); // allow a retry
        setImageError(e instanceof Error ? e.message : 'Could not load this project’s images.');
      } finally {
        if (!cancelled) setLoadingImagesId((id) => (id === projectId ? null : id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, activeIsRemote, activeSlug, tab, supabase]);

  const takenSlugs = useCallback(
    (exceptId: string) =>
      new Set(projects.filter((p) => p.id !== exceptId && p.slug).map((p) => p.slug)),
    [projects]
  );

  // ── Project CRUD ──
  const createProject = () => {
    const proj = newProject(projects.length);
    setProjects((prev) => [...prev, proj]);
    setActiveId(proj.id);
    setTab('compose');
  };

  // Patch a project. For a saved (remote) project, any user edit routed through
  // here (text fields, slug, title, reorder) also marks it dirty so Publish
  // enables and a rebuild can be triggered. Pass `{ dirty }` explicitly to
  // override (e.g. clearing it after publish).
  const updateProject = useCallback(
    (id: string, patch: Partial<StudioProject>) =>
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, ...patch, dirty: patch.dirty ?? (p.remote ? true : p.dirty) }
            : p
        )
      ),
    []
  );

  const removeProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) {
      const remaining = projects.filter((p) => p.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
  };

  // Title edit auto-derives slug while the slug hasn't been hand-edited.
  const onTitleChange = (id: string, title: string) => {
    const proj = projects.find((p) => p.id === id);
    if (!proj) return;
    const derivedFromOld = proj.slug === '' || proj.slug === slugify(proj.title);
    const patch: Partial<StudioProject> = { title };
    if (derivedFromOld) {
      patch.slug = uniqueSlug(slugify(title), takenSlugs(id));
    }
    updateProject(id, patch);
  };

  // Live typing uses the lenient sanitizer (so dashes can be entered); the slug
  // input cleans any trailing hyphen on blur via the strict slugify.
  const onSlugChange = (id: string, raw: string) => {
    updateProject(id, { slug: slugifyInput(raw) });
  };
  const onSlugBlur = (id: string, value: string) => {
    updateProject(id, { slug: slugify(value) });
  };

  // ── Image ingestion ──
  const ingest = useCallback(
    async (fileList: FileList | File[]) => {
      if (!active) return;
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;

      const existingHashes = new Set(active.images.map((f) => f.hash).filter(Boolean));
      const processed: StudioImage[] = [];
      for (const file of files) {
        try {
          processed.push(await ingestFile(file, existingHashes));
        } catch {
          // skip unreadable
        }
      }
      // Autosave any camera/lens carried in EXIF so the kit list grows from real
      // shots (deduped + persisted by rememberGear).
      for (const img of processed) {
        if (img.exif?.camera) rememberGear('camera', img.exif.camera);
        if (img.exif?.lens) rememberGear('lens', img.exif.lens);
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.id === active.id
            ? {
                ...p,
                images: [...p.images, ...processed],
                // Appending new originals to a saved project makes it dirty.
                dirty: p.remote ? true : p.dirty,
              }
            : p
        )
      );
    },
    [active, rememberGear]
  );

  // ── Image reorder ──
  // For remote projects the new order of the *existing* (remote) images is
  // persisted to Supabase immediately; locally-appended originals keep their
  // in-memory order until publish.
  const onTileDragEnd = () => {
    if (draggedImageId && dragOverImageId && draggedImageId !== dragOverImageId && active) {
      const images = active.images;
      // If the dragged tile is part of a multi-selection, the whole selected
      // group moves together (keeping its relative order); otherwise just the
      // one dragged tile moves. Insert before the drop target.
      const moveGroup = selectedImageIds.has(draggedImageId) && selectedImageIds.size > 1;
      const movingSet = moveGroup
        ? new Set(images.filter((f) => selectedImageIds.has(f.id)).map((f) => f.id))
        : new Set([draggedImageId]);

      // Can't drop a group onto one of its own members.
      if (!movingSet.has(dragOverImageId)) {
        const moving = images.filter((f) => movingSet.has(f.id));
        const rest = images.filter((f) => !movingSet.has(f.id));
        const insertAt = rest.findIndex((f) => f.id === dragOverImageId);
        if (insertAt >= 0) {
          const next = [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)];
          updateProject(active.id, { images: next });
          if (active.remote) {
            const remoteOrder = next.filter((f) => f.remoteImage).map((f) => f.id);
            if (remoteOrder.length > 0) {
              persistImageOrder(supabase, remoteOrder).catch((e) =>
                setImageError(e instanceof Error ? e.message : 'Could not save image order.')
              );
            }
          }
        }
      }
    }
    setDraggedImageId(null);
    setDragOverImageId(null);
  };

  // ── Per-image delete ──
  // Remote images are removed from Supabase (Storage + row) immediately; staged
  // (local) images are just dropped from the in-memory project.
  const deleteOneImage = useCallback(
    async (imageId: string) => {
      if (!active) return;
      const image = active.images.find((f) => f.id === imageId);
      if (!image) return;
      // Optimistically remove from the grid.
      const projectId = active.id;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                images: p.images.filter((f) => f.id !== imageId),
                coverImageId: p.coverImageId === imageId ? null : p.coverImageId,
                remoteImageCount:
                  p.remote && image.remoteImage
                    ? Math.max(0, (p.remoteImageCount ?? 0) - 1)
                    : p.remoteImageCount,
                // The DB row is deleted immediately, but the live site still
                // needs a rebuild to drop the image → mark dirty.
                dirty: p.remote ? true : p.dirty,
              }
            : p
        )
      );
      setSelectedImageIds((prev) => {
        if (!prev.has(imageId)) return prev;
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
      if (image.remoteImage) {
        try {
          await deleteImage(supabase, image);
        } catch (e) {
          setImageError(e instanceof Error ? e.message : 'Could not delete image from Supabase.');
        }
      }
    },
    [active, supabase]
  );

  // ── Delete a whole published project (Storage folder + DB row) ──
  const [projectDeleting, setProjectDeleting] = useState(false);
  const removeRemoteProject = useCallback(
    async (project: StudioProject) => {
      setProjectDeleting(true);
      setImageError(null);
      try {
        await deleteProject(supabase, project);
        loadedRemoteImagesRef.current.delete(project.id);
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
        setActiveId((curr) => {
          if (curr !== project.id) return curr;
          const remaining = projects.filter((p) => p.id !== project.id);
          return remaining[0]?.id ?? null;
        });
      } catch (e) {
        setImageError(e instanceof Error ? e.message : 'Could not delete project.');
      } finally {
        setProjectDeleting(false);
      }
    },
    [supabase, projects]
  );

  // ── Image selection ──
  // These handlers are wrapped in useCallback (and key off the functional
  // setters / activeId rather than `active`) so the memoized ImageTiles aren't
  // forced to re-render on every drag-over tick.
  // The anchor is the last plain-clicked tile; Shift+click extends from it to
  // the clicked tile (inclusive, either direction) — read via a ref so the
  // handler stays stable.
  const selectionAnchorRef = useRef<string | null>(null);
  const toggleSelect = useCallback((imageId: string, mods?: { shiftKey?: boolean }) => {
    // Shift+click → select the contiguous range from the anchor to here.
    if (mods?.shiftKey && selectionAnchorRef.current && selectionAnchorRef.current !== imageId) {
      const imgs = activeImagesRef.current;
      const a = imgs.findIndex((f) => f.id === selectionAnchorRef.current);
      const b = imgs.findIndex((f) => f.id === imageId);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = imgs.slice(lo, hi + 1).map((f) => f.id);
        // Keep the anchor fixed so the range can be re-adjusted by shift-clicking
        // a different tile.
        setSelectedImageIds((prev) => new Set([...prev, ...range]));
        return;
      }
    }
    // Plain click → toggle this tile and make it the new range anchor.
    selectionAnchorRef.current = imageId;
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => {
    selectionAnchorRef.current = null;
    setSelectedImageIds(new Set());
  }, []);
  // Replace the whole selection (marquee drag-select) / select every image
  // (Cmd+A). Stable refs so the memoized tiles don't churn.
  const setSelection = useCallback((ids: string[]) => setSelectedImageIds(new Set(ids)), []);
  const selectAll = useCallback(
    () => setSelectedImageIds(new Set(activeImagesRef.current.map((f) => f.id))),
    []
  );

  // Keyboard selection shortcuts (compose tab only, ignored while typing in a
  // field): Cmd/Ctrl+A selects every image, Cmd/Ctrl+D clears the selection.
  useEffect(() => {
    if (tab !== 'compose') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== 'a' && key !== 'd') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (key === 'a') {
        if (activeImagesRef.current.length === 0) return;
        e.preventDefault();
        selectAll();
      } else {
        e.preventDefault(); // also stops the browser's Cmd+D bookmark
        clearSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, selectAll, clearSelection]);

  const deleteSelected = async () => {
    if (!active) return;
    const ids = active.images.filter((f) => selectedImageIds.has(f.id)).map((f) => f.id);
    clearSelection();
    // deleteOneImage handles both local drops and remote Supabase deletes.
    for (const id of ids) {
      await deleteOneImage(id);
    }
  };

  const setCover = useCallback(
    (imageId: string) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeId
            ? { ...p, coverImageId: imageId, dirty: p.remote ? true : p.dirty }
            : p
        )
      );
    },
    [activeId]
  );
  const setAlt = useCallback(
    (imageId: string, alt: string) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeId
            ? {
                ...p,
                images: p.images.map((f) => (f.id === imageId ? { ...f, alt } : f)),
                // A metadata edit on a saved project needs a rebuild → dirty.
                dirty: p.remote ? true : p.dirty,
              }
            : p
        )
      );
    },
    [activeId]
  );

  // Patch one image's EXIF (camera/lens/settings). Autosaves brand-new
  // camera/lens labels to the gear list so the dropdowns update immediately.
  const setExif = useCallback(
    (imageId: string, patch: Partial<ImageExif>) => {
      if (patch.camera) rememberGear('camera', patch.camera);
      if (patch.lens) rememberGear('lens', patch.lens);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeId
            ? {
                ...p,
                images: p.images.map((f) =>
                  f.id === imageId ? { ...f, exif: { ...f.exif, ...patch } } : f
                ),
                dirty: p.remote ? true : p.dirty,
              }
            : p
        )
      );
    },
    [activeId, rememberGear]
  );

  // Project-level convenience: stamp every image's exif.camera / exif.lens —
  // and, for a controlled shoot, the composed exposure settings — with the
  // chosen kit (one shoot is usually one kit). Each blank value is skipped so
  // you can apply just a camera, just a lens, just the settings, or any mix.
  // Autosaves the gear too.
  const applyKitToAll = useCallback(
    (camera: string, lens: string, settings?: string) => {
      const cam = camera.trim();
      const len = lens.trim();
      const set = settings?.trim() ?? '';
      if (!cam && !len && !set) return;
      if (cam) rememberGear('camera', cam);
      if (len) rememberGear('lens', len);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeId
            ? {
                ...p,
                images: p.images.map((f) => ({
                  ...f,
                  exif: {
                    ...f.exif,
                    ...(cam ? { camera: cam } : {}),
                    ...(len ? { lens: len } : {}),
                    ...(set ? { settings: set } : {}),
                  },
                })),
                dirty: p.remote ? true : p.dirty,
              }
            : p
        )
      );
    },
    [activeId, rememberGear]
  );
  const handleTileDragOver = useCallback((id: string, e: ReactDragEvent) => {
    e.preventDefault();
    setDragOverImageId(id);
  }, []);

  // ── Reorder persistence ──
  const commitOrder = async (orderedIds: string[]) => {
    setReorderSaving(true);
    try {
      const remoteIds = orderedIds.filter((id) => projects.find((p) => p.id === id)?.remote);
      await persistProjectOrder(supabase, remoteIds);
      // Reflect the new order locally.
      setProjects((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        return orderedIds
          .map((id, index) => {
            const p = byId.get(id);
            return p ? { ...p, sortOrder: index } : null;
          })
          .filter((p): p is StudioProject => p !== null);
      });
    } finally {
      setReorderSaving(false);
    }
  };

  // ── Publish ──
  const [publishOpen, setPublishOpen] = useState(false);
  // Separate flag for the single saved-project "Publish changes" progress modal.
  const [publishChangesOpen, setPublishChangesOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [publishedOk, setPublishedOk] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  // Set when the Site panel changes the hero/about image (saved live to the DB,
  // but needs a pipeline rebuild to appear on the static site). Enables the
  // top-bar Publish button so the operator can trigger that rebuild.
  const [siteDirty, setSiteDirty] = useState(false);
  // When a rebuild dispatch is fired, stamp the time so the top-bar progress
  // ring can show a time-based "building & deploying" estimate (the GH Action +
  // Vercel deploy run off-client). Auto-clears after the estimate window.
  const [rebuildStartedAt, setRebuildStartedAt] = useState<number | null>(null);
  useEffect(() => {
    if (rebuildStartedAt === null) return;
    const id = setTimeout(() => setRebuildStartedAt(null), 6.5 * 60_000);
    return () => clearTimeout(id);
  }, [rebuildStartedAt]);

  // Unified current-activity model for the top-bar progress ring. Upload % is
  // real (from the publish flow); building is an estimate; loading is a spinner.
  const activity = useMemo<StudioActivity | null>(() => {
    if (publishing && progress) {
      const { projectIdx, projectTotal, fileIdx, fileTotal, projectTitle, phase } = progress;
      const within = fileTotal > 0 ? fileIdx / fileTotal : 0;
      const frac = projectTotal > 0 ? (projectIdx + within) / projectTotal : 0;
      const phaseLabel = phase === 'upload' ? 'Uploading' : phase === 'rows' ? 'Saving rows' : 'Setting cover';
      return {
        kind: 'uploading',
        progress: frac,
        label: `Uploading “${projectTitle}”`,
        detail:
          `Project ${projectIdx + 1}/${projectTotal} · ${phaseLabel}` +
          (fileTotal > 0 ? ` · photo ${Math.min(fileIdx + 1, fileTotal)}/${fileTotal}` : ''),
      };
    }
    if (triggering) {
      return { kind: 'triggering', progress: 0.99, label: 'Triggering the site rebuild' };
    }
    if (rebuildStartedAt) {
      return {
        kind: 'building',
        progress: null,
        startedAt: rebuildStartedAt,
        label: 'Building & deploying to vflics.com',
        detail: 'Variants → Cloudflare R2 · static export → Vercel',
      };
    }
    if (loadingImagesId) {
      return { kind: 'loading', progress: null, label: 'Loading this project’s images' };
    }
    return null;
  }, [publishing, progress, triggering, rebuildStartedAt, loadingImagesId]);

  const publishBlockers = useMemo(() => {
    const issues: string[] = [];
    const slugSeen = new Set<string>();
    localProjects.forEach((p) => {
      const name = p.title || '(untitled)';
      if (!p.title.trim()) issues.push(`A project needs a title`);
      if (!p.slug.trim()) issues.push(`"${name}" needs a slug`);
      else if (slugSeen.has(p.slug)) issues.push(`Duplicate slug "${p.slug}"`);
      else slugSeen.add(p.slug);
      if (!p.images.length) issues.push(`"${name}" has no images`);
      if (p.images.some((f) => f.missing)) issues.push(`"${name}" has images to re-attach`);
      if (p.images.some((f) => f.duplicate)) issues.push(`"${name}" contains duplicates`);
    });
    return Array.from(new Set(issues));
  }, [localProjects]);

  const canPublishDrafts = localProjects.length > 0 && publishBlockers.length === 0;

  // ── What's pending across the WHOLE workspace ──
  // Every saved (remote) project with unpublished edits — not just the active
  // one. A single Publish flushes all of these + all new drafts in one run, so
  // editing several saved projects and hitting Publish once works.
  const dirtyRemotes = useMemo(() => projects.filter((p) => p.remote && p.dirty), [projects]);
  // Site-only: nothing to upload/persist, just kick a rebuild.
  const onlySiteDirty = siteDirty && localProjects.length === 0 && dirtyRemotes.length === 0;
  const canPublish = onlySiteDirty ? true : canPublishDrafts || dirtyRemotes.length > 0;

  const onTopBarPublish = () => {
    if (onlySiteDirty) {
      performSiteRebuild();
    } else {
      setPublishOpen(true);
    }
  };

  // Top-bar button label reflecting what's pending.
  const publishLabel = (() => {
    if (onlySiteDirty) return 'Rebuild site →';
    const parts: string[] = [];
    if (localProjects.length) parts.push(`${localProjects.length} new`);
    if (dirtyRemotes.length) parts.push(`${dirtyRemotes.length} edited`);
    return parts.length ? `Publish → · ${parts.join(' · ')}` : 'Publish →';
  })();

  // Site-settings-only rebuild: the hero/about selection is already saved live
  // to site_settings; this just kicks the pipeline (no project payload — the
  // build always regenerates hero/about) so the change reaches the static site.
  // Reuses the "Publish changes" progress/success modal.
  const performSiteRebuild = async () => {
    setPublishChangesOpen(true);
    setPublishing(false);
    setProgress(null);
    setPublishError(null);
    setTriggerError(null);

    setRebuildStartedAt(Date.now());
    setTriggering(true);
    const trigErr = await triggerRebuild([], 'Site settings updated (hero / about)');
    setTriggerError(trigErr);
    setTriggering(false);
    setSiteDirty(false);

    setPublishedOk(true);
    setTimeout(() => {
      setPublishChangesOpen(false);
      setPublishedOk(false);
      setPublishError(null);
      setTriggerError(null);
    }, 3500);
  };

  // Publish pending changes for one saved project: flush text edits + appended
  // originals to Supabase (reorders/deletes already saved live), then trigger
  // the rebuild. Reuses the publishing/triggering/progress state + the existing
  // "rebuild in 2–6 min" success surface (via a small inline modal below).
  // Post-publish surgical update for a saved project: clear dirty, promote any
  // appended originals to remote (set storagePath, drop blob/dataURL), keep the
  // in-memory thumbnails so the open project doesn't flash, and refresh the
  // count. Deliberately does NOT reload from Supabase — a reload would blank the
  // lazy-loaded images and (the bug we're fixing) discard pending appends.
  const surgicalClean = (p: StudioProject): StudioProject => ({
    ...p,
    dirty: false,
    images: p.images.map((img) =>
      img.remoteImage
        ? img
        : {
            ...img,
            remoteImage: true,
            storagePath: `${p.slug}/${img.id}${fileExt(img.name, img.type)}`,
            blob: undefined,
            dataURL: undefined,
          }
    ),
    remoteImageCount: p.images.length,
  });

  // Publish EVERYTHING pending in one run: all valid new drafts, then every
  // dirty saved project (text/blurb/cover/captions/order + appended originals +
  // title re-index), then ONE rebuild. Replaces the old split flow where only
  // the active project — or only drafts — got published.
  const performPublishAll = async () => {
    setPublishing(true);
    setPublishError(null);
    setTriggerError(null);
    setProgress(null);

    // Invalid drafts are skipped (the modal still shows publishBlockers), so a
    // bad draft can't block flushing the saved-project edits.
    const drafts = publishBlockers.length === 0 ? localProjects : [];
    const remotes = dirtyRemotes;
    const total = drafts.length + remotes.length;

    const affectedSlugs = new Set<string>();
    const publishedRemoteIds = new Set<string>();
    let publishedDraftIds: string[] = [];

    try {
      // ── Phase A — new drafts (batched). publishProjects reports projectIdx
      // 0..drafts-1; rewrite only the total into the global progress frame.
      if (drafts.length > 0) {
        const { publishedIds, slugs } = await publishProjects(supabase, drafts, (p) =>
          setProgress({ ...p, projectTotal: total })
        );
        publishedDraftIds = publishedIds;
        slugs.forEach((s) => affectedSlugs.add(s));
      }

      // ── Phase B — each dirty saved project.
      for (let i = 0; i < remotes.length; i++) {
        const project = remotes[i];
        const globalIdx = drafts.length + i;
        await publishProjectChanges(supabase, project, (p) =>
          setProgress({ ...p, projectIdx: globalIdx, projectTotal: total })
        );
        publishedRemoteIds.add(project.id);
        affectedSlugs.add(project.slug);
      }

      setProgress(null);
      setPublishing(false);

      // ── Phase C — one rebuild over everything that changed.
      setRebuildStartedAt(Date.now());
      setTriggering(true);
      const note = `${drafts.length} new · ${remotes.length} edited published`;
      const trigErr = await triggerRebuild([...affectedSlugs], note);
      setTriggerError(trigErr);
      setTriggering(false);
      setSiteDirty(false); // the rebuild also regenerates hero/about

      // ── Phase D — reconcile. Drafts: clear from local store + reload as remote.
      const publishedDraftSet = new Set(publishedDraftIds);
      let reloaded: StudioProject[] = [];
      if (publishedDraftIds.length > 0) {
        clearDraftProjects(projects, publishedDraftSet);
        try {
          reloaded = await loadRemoteProjects(supabase);
        } catch {
          // non-fatal
        }
      }

      setPublishedOk(true);
      setTimeout(() => {
        setProjects((prev) => {
          const reloadedIds = new Set(reloaded.map((r) => r.id));
          // Drop published drafts + drafts colliding with a reloaded remote row.
          const survivingDrafts = prev.filter(
            (p) => !p.remote && !publishedDraftSet.has(p.id) && !reloadedIds.has(p.id)
          );
          // Existing remotes: surgical-clean the ones we just republished, keep
          // the rest as-is (never swap a republished remote for a reloaded copy —
          // that would blank its lazy-loaded images).
          const existingRemotes = prev
            .filter((p) => p.remote)
            .map((p) => (publishedRemoteIds.has(p.id) ? surgicalClean(p) : p));
          const existingRemoteIds = new Set(existingRemotes.map((p) => p.id));
          // Newly-loaded remotes not already present = the just-published drafts.
          const newRemotes = reloaded.filter((r) => !existingRemoteIds.has(r.id));
          return [...survivingDrafts, ...existingRemotes, ...newRemotes];
        });
        // Only reset the view if the active project was a published draft; keep
        // the user in context if they were editing a saved project.
        if (activeId && publishedDraftSet.has(activeId)) {
          setActiveId(null);
          setSelectedImageIds(new Set());
        }
        setPublishOpen(false);
        setPublishedOk(false);
        setPublishError(null);
        setTriggerError(null);
      }, 3500);
    } catch (err) {
      // Mid-run failure: clear dirty on the remotes already published (so a retry
      // skips them); the rest stay dirty for the retry.
      if (publishedRemoteIds.size > 0) {
        setProjects((prev) =>
          prev.map((p) => (publishedRemoteIds.has(p.id) ? surgicalClean(p) : p))
        );
      }
      setPublishError(err instanceof Error ? err.message : 'Publish failed');
      setPublishing(false);
      setProgress(null);
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gridTemplateRows: 'auto 1fr',
        height: '100vh',
        background: INK,
        color: CREAM,
        fontFamily: SERIF,
        overflow: 'hidden',
      }}
    >
      <TopBar
        email={session.user.email ?? ''}
        localCount={localProjects.length}
        totalPhotos={totalPhotos}
        activity={activity}
        canPublish={canPublish}
        publishLabel={publishLabel}
        onPublish={onTopBarPublish}
        onSignOut={() => supabase.auth.signOut()}
      />

      {showPasskeyNudge && (
        <PasskeyNudge
          onAdd={() => {
            setShowPasskeyNudge(false);
            setTab('security');
          }}
          onDismiss={() => setShowPasskeyNudge(false)}
        />
      )}

      <Sidebar
        projects={projects}
        activeId={activeId}
        tab={tab}
        loadError={loadError}
        reducedMotion={reducedMotion}
        onSelect={(id) => {
          setActiveId(id);
          setTab('compose');
        }}
        onSetTab={setTab}
        onCreate={createProject}
      />

      <main style={{ overflowY: 'auto', background: INK }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: reducedMotion ? 0 : 0.25, ease: PANEL_EASE }}
          >
            {tab === 'reorder' ? (
              <div style={{ padding: '32px 36px' }}>
                <ReorderPanel projects={projects} onCommitOrder={commitOrder} saving={reorderSaving} />
              </div>
            ) : tab === 'settings' ? (
              <div style={{ padding: '32px 36px' }}>
                <SettingsPanel supabase={supabase} onChanged={() => setSiteDirty(true)} />
              </div>
            ) : tab === 'security' ? (
              <div style={{ padding: '32px 36px' }}>
                <SecurityPanel supabase={supabase} />
              </div>
            ) : (
              <ProjectWorkspace
            project={active}
            reducedMotion={reducedMotion}
            loadingImages={loadingImagesId === active?.id}
            imageError={imageError}
            projectDeleting={projectDeleting}
            takenSlugs={active ? takenSlugs(active.id) : new Set()}
            selectedImageIds={selectedImageIds}
            thumbSize={thumbSize}
            draggedImageId={draggedImageId}
            dragOverImageId={dragOverImageId}
            dragActive={dragActive}
            restoreBanner={restoreBanner}
            onDismissRestore={() => setRestoreBanner(null)}
            onTitleChange={onTitleChange}
            onSlugChange={onSlugChange}
            onSlugBlur={onSlugBlur}
            onUpdate={updateProject}
            onRemove={removeProject}
            onDeleteRemoteProject={removeRemoteProject}
            onDeleteImage={deleteOneImage}
            onIngest={ingest}
            onCreate={createProject}
            onDragOver={(e) => {
              if (e.dataTransfer?.types?.includes('Files')) {
                e.preventDefault();
                setDragActive(true);
              }
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer?.files?.length) ingest(e.dataTransfer.files);
            }}
            onToggleSelect={toggleSelect}
            onClearSelection={clearSelection}
            onSetSelection={setSelection}
            onDeleteSelected={deleteSelected}
            groupDragging={
              draggedImageId !== null &&
              selectedImageIds.size > 1 &&
              selectedImageIds.has(draggedImageId)
            }
            onSetCover={setCover}
            onSetAlt={setAlt}
            onSetExif={setExif}
            onApplyKitToAll={applyKitToAll}
            cameras={gear.cameras}
            lenses={gear.lenses}
            onThumbSize={setThumbSize}
            onTileDragStart={setDraggedImageId}
            onTileDragOver={handleTileDragOver}
            onTileDragEnd={onTileDragEnd}
          />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {publishOpen && (
        <PublishModal
          projects={localProjects}
          editedProjects={dirtyRemotes}
          blockers={publishBlockers}
          publishing={publishing}
          progress={progress}
          triggering={triggering}
          publishedOk={publishedOk}
          publishError={publishError}
          triggerError={triggerError}
          onClose={() => {
            if (!publishing && !triggering) {
              setPublishOpen(false);
              setPublishError(null);
              setTriggerError(null);
            }
          }}
          onConfirm={performPublishAll}
        />
      )}

      {publishChangesOpen && (
        <PublishChangesModal
          publishing={publishing}
          progress={progress}
          triggering={triggering}
          publishedOk={publishedOk}
          publishError={publishError}
          triggerError={triggerError}
          onClose={() => {
            if (!publishing && !triggering) {
              setPublishChangesOpen(false);
              setPublishError(null);
              setTriggerError(null);
            }
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish-changes modal (single saved project) — progress + success only.
// No confirm step: clicking "Publish changes" is the confirmation, and
// reorders/deletes are already saved live. Reuses ProgressBlock + the existing
// "rebuild in 2–6 min" success copy.
// ─────────────────────────────────────────────────────────────────────────────

function PublishChangesModal({
  publishing,
  progress,
  triggering,
  publishedOk,
  publishError,
  triggerError,
  onClose,
}: {
  publishing: boolean;
  progress: PublishProgress | null;
  triggering: boolean;
  publishedOk: boolean;
  publishError: string | null;
  triggerError: string | null;
  onClose: () => void;
}) {
  const busy = publishing || triggering;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 28,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        style={{
          background: INK,
          border: '1px solid rgba(245,243,238,0.12)',
          maxWidth: 620,
          width: '100%',
          padding: 32,
        }}
      >
        {publishedOk ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Cap style={{ color: '#76c893' }}>{triggerError ? 'Saved (rebuild failed)' : 'Changes published'}</Cap>
            <Heading size={52} style={{ margin: '14px 0 16px' }}>
              On their way.
            </Heading>
            <p style={{ fontStyle: 'italic', color: 'rgba(245,243,238,0.65)', fontSize: 18, lineHeight: 1.5 }}>
              {triggerError
                ? 'Changes are saved to Supabase, but the rebuild trigger failed. Run the generate-galleries workflow manually to refresh the site.'
                : 'Changes are saved. The site will rebuild in 2–6 minutes.'}
            </p>
            {triggerError && (
              <p style={{ marginTop: 14, fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'rgba(231,76,60,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                {triggerError}
              </p>
            )}
          </div>
        ) : publishError ? (
          <div style={{ padding: '20px 8px' }}>
            <Cap style={{ color: '#e74c3c' }}>Publish failed</Cap>
            <p style={{ marginTop: 12, fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'rgba(231,76,60,0.9)', lineHeight: 1.6 }}>
              {publishError}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <Pill onClick={onClose}>Close</Pill>
            </div>
          </div>
        ) : triggering ? (
          <ProgressBlock title="Triggering the gallery rebuild." label="Publishing…" />
        ) : (
          <ProgressBlock
            title="Saving changes to Supabase."
            label="Publishing…"
            detail={
              progress
                ? progress.phase === 'upload'
                  ? `Uploading new image ${progress.fileIdx + 1} of ${progress.fileTotal}`
                  : progress.phase === 'cover'
                    ? 'setting cover'
                    : 'saving text edits'
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TopBar
// ─────────────────────────────────────────────────────────────────────────────

function TopBar({
  email,
  localCount,
  totalPhotos,
  activity,
  canPublish,
  publishLabel,
  onPublish,
  onSignOut,
}: {
  email: string;
  localCount: number;
  totalPhotos: number;
  activity: StudioActivity | null;
  canPublish: boolean;
  publishLabel: string;
  onPublish: () => void;
  onSignOut: () => void;
}) {
  return (
    <div
      style={{
        gridColumn: '1 / 3',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        height: 60,
        borderBottom: '1px solid rgba(245,243,238,0.08)',
        background: INK,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, fontSize: 22, letterSpacing: '-0.01em' }}>
          vflics
        </span>
        <Cap style={{ color: DIM }}>Studio</Cap>
        <StudioProgress activity={activity} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Cap style={{ color: DIM }}>
          {localCount} draft{localCount === 1 ? '' : 's'} · {totalPhotos} photos
        </Cap>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cap style={{ color: DIM }}>{email}</Cap>
          <Pill onClick={onSignOut}>Sign out</Pill>
        </div>
        <Pill kind="primary" onClick={onPublish} disabled={!canPublish}>
          {publishLabel}
        </Pill>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Passkey nudge (after a password sign-in with zero passkeys)
// ─────────────────────────────────────────────────────────────────────────────

function PasskeyNudge({ onAdd, onDismiss }: { onAdd: () => void; onDismiss: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 72,
        right: 20,
        zIndex: 80,
        maxWidth: 360,
        border: '1px solid rgba(118,200,147,0.4)',
        background: 'rgba(118,200,147,0.08)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <Cap style={{ color: 'rgba(118,200,147,0.95)' }}>Skip the password next time</Cap>
      <p style={{ margin: 0, fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, color: CREAM, lineHeight: 1.4 }}>
        Add a passkey so you can sign in with Face ID, Touch ID, or a security key.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Pill kind="primary" onClick={onAdd}>
          Add a passkey
        </Pill>
        <Pill onClick={onDismiss}>Not now</Pill>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────

function Sidebar({
  projects,
  activeId,
  tab,
  loadError,
  reducedMotion,
  onSelect,
  onSetTab,
  onCreate,
}: {
  projects: StudioProject[];
  activeId: string | null;
  tab: Tab;
  loadError: string | null;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onSetTab: (t: Tab) => void;
  onCreate: () => void;
}) {
  const tabBtn = (t: Tab, label: string) => {
    const isActive = tab === t;
    return (
      <button
        onClick={() => onSetTab(t)}
        style={{
          flex: 1,
          padding: '8px 0',
          background: isActive ? 'rgba(245,243,238,0.06)' : 'transparent',
          border: 'none',
          borderBottom: isActive ? '2px solid #f5f3ee' : '2px solid transparent',
          color: isActive ? CREAM : DIM,
          cursor: 'pointer',
          fontFamily: 'DM Mono, monospace',
          fontSize: 9,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <aside
      style={{
        borderRight: '1px solid rgba(245,243,238,0.08)',
        overflowY: 'auto',
        background: INK,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(245,243,238,0.08)' }}>
        {tabBtn('compose', 'Projects')}
        {tabBtn('reorder', 'Order')}
        {tabBtn('settings', 'Site')}
        {tabBtn('security', 'Security')}
      </div>

      <div style={{ padding: '8px 0', flex: 1 }}>
        {loadError && (
          <div style={{ padding: '12px 18px' }}>
            <Cap style={{ color: '#e74c3c' }}>{loadError}</Cap>
          </div>
        )}
        {projects.length === 0 ? (
          <div style={{ padding: '24px 18px', color: 'rgba(245,243,238,0.5)', fontStyle: 'italic', fontSize: 14 }}>
            No projects yet. Create one to get started.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {projects.map((p) => {
              const isActive = p.id === activeId && tab === 'compose';
              const count = p.remote ? (p.remoteImageCount ?? 0) : p.images.length;
              return (
                <motion.button
                  key={p.id}
                  layout={!reducedMotion}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                  transition={{ duration: reducedMotion ? 0 : 0.28, ease: PANEL_EASE }}
                  onClick={() => onSelect(p.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 18px',
                    background: isActive ? 'rgba(245,243,238,0.05)' : 'transparent',
                    borderLeft: isActive ? '2px solid #f5f3ee' : '2px solid transparent',
                    borderTop: 'none',
                    borderRight: 'none',
                    borderBottom: '1px solid rgba(245,243,238,0.06)',
                    color: CREAM,
                    cursor: 'pointer',
                    display: 'block',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(245,243,238,0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div
                    style={{
                      fontFamily: SERIF,
                      fontStyle: 'italic',
                      fontWeight: 300,
                      fontSize: 19,
                      lineHeight: 1.15,
                      color: p.title ? CREAM : 'rgba(245,243,238,0.4)',
                    }}
                  >
                    {p.title || 'Untitled project'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <Cap style={{ color: p.remote ? 'rgba(118,200,147,0.8)' : '#d4a93e' }}>
                      {p.remote ? 'Published' : 'Draft'}
                    </Cap>
                    <Cap style={{ color: DIM }}>{count} img</Cap>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(245,243,238,0.08)' }}>
        <Pill onClick={onCreate} style={{ width: '100%', justifyContent: 'center' }}>
          + New project
        </Pill>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Project workspace (compose tab)
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceProps {
  project: StudioProject | null;
  reducedMotion: boolean;
  loadingImages: boolean;
  imageError: string | null;
  projectDeleting: boolean;
  takenSlugs: Set<string>;
  selectedImageIds: Set<string>;
  /** True while a multi-selection is being dragged (so the whole group dims). */
  groupDragging: boolean;
  thumbSize: number;
  draggedImageId: string | null;
  dragOverImageId: string | null;
  dragActive: boolean;
  restoreBanner: { count: number } | null;
  onDismissRestore: () => void;
  onTitleChange: (id: string, title: string) => void;
  onSlugChange: (id: string, slug: string) => void;
  onSlugBlur: (id: string, slug: string) => void;
  onUpdate: (id: string, patch: Partial<StudioProject>) => void;
  onRemove: (id: string) => void;
  onDeleteRemoteProject: (project: StudioProject) => void;
  onDeleteImage: (id: string) => void;
  onIngest: (files: FileList | File[]) => void;
  onCreate: () => void;
  onDragOver: (e: ReactDragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: ReactDragEvent) => void;
  /** Toggle one tile; Shift+click extends a contiguous range from the anchor. */
  onToggleSelect: (id: string, mods?: { shiftKey?: boolean }) => void;
  onClearSelection: () => void;
  /** Replace the entire selection (marquee drag-select). */
  onSetSelection: (ids: string[]) => void;
  onDeleteSelected: () => void;
  onSetCover: (id: string) => void;
  onSetAlt: (id: string, alt: string) => void;
  onSetExif: (id: string, patch: Partial<ImageExif>) => void;
  onApplyKitToAll: (camera: string, lens: string, settings?: string) => void;
  cameras: string[];
  lenses: string[];
  onThumbSize: (n: number) => void;
  onTileDragStart: (id: string) => void;
  onTileDragOver: (id: string, e: ReactDragEvent) => void;
  onTileDragEnd: () => void;
}

function ProjectWorkspace(props: WorkspaceProps) {
  const { project, onDeleteImage } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Two-step per-image delete confirm (only meaningful for published images).
  const [confirmingImageId, setConfirmingImageId] = useState<string | null>(null);

  useEffect(() => {
    setConfirmingDelete(false);
    setConfirmingImageId(null);
  }, [project?.id]);

  // Stable so memoized ImageTiles don't re-render every drag tick: staged
  // (local) images delete immediately; published images require a confirm
  // before the Supabase delete fires.
  const imagesRef = useRef(project?.images);
  imagesRef.current = project?.images;
  const handleTileDelete = useCallback(
    (id: string) => {
      const img = imagesRef.current?.find((f) => f.id === id);
      if (img?.remoteImage) setConfirmingImageId(id);
      else onDeleteImage(id);
    },
    [onDeleteImage]
  );

  // The kit shared across this project's images, to pre-fill the "apply to all"
  // control (computed before the null guard so hook order stays stable).
  const kit = useMemo(() => commonKit(project?.images ?? []), [project?.images]);

  // ── Marquee drag-select ──
  // Click-drag on empty grid space draws a selection rectangle; every tile it
  // covers is selected. Shift/Cmd adds to the current selection; a plain click
  // on empty space clears it. Mousedowns that land on a tile are left alone so
  // the tile's own click-select and native drag-reorder still work.
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<
    { left: number; top: number; width: number; height: number } | null
  >(null);
  const marqueeDrag = useRef<{
    startX: number;
    startY: number;
    base: Set<string>;
    additive: boolean;
    moved: boolean;
  } | null>(null);

  const onGridMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-image-id]')) return; // on a tile → leave to it
    const wrap = gridWrapRef.current;
    if (!wrap) return;
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    marqueeDrag.current = {
      startX: e.clientX,
      startY: e.clientY,
      base: additive ? new Set(props.selectedImageIds) : new Set<string>(),
      additive,
      moved: false,
    };

    const onMove = (ev: MouseEvent) => {
      const info = marqueeDrag.current;
      if (!info) return;
      // Ignore sub-threshold jitter so a plain click stays a click.
      if (!info.moved && Math.abs(ev.clientX - info.startX) < 4 && Math.abs(ev.clientY - info.startY) < 4) {
        return;
      }
      info.moved = true;
      const rect = wrap.getBoundingClientRect();
      const minX = Math.min(info.startX, ev.clientX);
      const maxX = Math.max(info.startX, ev.clientX);
      const minY = Math.min(info.startY, ev.clientY);
      const maxY = Math.max(info.startY, ev.clientY);
      setMarquee({ left: minX - rect.left, top: minY - rect.top, width: maxX - minX, height: maxY - minY });
      const hit: string[] = [];
      wrap.querySelectorAll<HTMLElement>('[data-image-id]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.left < maxX && r.right > minX && r.top < maxY && r.bottom > minY) {
          const id = el.dataset.imageId;
          if (id) hit.push(id);
        }
      });
      props.onSetSelection([...new Set([...info.base, ...hit])]);
    };

    const onUp = () => {
      const info = marqueeDrag.current;
      // A click on empty space (no drag, no modifier) clears the selection.
      if (info && !info.moved && !info.additive) props.onClearSelection();
      marqueeDrag.current = null;
      setMarquee(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!project) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 60,
          textAlign: 'center',
        }}
      >
        <Cap style={{ color: DIM, marginBottom: 16 }}>Start here</Cap>
        <Heading size={56}>Create a project.</Heading>
        <p style={{ fontStyle: 'italic', fontSize: 17, color: 'rgba(245,243,238,0.65)', maxWidth: 440, lineHeight: 1.5, marginTop: 14 }}>
          A project is a titled set of images with a cover — like a gallery story. Add as many as
          you want before publishing.
        </p>
        <div style={{ marginTop: 28 }}>
          <Pill kind="primary" onClick={props.onCreate}>
            + New project
          </Pill>
        </div>
      </div>
    );
  }

  const selected = project.images.filter((f) => props.selectedImageIds.has(f.id));
  const duplicates = project.images.filter((f) => f.duplicate);
  const missing = project.images.filter((f) => f.missing);
  const effectiveCover = project.coverImageId ?? project.images[0]?.id ?? null;

  return (
    <motion.div
      // Re-key on the project id so selecting/creating a project fades the
      // composer body in (rather than popping). Reduced motion → opacity only.
      key={project.id}
      initial={props.reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={props.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: props.reducedMotion ? 0 : 0.28, ease: PANEL_EASE }}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
      style={{ position: 'relative', padding: '24px 28px', background: INK }}
    >
      {props.restoreBanner && (
        <div
          style={{
            border: '1px solid rgba(184,134,11,0.4)',
            background: 'rgba(184,134,11,0.08)',
            padding: '12px 16px',
            marginBottom: 22,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Cap style={{ color: '#d4a93e' }}>
            Draft restored · {props.restoreBanner.count} image references — re-add the originals to
            re-attach.
          </Cap>
          <button
            onClick={props.onDismissRestore}
            style={{ background: 'transparent', border: 'none', color: '#d4a93e', cursor: 'pointer', fontSize: 18 }}
          >
            ×
          </button>
        </div>
      )}

      {project.remote && (
        <div style={{ marginBottom: 18 }}>
          <Cap style={{ color: 'rgba(118,200,147,0.85)' }}>
            Published project · reorders &amp; deletes save instantly; edit text or append new
            originals below, then click {project.dirty ? '“Publish changes”' : 'Publish'} to rebuild
            the live site.
          </Cap>
          {project.dirty && (
            <div style={{ marginTop: 8 }}>
              <Cap style={{ color: '#d4a93e' }}>
                Unpublished changes — click “Publish changes” to rebuild the site (2–6 min).
              </Cap>
            </div>
          )}
          {props.imageError && (
            <div style={{ marginTop: 8 }}>
              <Cap style={{ color: '#e74c3c' }}>{props.imageError}</Cap>
            </div>
          )}
        </div>
      )}

      {/* Header: title + delete */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <Cap style={{ color: DIM }}>Title</Cap>
          <input
            value={project.title}
            onChange={(e) => props.onTitleChange(project.id, e.target.value)}
            placeholder="e.g. After Hours"
            style={titleInputStyle}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = CREAM)}
            onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(245,243,238,0.18)')}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {confirmingDelete ? (
            <>
              <Cap style={{ color: '#e74c3c' }}>
                {project.remote
                  ? props.projectDeleting
                    ? 'Deleting…'
                    : 'Delete from Supabase? This cannot be undone.'
                  : 'Remove from Studio?'}
              </Cap>
              <Pill
                kind="danger"
                disabled={props.projectDeleting}
                onClick={() => {
                  if (project.remote) {
                    props.onDeleteRemoteProject(project);
                  } else {
                    props.onRemove(project.id);
                  }
                  setConfirmingDelete(false);
                }}
              >
                Yes, delete
              </Pill>
              <Pill onClick={() => setConfirmingDelete(false)} disabled={props.projectDeleting}>
                Cancel
              </Pill>
            </>
          ) : (
            <Pill kind="danger" onClick={() => setConfirmingDelete(true)}>
              Delete project
            </Pill>
          )}
        </div>
      </div>

      {/* Metadata fields */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px 28px', marginTop: 20 }}>
        <Field label="Slug">
          <input
            value={project.slug}
            onChange={(e) => props.onSlugChange(project.id, e.target.value)}
            onBlur={(e) => props.onSlugBlur(project.id, e.target.value)}
            placeholder="after-hours"
            style={metaInputStyle}
          />
        </Field>
        <Field label="Category (kicker)">
          <input
            value={project.category}
            onChange={(e) => props.onUpdate(project.id, { category: e.target.value })}
            placeholder="Fashion · Portraiture"
            style={metaInputStyle}
          />
        </Field>
        <Field label="Location">
          <input
            value={project.location}
            onChange={(e) => props.onUpdate(project.id, { location: e.target.value })}
            placeholder="Brooklyn, NY"
            style={metaInputStyle}
          />
        </Field>
        <Field label="Shot date">
          <DateField
            value={project.shotDate}
            onChange={(next) => props.onUpdate(project.id, { shotDate: next })}
          />
        </Field>
      </div>

      <div style={{ marginTop: 18 }}>
        <Field label="Blurb">
          <textarea
            value={project.blurb}
            onChange={(e) => props.onUpdate(project.id, { blurb: e.target.value })}
            placeholder="A short editorial line shown on the gallery index and project page."
            rows={2}
            style={{ ...metaInputStyle, resize: 'vertical', fontStyle: 'italic', fontSize: 16 }}
          />
        </Field>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 28, marginTop: 18, flexWrap: 'wrap' }}>
        <Cap style={{ color: DIM }}>
          {project.images.length} image{project.images.length === 1 ? '' : 's'}
        </Cap>
        {duplicates.length > 0 && (
          <Cap style={{ color: '#e74c3c' }}>{duplicates.length} duplicate{duplicates.length === 1 ? '' : 's'}</Cap>
        )}
        {missing.length > 0 && <Cap style={{ color: '#d4a93e' }}>{missing.length} need re-attach</Cap>}
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '16px 0',
          marginTop: 14,
          borderTop: '1px solid rgba(245,243,238,0.08)',
          borderBottom: '1px solid rgba(245,243,238,0.08)',
          flexWrap: 'wrap',
        }}
      >
        <Pill onClick={() => fileInputRef.current?.click()}>+ Add photos</Pill>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) props.onIngest(e.target.files);
            e.target.value = '';
          }}
        />
        {selected.length > 0 ? (
          <>
            <Cap style={{ color: DIM }}>{selected.length} selected</Cap>
            <Pill kind="danger" onClick={props.onDeleteSelected}>Delete selected</Pill>
            <Pill onClick={props.onClearSelection}>Clear</Pill>
          </>
        ) : (
          <Cap style={{ color: 'rgba(245,243,238,0.45)' }}>
            Click or drag a box to select · Shift-click for a range · ⌘A all · ⌘D clear · drag to reorder · ☆ cover
            {project.remote ? ' · Reorders & deletes save instantly; click Publish to rebuild the live site' : ''}
          </Cap>
        )}
        {props.loadingImages && <Cap style={{ color: 'rgba(118,200,147,0.8)' }}>Loading images…</Cap>}
        <div style={{ flex: 1 }} />
        <Cap style={{ color: DIM }}>Thumb size</Cap>
        <input
          type="range"
          min={90}
          max={260}
          value={props.thumbSize}
          onChange={(e) => props.onThumbSize(Number(e.target.value))}
          style={{ accentColor: CREAM, width: 140 }}
        />
      </div>

      {/* Project-level kit: one shoot is usually one kit */}
      {project.images.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <ApplyKitControl
            cameras={props.cameras}
            lenses={props.lenses}
            reducedMotion={props.reducedMotion}
            initialCamera={kit.camera}
            initialLens={kit.lens}
            initialSettings={kit.settings}
            onApply={props.onApplyKitToAll}
          />
        </div>
      )}

      {/* Per-image delete confirm (published images delete from Supabase) */}
      {confirmingImageId && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            border: '1px solid rgba(231,76,60,0.4)',
            background: 'rgba(231,76,60,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Cap style={{ color: '#e74c3c' }}>
            Delete this image from Supabase? The original is removed now; the site updates on the
            next rebuild.
          </Cap>
          <div style={{ display: 'flex', gap: 8 }}>
            <Pill
              kind="danger"
              onClick={() => {
                props.onDeleteImage(confirmingImageId);
                setConfirmingImageId(null);
              }}
            >
              Yes, delete
            </Pill>
            <Pill onClick={() => setConfirmingImageId(null)}>Cancel</Pill>
          </div>
        </div>
      )}

      {/* Grid */}
      {project.images.length === 0 ? (
        props.loadingImages ? (
          <div style={{ marginTop: 32, padding: '60px 20px', textAlign: 'center' }}>
            <Cap style={{ color: DIM }}>Loading images…</Cap>
          </div>
        ) : (
          <EmptyDropZone onClickAdd={() => fileInputRef.current?.click()} dragActive={props.dragActive} />
        )
      ) : (
        <div
          ref={gridWrapRef}
          onMouseDown={onGridMouseDown}
          style={{ position: 'relative', marginTop: 22, minHeight: 160, userSelect: 'none' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${props.thumbSize}px, 1fr))`,
              gap: 14,
            }}
          >
            <AnimatePresence initial={false}>
              {project.images.map((image, i) => (
                <ImageTile
                  key={image.id}
                  image={image}
                  cleanTitle={cleanImageTitle(project.title, i)}
                  reducedMotion={props.reducedMotion}
                  selected={props.selectedImageIds.has(image.id)}
                  groupDragging={props.groupDragging}
                  isCover={effectiveCover === image.id}
                  draggedId={props.draggedImageId}
                  dragOverId={props.dragOverImageId}
                  thumbSize={props.thumbSize}
                  cameras={props.cameras}
                  lenses={props.lenses}
                  onToggleSelect={props.onToggleSelect}
                  onSetCover={props.onSetCover}
                  onAltChange={props.onSetAlt}
                  onExifChange={props.onSetExif}
                  onDelete={handleTileDelete}
                  onDragStart={props.onTileDragStart}
                  onDragOver={props.onTileDragOver}
                  onDragEnd={props.onTileDragEnd}
                />
              ))}
            </AnimatePresence>
          </div>
          {marquee && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: marquee.left,
                top: marquee.top,
                width: marquee.width,
                height: marquee.height,
                border: '1px solid rgba(245,243,238,0.55)',
                background: 'rgba(245,243,238,0.12)',
                pointerEvents: 'none',
                zIndex: 40,
              }}
            />
          )}
        </div>
      )}

      {props.dragActive && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(245,243,238,0.06)',
            border: '2px dashed rgba(245,243,238,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 50,
          }}
        >
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 44, fontWeight: 300, color: CREAM, textAlign: 'center' }}>
            Drop to add photos
            <br />
            <Cap style={{ display: 'inline-block', marginTop: 12, color: 'rgba(245,243,238,0.65)' }}>
              to {project.title || 'this project'}
            </Cap>
          </div>
        </div>
      )}
    </motion.div>
  );
}

const titleInputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: 620,
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(245,243,238,0.18)',
  padding: '8px 0 10px',
  fontFamily: SERIF,
  fontStyle: 'italic',
  fontWeight: 300,
  fontSize: 38,
  color: CREAM,
  outline: 'none',
  letterSpacing: '-0.015em',
};

const metaInputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(245,243,238,0.18)',
  padding: '6px 0 8px',
  fontFamily: SERIF,
  fontSize: 18,
  color: CREAM,
  outline: 'none',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Cap style={{ color: DIM }}>{label}</Cap>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply-kit-to-all control: one shoot is usually one kit, so let the user stamp
// a camera + lens — and, optionally, the exposure settings — onto every image
// in the project at once. Expands inline from a pill into two gear comboboxes +
// an optional structured (lens-aware) Settings editor + an "Apply" action.
// Applying just camera/lens stays possible (the Settings section is opt-in).
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_FIELDS: ExposureFields = { focal: '', aperture: '', shutter: '', iso: '' };

/**
 * The camera/lens/settings shared across every image in a project, or '' for a
 * field where the images disagree. Used to pre-fill the "apply to all" kit
 * control so an existing, uniform kit is visible + tweakable instead of starting
 * blank (a mixed field stays empty so applying it is an explicit choice).
 */
function commonKit(images: StudioImage[]): { camera: string; lens: string; settings: string } {
  const shared = (get: (e: ImageExif | undefined) => string | undefined): string => {
    if (!images.length) return '';
    const first = get(images[0]?.exif) ?? '';
    return images.every((img) => (get(img.exif) ?? '') === first) ? first : '';
  };
  return {
    camera: shared((e) => e?.camera),
    lens: shared((e) => e?.lens),
    settings: shared((e) => e?.settings),
  };
}

function ApplyKitControl({
  cameras,
  lenses,
  reducedMotion,
  initialCamera = '',
  initialLens = '',
  initialSettings = '',
  onApply,
}: {
  cameras: string[];
  lenses: string[];
  reducedMotion: boolean;
  /** The project's existing shared kit, pre-filled when the panel opens. */
  initialCamera?: string;
  initialLens?: string;
  initialSettings?: string;
  onApply: (camera: string, lens: string, settings?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [camera, setCamera] = useState('');
  const [lens, setLens] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fields, setFields] = useState<ExposureFields>(EMPTY_FIELDS);

  // Open pre-filled with the project's existing shared kit (seeded at open time
  // so it always reflects the current project/images, not a stale mount value).
  const openPanel = () => {
    setCamera(initialCamera);
    setLens(initialLens);
    const seeded = parseSettings(initialSettings);
    setFields(reconcileWithLens(seeded, parseLensSpec(initialLens)));
    setSettingsOpen(!!initialSettings);
    setOpen(true);
  };

  // The structured editor's guardrails come from the chosen lens here too.
  const lensSpec = parseLensSpec(lens);

  // Re-validate the fields against the lens whenever it changes (prime snap,
  // aperture floor, zoom clamp) — mirrors the per-image behavior.
  const commitLens = (next: string) => {
    setLens(next);
    setFields((prev) => reconcileWithLens(prev, parseLensSpec(next)));
  };

  const composed = composeSettings(fields);
  const canApply = !!(camera.trim() || lens.trim() || composed);

  const reset = () => {
    setCamera('');
    setLens('');
    setFields(EMPTY_FIELDS);
    setSettingsOpen(false);
    setOpen(false);
  };

  if (!open) {
    return <Pill onClick={openPanel}>Apply camera, lens &amp; settings to all</Pill>;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.18, ease: PANEL_EASE }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: '12px 14px',
          border: '1px solid rgba(245,243,238,0.14)',
          background: 'rgba(245,243,238,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 150 }}>
            <Cap style={{ color: 'rgba(245,243,238,0.5)', fontSize: 8 }}>Camera</Cap>
            <Combobox
              value={camera}
              options={cameras}
              placeholder="e.g. Sony A7 IV"
              reducedMotion={reducedMotion}
              onCommit={setCamera}
            />
          </div>
          <div style={{ minWidth: 150 }}>
            <Cap style={{ color: 'rgba(245,243,238,0.5)', fontSize: 8 }}>Lens</Cap>
            <Combobox
              value={lens}
              options={lenses}
              placeholder="e.g. 50mm f/1.4 GM"
              reducedMotion={reducedMotion}
              onCommit={commitLens}
            />
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            style={{
              background: 'transparent',
              border: 'none',
              color: settingsOpen ? '#f5f3ee' : 'rgba(245,243,238,0.5)',
              cursor: 'pointer',
              fontFamily: 'DM Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              padding: '6px 0',
            }}
          >
            {settingsOpen ? 'Settings ▲' : '+ Settings ▾'}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {settingsOpen && (
            <motion.div
              key="kit-settings"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2, ease: PANEL_EASE }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ maxWidth: 280, paddingTop: 2 }}>
                <SettingsEditor
                  fields={fields}
                  lensSpec={lensSpec}
                  reducedMotion={reducedMotion}
                  onChange={(patch) => setFields((prev) => ({ ...prev, ...patch }))}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Pill
            kind="primary"
            disabled={!canApply}
            onClick={() => {
              onApply(camera, lens, composed || undefined);
              reset();
            }}
          >
            Apply to all
          </Pill>
          <Pill onClick={reset}>Cancel</Pill>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty drop zone
// ─────────────────────────────────────────────────────────────────────────────

function EmptyDropZone({ onClickAdd, dragActive }: { onClickAdd: () => void; dragActive: boolean }) {
  return (
    <div
      onClick={onClickAdd}
      style={{
        marginTop: 32,
        padding: '80px 40px',
        border: `1px dashed ${dragActive ? '#f5f3ee' : 'rgba(245,243,238,0.2)'}`,
        background: dragActive ? 'rgba(245,243,238,0.04)' : 'transparent',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 36, fontWeight: 300, color: CREAM, letterSpacing: '-0.01em' }}>
        Drop photos here
      </div>
      <Cap style={{ color: DIM, display: 'inline-block', marginTop: 12 }}>or click to browse</Cap>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish modal
// ─────────────────────────────────────────────────────────────────────────────

/** One project row in the publish-confirm list (new or edited). */
function PublishRow({ project: p }: { project: StudioProject }) {
  const count = p.images.length || p.remoteImageCount || 0;
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid rgba(245,243,238,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, color: CREAM }}>
          {p.title || <span style={{ color: '#e74c3c' }}>(untitled)</span>}
        </div>
        <Cap style={{ color: DIM }}>
          /{p.slug || '—'} · {count} img
        </Cap>
      </div>
      {p.category && (
        <div style={{ marginTop: 6, fontFamily: 'DM Mono, monospace', fontSize: 10, color: DIM, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          {p.category}
        </div>
      )}
    </div>
  );
}

function PublishModal({
  projects,
  editedProjects,
  blockers,
  publishing,
  progress,
  triggering,
  publishedOk,
  publishError,
  triggerError,
  onClose,
  onConfirm,
}: {
  /** New drafts to publish. */
  projects: StudioProject[];
  /** Saved (remote) projects with pending edits to re-publish. */
  editedProjects: StudioProject[];
  blockers: string[];
  publishing: boolean;
  progress: PublishProgress | null;
  triggering: boolean;
  publishedOk: boolean;
  publishError: string | null;
  triggerError: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const busy = publishing || triggering;
  const totalCount = projects.length + editedProjects.length;
  // Drafts are gated by blockers, but pending saved-project edits can still
  // publish even if a draft is invalid (invalid drafts are skipped).
  const confirmDisabled = blockers.length > 0 && editedProjects.length === 0;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 28,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        style={{
          background: INK,
          border: '1px solid rgba(245,243,238,0.12)',
          maxWidth: 760,
          width: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: 32,
        }}
      >
        {publishedOk ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Cap style={{ color: '#76c893' }}>{triggerError ? 'Published (rebuild failed)' : 'Published'}</Cap>
            <Heading size={56} style={{ margin: '14px 0 16px' }}>
              On their way.
            </Heading>
            <p style={{ fontStyle: 'italic', color: 'rgba(245,243,238,0.65)', fontSize: 18, lineHeight: 1.5 }}>
              {triggerError
                ? 'Projects are saved to Supabase, but the rebuild trigger failed. Run the generate-galleries workflow manually to refresh the site.'
                : 'Projects are saved. The site will rebuild in 2–6 minutes.'}
            </p>
            {triggerError && (
              <p style={{ marginTop: 14, fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'rgba(231,76,60,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                {triggerError}
              </p>
            )}
          </div>
        ) : triggering ? (
          <ProgressBlock title="Triggering the gallery rebuild." label="Publishing…" />
        ) : publishing ? (
          <ProgressBlock
            title="Uploading originals to Supabase."
            label="Uploading…"
            detail={
              progress
                ? `Project ${progress.projectIdx + 1} of ${progress.projectTotal} · ${
                    progress.phase === 'upload'
                      ? `image ${progress.fileIdx + 1} of ${progress.fileTotal}`
                      : progress.phase === 'cover'
                        ? 'setting cover'
                        : 'saving rows'
                  }`
                : undefined
            }
          />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Cap style={{ color: DIM }}>Confirm publish</Cap>
              <Cap style={{ color: DIM }}>
                {projects.length > 0 && `${projects.length} new`}
                {projects.length > 0 && editedProjects.length > 0 && ' · '}
                {editedProjects.length > 0 && `${editedProjects.length} edited`}
              </Cap>
            </div>
            <Rule style={{ marginTop: 12 }} />
            <Heading size={48} style={{ margin: '20px 0 8px' }}>
              Ready to publish?
            </Heading>
            <p style={{ fontStyle: 'italic', color: 'rgba(245,243,238,0.65)', fontSize: 16, lineHeight: 1.45, margin: 0 }}>
              New projects upload their originals to Supabase. Edited projects re-save their text,
              cover, captions, ordering, and any added photos. The site then rebuilds from R2 once.
            </p>

            {(blockers.length > 0 || publishError) && (
              <div style={{ marginTop: 22, padding: '14px 16px', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.08)' }}>
                <Cap style={{ color: '#e74c3c' }}>
                  {publishError
                    ? 'Publish failed'
                    : editedProjects.length > 0
                      ? 'New drafts skipped until resolved'
                      : 'Resolve before publishing'}
                </Cap>
                <ul style={{ margin: '10px 0 0', padding: '0 0 0 18px', color: '#e74c3c', fontFamily: 'DM Mono, monospace', fontSize: 11, lineHeight: 1.7 }}>
                  {publishError ? <li>{publishError}</li> : blockers.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}

            {projects.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Cap style={{ color: '#76c893' }}>New projects</Cap>
                {projects.map((p) => (
                  <PublishRow key={p.id} project={p} />
                ))}
              </div>
            )}

            {editedProjects.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Cap style={{ color: '#d4a93e' }}>Edited projects</Cap>
                {editedProjects.map((p) => (
                  <PublishRow key={p.id} project={p} />
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 28, paddingTop: 18, borderTop: '1px solid rgba(245,243,238,0.08)' }}>
              <Pill onClick={onClose}>Cancel</Pill>
              <Pill kind="primary" onClick={onConfirm} disabled={confirmDisabled}>
                {`Publish ${totalCount} →`}
              </Pill>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProgressBlock({ title, label, detail }: { title: string; label: string; detail?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <Cap style={{ color: DIM }}>{label}</Cap>
      <p style={{ marginTop: 12, fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, color: 'rgba(245,243,238,0.7)' }}>
        {title}
      </p>
      {detail && (
        <Cap style={{ color: 'rgba(245,243,238,0.5)', display: 'block', marginTop: 8 }}>{detail}</Cap>
      )}
      <div style={{ width: 80, height: 2, background: 'rgba(245,243,238,0.18)', margin: '24px auto', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: CREAM, transform: 'translateX(-100%)', animation: 'pushBar 1.2s ease-in-out infinite' }} />
      </div>
    </div>
  );
}
