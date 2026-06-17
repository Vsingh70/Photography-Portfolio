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
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';
import { ingestFile, uid } from '@/lib/studio/ingest';
import { slugify, uniqueSlug } from '@/lib/studio/slug';
import { loadDraft, saveDraft, clearDraftProjects } from '@/lib/studio/draft';
import { publishProjects, triggerRebuild } from '@/lib/studio/publish';
import { loadRemoteProjects, persistProjectOrder } from '@/lib/studio/remote';
import type { PublishProgress, StudioImage, StudioProject } from '@/lib/studio/types';
import { Cap, Pill, Rule, Heading, INK, CREAM, DIM } from './components/ui';
import { LoginScreen } from './components/LoginScreen';
import { ImageTile } from './components/ImageTile';
import { SettingsPanel } from './components/SettingsPanel';
import { SecurityPanel } from './components/SecurityPanel';
import { ReorderPanel } from './components/ReorderPanel';

type Client = SupabaseClient<Database>;
type Tab = 'compose' | 'reorder' | 'settings' | 'security';

const SERIF = 'Cormorant Garamond, serif';

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
      // Local drafts win over a remote row with the same id (lets you re-open
      // a remote project for editing without losing in-memory image work).
      const draftIds = new Set(drafts.map((d) => d.id));
      const merged = [...drafts, ...remote.filter((r) => !draftIds.has(r.id))];
      setProjects(merged);
      setActiveId(merged[0]?.id ?? null);
      const missing = drafts.reduce((n, p) => n + p.images.length, 0);
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

  const updateProject = useCallback(
    (id: string, patch: Partial<StudioProject>) =>
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
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

  const onSlugChange = (id: string, raw: string) => {
    updateProject(id, { slug: slugify(raw) });
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
      setProjects((prev) =>
        prev.map((p) => (p.id === active.id ? { ...p, images: [...p.images, ...processed] } : p))
      );
    },
    [active]
  );

  // ── Image reorder ──
  const onTileDragEnd = () => {
    if (draggedImageId && dragOverImageId && draggedImageId !== dragOverImageId && active) {
      const images = [...active.images];
      const from = images.findIndex((f) => f.id === draggedImageId);
      const to = images.findIndex((f) => f.id === dragOverImageId);
      if (from >= 0 && to >= 0) {
        const [moved] = images.splice(from, 1);
        images.splice(to, 0, moved);
        updateProject(active.id, { images });
      }
    }
    setDraggedImageId(null);
    setDragOverImageId(null);
  };

  // ── Image selection ──
  const toggleSelect = (imageId: string) =>
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  const clearSelection = () => setSelectedImageIds(new Set());
  const deleteSelected = () => {
    if (!active) return;
    updateProject(active.id, { images: active.images.filter((f) => !selectedImageIds.has(f.id)) });
    clearSelection();
  };

  const setCover = (imageId: string) => {
    if (active) updateProject(active.id, { coverImageId: imageId });
  };
  const setAlt = (imageId: string, alt: string) => {
    if (!active) return;
    updateProject(active.id, {
      images: active.images.map((f) => (f.id === imageId ? { ...f, alt } : f)),
    });
  };

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
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [publishedOk, setPublishedOk] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

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

  const canPublish = localProjects.length > 0 && publishBlockers.length === 0;

  const performPublish = async () => {
    setPublishing(true);
    setPublishError(null);
    setTriggerError(null);
    setProgress(null);
    try {
      const { publishedIds, slugs } = await publishProjects(supabase, localProjects, setProgress);
      setProgress(null);
      setPublishing(false);

      setTriggering(true);
      const note = `${slugs.length} project${slugs.length === 1 ? '' : 's'} published`;
      const trigErr = await triggerRebuild(slugs, note);
      setTriggerError(trigErr);
      setTriggering(false);

      // Clear the published projects from the local draft and from state.
      const publishedSet = new Set(publishedIds);
      clearDraftProjects(projects, publishedSet);

      setPublishedOk(true);
      // Reload from Supabase so the just-published projects show as remote.
      let remote: StudioProject[] = [];
      try {
        remote = await loadRemoteProjects(supabase);
      } catch {
        // non-fatal
      }
      setTimeout(() => {
        setProjects((prev) => {
          const survivingDrafts = prev.filter((p) => !p.remote && !publishedSet.has(p.id));
          const draftIds = new Set(survivingDrafts.map((d) => d.id));
          return [...survivingDrafts, ...remote.filter((r) => !draftIds.has(r.id))];
        });
        setActiveId(null);
        setSelectedImageIds(new Set());
        setPublishOpen(false);
        setPublishedOk(false);
        setPublishError(null);
        setTriggerError(null);
      }, 3500);
    } catch (err) {
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
        canPublish={canPublish}
        onPublish={() => setPublishOpen(true)}
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
        onSelect={(id) => {
          setActiveId(id);
          setTab('compose');
        }}
        onSetTab={setTab}
        onCreate={createProject}
      />

      <main style={{ overflowY: 'auto', background: INK }}>
        {tab === 'reorder' ? (
          <div style={{ padding: '32px 36px' }}>
            <ReorderPanel projects={projects} onCommitOrder={commitOrder} saving={reorderSaving} />
          </div>
        ) : tab === 'settings' ? (
          <div style={{ padding: '32px 36px' }}>
            <SettingsPanel supabase={supabase} />
          </div>
        ) : tab === 'security' ? (
          <div style={{ padding: '32px 36px' }}>
            <SecurityPanel supabase={supabase} />
          </div>
        ) : (
          <ProjectWorkspace
            project={active}
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
            onUpdate={updateProject}
            onRemove={removeProject}
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
            onDeleteSelected={deleteSelected}
            onSetCover={setCover}
            onSetAlt={setAlt}
            onThumbSize={setThumbSize}
            onTileDragStart={setDraggedImageId}
            onTileDragOver={(id, e) => {
              e.preventDefault();
              setDragOverImageId(id);
            }}
            onTileDragEnd={onTileDragEnd}
          />
        )}
      </main>

      {publishOpen && (
        <PublishModal
          projects={localProjects}
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
          onConfirm={performPublish}
        />
      )}
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
  canPublish,
  onPublish,
  onSignOut,
}: {
  email: string;
  localCount: number;
  totalPhotos: number;
  canPublish: boolean;
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, fontSize: 22, letterSpacing: '-0.01em' }}>
          vflics
        </span>
        <Cap style={{ color: DIM }}>Studio</Cap>
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
          Publish →
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
  onSelect,
  onSetTab,
  onCreate,
}: {
  projects: StudioProject[];
  activeId: string | null;
  tab: Tab;
  loadError: string | null;
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
          projects.map((p) => {
            const isActive = p.id === activeId && tab === 'compose';
            const count = p.remote ? (p.remoteImageCount ?? 0) : p.images.length;
            return (
              <button
                key={p.id}
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
              </button>
            );
          })
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
  takenSlugs: Set<string>;
  selectedImageIds: Set<string>;
  thumbSize: number;
  draggedImageId: string | null;
  dragOverImageId: string | null;
  dragActive: boolean;
  restoreBanner: { count: number } | null;
  onDismissRestore: () => void;
  onTitleChange: (id: string, title: string) => void;
  onSlugChange: (id: string, slug: string) => void;
  onUpdate: (id: string, patch: Partial<StudioProject>) => void;
  onRemove: (id: string) => void;
  onIngest: (files: FileList | File[]) => void;
  onCreate: () => void;
  onDragOver: (e: ReactDragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: ReactDragEvent) => void;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onSetCover: (id: string) => void;
  onSetAlt: (id: string, alt: string) => void;
  onThumbSize: (n: number) => void;
  onTileDragStart: (id: string) => void;
  onTileDragOver: (id: string, e: ReactDragEvent) => void;
  onTileDragEnd: () => void;
}

function ProjectWorkspace(props: WorkspaceProps) {
  const { project } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
  }, [project?.id]);

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
    <div
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
            Published project · edit text, then re-publish to apply. Images load from Supabase on
            rebuild; add new originals below to append.
          </Cap>
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
              <Cap style={{ color: '#e74c3c' }}>Remove from Studio?</Cap>
              <Pill kind="danger" onClick={() => { props.onRemove(project.id); setConfirmingDelete(false); }}>
                Yes
              </Pill>
              <Pill onClick={() => setConfirmingDelete(false)}>Cancel</Pill>
            </>
          ) : (
            <Pill kind="danger" onClick={() => setConfirmingDelete(true)}>
              {project.remote ? 'Close' : 'Delete project'}
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
          <input
            type="date"
            value={project.shotDate}
            onChange={(e) => props.onUpdate(project.id, { shotDate: e.target.value })}
            style={{ ...metaInputStyle, colorScheme: 'dark' }}
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
            Click to select · drag to reorder · ☆ to set cover
          </Cap>
        )}
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

      {/* Grid */}
      {project.images.length === 0 ? (
        <EmptyDropZone onClickAdd={() => fileInputRef.current?.click()} dragActive={props.dragActive} />
      ) : (
        <div
          style={{
            marginTop: 22,
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${props.thumbSize}px, 1fr))`,
            gap: 14,
          }}
        >
          {project.images.map((image, i) => (
            <ImageTile
              key={image.id}
              image={image}
              index={i}
              selected={props.selectedImageIds.has(image.id)}
              isCover={effectiveCover === image.id}
              draggedId={props.draggedImageId}
              dragOverId={props.dragOverImageId}
              thumbSize={props.thumbSize}
              onToggleSelect={() => props.onToggleSelect(image.id)}
              onSetCover={() => props.onSetCover(image.id)}
              onAltChange={(alt) => props.onSetAlt(image.id, alt)}
              onDragStart={() => props.onTileDragStart(image.id)}
              onDragOver={(e) => props.onTileDragOver(image.id, e)}
              onDragEnd={props.onTileDragEnd}
            />
          ))}
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
    </div>
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

function PublishModal({
  projects,
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
  projects: StudioProject[];
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
              <Cap style={{ color: DIM }}>{projects.length} project{projects.length === 1 ? '' : 's'}</Cap>
            </div>
            <Rule style={{ marginTop: 12 }} />
            <Heading size={48} style={{ margin: '20px 0 8px' }}>
              Ready to publish?
            </Heading>
            <p style={{ fontStyle: 'italic', color: 'rgba(245,243,238,0.65)', fontSize: 16, lineHeight: 1.45, margin: 0 }}>
              Originals upload to Supabase Storage and the project rows are written. The site then
              rebuilds from R2 as usual.
            </p>

            {(blockers.length > 0 || publishError) && (
              <div style={{ marginTop: 22, padding: '14px 16px', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.08)' }}>
                <Cap style={{ color: '#e74c3c' }}>{publishError ? 'Publish failed' : 'Resolve before publishing'}</Cap>
                <ul style={{ margin: '10px 0 0', padding: '0 0 0 18px', color: '#e74c3c', fontFamily: 'DM Mono, monospace', fontSize: 11, lineHeight: 1.7 }}>
                  {publishError ? <li>{publishError}</li> : blockers.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              {projects.map((p) => (
                <div key={p.id} style={{ padding: '16px 0', borderTop: '1px solid rgba(245,243,238,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 24, color: CREAM }}>
                      {p.title || <span style={{ color: '#e74c3c' }}>(untitled)</span>}
                    </div>
                    <Cap style={{ color: DIM }}>/{p.slug || '—'} · {p.images.length} img</Cap>
                  </div>
                  {p.category && (
                    <div style={{ marginTop: 6, fontFamily: 'DM Mono, monospace', fontSize: 10, color: DIM, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                      {p.category}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 28, paddingTop: 18, borderTop: '1px solid rgba(245,243,238,0.08)' }}>
              <Pill onClick={onClose}>Cancel</Pill>
              <Pill kind="primary" onClick={onConfirm} disabled={blockers.length > 0}>
                Publish →
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
