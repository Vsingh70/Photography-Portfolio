/**
 * vflics Upload Studio — local-only staging tool for renaming, reordering,
 * and pushing sets of photos to Google Drive folders.
 *
 * Port of the upload-studio.jsx mockup with real wiring:
 *   - Destinations resolved from /api/studio/destinations (env-mapped folder IDs)
 *   - Push uploads via /api/studio/upload, one FormData per set
 *   - Custom destinations require a folder ID at creation
 *   - Original File blobs are kept in memory for re-upload; only metadata
 *     persists to localStorage (files surface as `missing` after refresh)
 */

'use client';

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  type CSSProperties,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type DragEvent as ReactDragEvent,
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Destination {
  slug: string;
  label: string;
  folderId?: string | null;
  custom?: boolean;
}

interface UploadFile {
  id: string;
  name: string;
  size: number;
  type: string;
  hash: string;
  dataURL?: string;
  blob?: File;
  duplicate?: boolean;
  missing?: boolean;
}

interface UploadSet {
  id: string;
  name: string;
  destination: string;
  files: UploadFile[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vflics-upload-studio';

const uid = () => Math.random().toString(36).slice(2, 10);

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI
// ─────────────────────────────────────────────────────────────────────────────

function Cap({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: 'DM Mono, ui-monospace, monospace',
        fontSize: 10,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function Pill({
  children,
  onClick,
  kind = 'default',
  disabled,
  type = 'button',
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}) {
  const palette =
    kind === 'primary'
      ? { bg: '#f5f3ee', fg: '#0a0a0a', border: '#f5f3ee', hoverBg: '#fff' }
      : kind === 'danger'
      ? { bg: 'transparent', fg: '#e74c3c', border: '#e74c3c', hoverBg: 'rgba(231,76,60,0.1)' }
      : {
          bg: 'transparent',
          fg: '#f5f3ee',
          border: 'rgba(245,243,238,0.25)',
          hoverBg: 'rgba(245,243,238,0.08)',
        };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        borderRadius: 999,
        fontFamily: 'DM Mono, monospace',
        fontSize: 10,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.2s, color 0.2s, border-color 0.2s',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = palette.hoverBg;
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = palette.bg;
      }}
    >
      {children}
    </button>
  );
}

function Rule({ style }: { style?: CSSProperties }) {
  return <div style={{ height: 1, background: 'rgba(245,243,238,0.08)', ...style }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

interface DraftFile {
  id: string;
  name: string;
  size: number;
  type: string;
  hash: string;
}
interface DraftSet {
  id: string;
  name: string;
  destination: string;
  files: DraftFile[];
}
interface Draft {
  sets: DraftSet[];
  destinations: Destination[];
  savedAt: number;
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

function saveDraft(sets: UploadSet[], destinations: Destination[]) {
  try {
    const data: Draft = {
      sets: sets.map((s) => ({
        id: s.id,
        name: s.name,
        destination: s.destination,
        files: s.files.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.type,
          hash: f.hash,
        })),
      })),
      destinations,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota / SecurityError — ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────

export function StudioApp() {
  const [sets, setSets] = useState<UploadSet[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [thumbSize, setThumbSize] = useState(140);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null);
  const [pushOpen, setPushOpen] = useState(false);
  const [pushedOk, setPushedOk] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [restoreBanner, setRestoreBanner] = useState<{ count: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [destEditing, setDestEditing] = useState(false);

  // Propagate ?key=… from the page URL onto every API call so the same
  // gate works in production (where the page itself is key-gated).
  const apiKeySuffix =
    typeof window !== 'undefined'
      ? (() => {
          const k = new URLSearchParams(window.location.search).get('key');
          return k ? `?key=${encodeURIComponent(k)}` : '';
        })()
      : '';

  // ── Load destinations from server + restore draft on mount ──
  useEffect(() => {
    // Fetch resolved server destinations
    fetch(`/api/studio/destinations${apiKeySuffix}`)
      .then((r) => r.json())
      .then((data: { builtIn?: Destination[] }) => {
        const server: Destination[] = (data.builtIn || []).filter((d) => d.folderId);
        setDestinations((prev) => {
          const custom = prev.filter((d) => d.custom);
          return [...server, ...custom];
        });
      })
      .catch(() => {
        // fall back to whatever was restored from localStorage
      });

    const data = loadDraft();
    if (data?.sets?.length) {
      setSets(
        data.sets.map((s) => ({
          ...s,
          files: (s.files || []).map((f) => ({ ...f, missing: true })),
        }))
      );
      if (data.destinations) {
        // merge custom destinations from draft; server's built-ins arrive separately above
        const customFromDraft = data.destinations.filter((d) => d.custom);
        setDestinations((prev) => {
          const seen = new Set(prev.map((d) => d.slug));
          return [...prev, ...customFromDraft.filter((d) => !seen.has(d.slug))];
        });
      }
      setActiveSetId(data.sets[0]?.id || null);
      const missingCount = data.sets.reduce((n, s) => n + (s.files?.length || 0), 0);
      if (missingCount > 0) setRestoreBanner({ count: missingCount });
    }
  }, []);

  // ── Save to localStorage on changes ──
  useEffect(() => {
    if (sets.length || destinations.some((d) => d.custom)) {
      saveDraft(sets, destinations);
    }
  }, [sets, destinations]);

  const activeSet = sets.find((s) => s.id === activeSetId) || null;
  const totalPhotos = sets.reduce((n, s) => n + s.files.length, 0);

  // ── Set CRUD ──
  const createSet = (name = '') => {
    const id = uid();
    const set: UploadSet = { id, name, destination: destinations[0]?.slug || '', files: [] };
    setSets((prev) => [...prev, set]);
    setActiveSetId(id);
  };

  const updateSet = (id: string, patch: Partial<UploadSet>) =>
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const removeSet = (id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
    if (activeSetId === id) {
      const remaining = sets.filter((s) => s.id !== id);
      setActiveSetId(remaining[0]?.id || null);
    }
  };

  // ── File ingestion ──
  const ingestFiles = async (fileList: FileList | File[]) => {
    if (!activeSet) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;

    const existingHashes = new Set(activeSet.files.map((f) => f.hash).filter(Boolean));
    const processed: UploadFile[] = [];

    for (const file of files) {
      try {
        const [dataURL, buffer] = await Promise.all([readAsDataURL(file), readAsArrayBuffer(file)]);
        const hash = await sha256(buffer);
        const duplicate = existingHashes.has(hash);
        existingHashes.add(hash);
        processed.push({
          id: uid(),
          name: file.name,
          size: file.size,
          type: file.type,
          hash,
          dataURL,
          blob: file,
          duplicate,
        });
      } catch {
        // skip unreadable
      }
    }

    updateSet(activeSet.id, { files: [...activeSet.files, ...processed] });
  };

  // ── File reorder ──
  const onTileDragStart = (fileId: string) => setDraggedFileId(fileId);
  const onTileDragOver = (fileId: string, e: ReactDragEvent) => {
    e.preventDefault();
    setDragOverFileId(fileId);
  };
  const onTileDragEnd = () => {
    if (draggedFileId && dragOverFileId && draggedFileId !== dragOverFileId && activeSet) {
      const files = [...activeSet.files];
      const fromIdx = files.findIndex((f) => f.id === draggedFileId);
      const toIdx = files.findIndex((f) => f.id === dragOverFileId);
      if (fromIdx >= 0 && toIdx >= 0) {
        const [moved] = files.splice(fromIdx, 1);
        files.splice(toIdx, 0, moved);
        updateSet(activeSet.id, { files });
      }
    }
    setDraggedFileId(null);
    setDragOverFileId(null);
  };

  // ── File selection ──
  const toggleSelect = (fileId: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };
  const clearSelection = () => setSelectedFileIds(new Set());
  const deleteSelected = () => {
    if (!activeSet) return;
    updateSet(activeSet.id, {
      files: activeSet.files.filter((f) => !selectedFileIds.has(f.id)),
    });
    clearSelection();
  };

  // ── Destination management ──
  const addDestination = (label: string, folderId: string): Destination | null => {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug || !folderId.trim() || destinations.find((d) => d.slug === slug)) return null;
    const dest: Destination = { slug, label, folderId: folderId.trim(), custom: true };
    setDestinations((prev) => [...prev, dest]);
    return dest;
  };

  const removeDestination = (slug: string) => {
    setDestinations((prev) => prev.filter((d) => d.slug !== slug));
    setSets((prev) =>
      prev.map((s) => (s.destination === slug ? { ...s, destination: '' } : s))
    );
  };

  // ── Push (real) ──
  const canPush =
    sets.length > 0 &&
    sets.every(
      (s) =>
        s.name.trim() &&
        s.destination &&
        s.files.length > 0 &&
        !s.files.some((f) => f.missing)
    );

  const pushBlockers = useMemo(() => {
    const issues: string[] = [];
    sets.forEach((s) => {
      if (!s.name.trim()) issues.push(`Set "${s.name || '(unnamed)'}" needs a name`);
      if (!s.destination) issues.push(`"${s.name}" needs a destination`);
      if (!s.files.length) issues.push(`"${s.name}" has no photos`);
      if (s.files.some((f) => f.missing)) issues.push(`"${s.name}" has photos to re-attach`);
      if (s.files.some((f) => f.duplicate)) issues.push(`"${s.name}" contains duplicates`);
    });
    return issues;
  }, [sets]);

  const performPush = async () => {
    setPushing(true);
    setPushError(null);
    try {
      for (const set of sets) {
        const dest = destinations.find((d) => d.slug === set.destination);
        if (!dest?.folderId) {
          throw new Error(`No folder ID for "${set.name}" → ${set.destination}`);
        }
        const form = new FormData();
        form.append('setName', set.name);
        form.append('folderId', dest.folderId);
        for (const f of set.files) {
          if (!f.blob) {
            throw new Error(`"${set.name}" has photos to re-attach`);
          }
          form.append('files', f.blob, f.name);
        }
        const res = await fetch(`/api/studio/upload${apiKeySuffix}`, { method: 'POST', body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Upload of "${set.name}" failed`);
        }
      }
      setPushedOk(true);
      setTimeout(() => {
        setSets([]);
        setActiveSetId(null);
        setSelectedFileIds(new Set());
        setPushOpen(false);
        setPushedOk(false);
        setPushing(false);
        localStorage.removeItem(STORAGE_KEY);
      }, 2200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setPushError(message);
      setPushing(false);
    }
  };

  // ── Render ──
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gridTemplateRows: '54px 1fr',
        height: '100vh',
        background: '#0a0a0a',
        color: '#f5f3ee',
        fontFamily: 'Cormorant Garamond, serif',
        overflow: 'hidden',
      }}
    >
      <TopBar
        sets={sets}
        totalPhotos={totalPhotos}
        canPush={canPush}
        onPush={() => setPushOpen(true)}
      />

      <Sidebar
        sets={sets}
        destinations={destinations}
        activeSetId={activeSetId}
        onSelect={setActiveSetId}
        onCreate={() => createSet('')}
      />

      <Workspace
        activeSet={activeSet}
        destinations={destinations}
        selectedFileIds={selectedFileIds}
        thumbSize={thumbSize}
        draggedFileId={draggedFileId}
        dragOverFileId={dragOverFileId}
        dragActive={dragActive}
        restoreBanner={restoreBanner}
        destEditing={destEditing}
        onDismissRestore={() => setRestoreBanner(null)}
        onUpdate={updateSet}
        onRemove={removeSet}
        onIngest={ingestFiles}
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
          if (e.dataTransfer?.files?.length) ingestFiles(e.dataTransfer.files);
        }}
        onToggleSelect={toggleSelect}
        onClearSelection={clearSelection}
        onDeleteSelected={deleteSelected}
        onThumbSize={setThumbSize}
        onTileDragStart={onTileDragStart}
        onTileDragOver={onTileDragOver}
        onTileDragEnd={onTileDragEnd}
        onAddDestination={addDestination}
        onRemoveDestination={removeDestination}
        onToggleDestEditing={() => setDestEditing((v) => !v)}
        onCreateSet={createSet}
      />

      {pushOpen && (
        <PushModal
          sets={sets}
          destinations={destinations}
          blockers={pushBlockers}
          pushing={pushing}
          pushedOk={pushedOk}
          pushError={pushError}
          onClose={() => {
            if (!pushing) {
              setPushOpen(false);
              setPushError(null);
            }
          }}
          onConfirm={performPush}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TopBar
// ─────────────────────────────────────────────────────────────────────────────

function TopBar({
  sets,
  totalPhotos,
  canPush,
  onPush,
}: {
  sets: UploadSet[];
  totalPhotos: number;
  canPush: boolean;
  onPush: () => void;
}) {
  return (
    <div
      style={{
        gridColumn: '1 / 3',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid rgba(245,243,238,0.08)',
        background: '#0a0a0a',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <span
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: 22,
            letterSpacing: '-0.01em',
          }}
        >
          vflics
        </span>
        <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>Upload Studio · local</Cap>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>
          {sets.length} set{sets.length === 1 ? '' : 's'} · {totalPhotos} photos
        </Cap>
        <Pill kind="primary" onClick={onPush} disabled={!canPush || totalPhotos === 0}>
          Push to Drive →
        </Pill>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────

function Sidebar({
  sets,
  destinations,
  activeSetId,
  onSelect,
  onCreate,
}: {
  sets: UploadSet[];
  destinations: Destination[];
  activeSetId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <aside
      style={{
        borderRight: '1px solid rgba(245,243,238,0.08)',
        padding: '20px 0',
        overflowY: 'auto',
        background: '#0a0a0a',
      }}
    >
      <div style={{ padding: '0 18px 12px' }}>
        <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>Sets</Cap>
      </div>
      <Rule />
      <div style={{ padding: '8px 0' }}>
        {sets.length === 0 ? (
          <div
            style={{
              padding: '24px 18px',
              color: 'rgba(245,243,238,0.5)',
              fontStyle: 'italic',
              fontSize: 14,
            }}
          >
            No sets yet. Create one to get started.
          </div>
        ) : (
          sets.map((set) => {
            const dest = destinations.find((d) => d.slug === set.destination);
            const isActive = set.id === activeSetId;
            return (
              <button
                key={set.id}
                onClick={() => onSelect(set.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 18px',
                  background: isActive ? 'rgba(245,243,238,0.05)' : 'transparent',
                  borderLeft: isActive ? '2px solid #f5f3ee' : '2px solid transparent',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: '1px solid rgba(245,243,238,0.06)',
                  color: '#f5f3ee',
                  cursor: 'pointer',
                  display: 'block',
                  transition: 'background 0.2s',
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
                    fontFamily: 'Cormorant Garamond, serif',
                    fontStyle: 'italic',
                    fontWeight: 300,
                    fontSize: 19,
                    lineHeight: 1.15,
                    color: set.name ? '#f5f3ee' : 'rgba(245,243,238,0.4)',
                  }}
                >
                  {set.name || 'Untitled set'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>
                    {dest ? dest.label : '— unassigned —'}
                  </Cap>
                  <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>{set.files.length} pl.</Cap>
                </div>
              </button>
            );
          })
        )}
      </div>
      <div style={{ padding: '14px 18px' }}>
        <Pill onClick={onCreate} style={{ width: '100%', justifyContent: 'center' }}>
          + New set
        </Pill>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceProps {
  activeSet: UploadSet | null;
  destinations: Destination[];
  selectedFileIds: Set<string>;
  thumbSize: number;
  draggedFileId: string | null;
  dragOverFileId: string | null;
  dragActive: boolean;
  restoreBanner: { count: number } | null;
  destEditing: boolean;
  onDismissRestore: () => void;
  onUpdate: (id: string, patch: Partial<UploadSet>) => void;
  onRemove: (id: string) => void;
  onIngest: (files: FileList | File[]) => void;
  onDragOver: (e: ReactDragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: ReactDragEvent) => void;
  onToggleSelect: (fileId: string) => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onThumbSize: (n: number) => void;
  onTileDragStart: (fileId: string) => void;
  onTileDragOver: (fileId: string, e: ReactDragEvent) => void;
  onTileDragEnd: () => void;
  onAddDestination: (label: string, folderId: string) => Destination | null;
  onRemoveDestination: (slug: string) => void;
  onToggleDestEditing: () => void;
  onCreateSet: (name?: string) => void;
}

function Workspace({
  activeSet,
  destinations,
  selectedFileIds,
  thumbSize,
  draggedFileId,
  dragOverFileId,
  dragActive,
  restoreBanner,
  destEditing,
  onDismissRestore,
  onUpdate,
  onRemove,
  onIngest,
  onDragOver,
  onDragLeave,
  onDrop,
  onToggleSelect,
  onClearSelection,
  onDeleteSelected,
  onThumbSize,
  onTileDragStart,
  onTileDragOver,
  onTileDragEnd,
  onAddDestination,
  onRemoveDestination,
  onToggleDestEditing,
  onCreateSet,
}: WorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!activeSet) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
          textAlign: 'center',
        }}
      >
        <Cap style={{ color: 'rgba(245,243,238,0.55)', marginBottom: 16 }}>Start here</Cap>
        <h2
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: 56,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Create a set.
        </h2>
        <p
          style={{
            fontStyle: 'italic',
            fontSize: 17,
            color: 'rgba(245,243,238,0.65)',
            maxWidth: 440,
            lineHeight: 1.5,
            marginTop: 14,
          }}
        >
          A set is a group of photos with one destination — like &ldquo;VDR Party&rdquo;
          headed for Editorial. Add as many sets as you want before pushing.
        </p>
        <div style={{ marginTop: 28 }}>
          <Pill kind="primary" onClick={() => onCreateSet('')}>
            + New set
          </Pill>
        </div>
      </div>
    );
  }

  const selected = activeSet.files.filter((f) => selectedFileIds.has(f.id));
  const duplicates = activeSet.files.filter((f) => f.duplicate);
  const missing = activeSet.files.filter((f) => f.missing);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        position: 'relative',
        overflowY: 'auto',
        padding: '24px 28px',
        background: '#0a0a0a',
      }}
    >
      {restoreBanner && (
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
            Draft restored · {restoreBanner.count} photo references — re-add the originals to
            re-attach.
          </Cap>
          <button
            onClick={onDismissRestore}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#d4a93e',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 280 }}>
          <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>Set name</Cap>
          <input
            value={activeSet.name}
            onChange={(e) => onUpdate(activeSet.id, { name: e.target.value })}
            placeholder="e.g. VDR Party"
            style={{
              display: 'block',
              width: '100%',
              maxWidth: 540,
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid rgba(245,243,238,0.18)',
              padding: '8px 0 10px',
              fontFamily: 'Cormorant Garamond, serif',
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: 38,
              color: '#f5f3ee',
              outline: 'none',
              letterSpacing: '-0.015em',
            }}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#f5f3ee')}
            onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(245,243,238,0.18)')}
          />
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>Destination</Cap>
            <DestinationPicker
              destinations={destinations}
              value={activeSet.destination}
              editing={destEditing}
              onChange={(slug) => onUpdate(activeSet.id, { destination: slug })}
              onAdd={onAddDestination}
              onRemove={onRemoveDestination}
              onToggleEditing={onToggleDestEditing}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Pill
            kind="danger"
            onClick={() => {
              if (
                window.confirm(`Delete set "${activeSet.name || 'Untitled'}"?`)
              ) {
                onRemove(activeSet.id);
              }
            }}
          >
            Delete set
          </Pill>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 28, marginTop: 18, flexWrap: 'wrap' }}>
        <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>
          {activeSet.files.length} photo{activeSet.files.length === 1 ? '' : 's'}
        </Cap>
        {duplicates.length > 0 && (
          <Cap style={{ color: '#e74c3c' }}>
            {duplicates.length} duplicate{duplicates.length === 1 ? '' : 's'}
          </Cap>
        )}
        {missing.length > 0 && <Cap style={{ color: '#d4a93e' }}>{missing.length} need re-attach</Cap>}
        {activeSet.name && (
          <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>
            Renamed as: {activeSet.name} (1) → {activeSet.name} ({activeSet.files.length || 'n'})
          </Cap>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '16px 0',
          marginTop: 18,
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
            if (e.target.files) onIngest(e.target.files);
            e.target.value = '';
          }}
        />

        {selected.length > 0 ? (
          <>
            <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>{selected.length} selected</Cap>
            <Pill kind="danger" onClick={onDeleteSelected}>
              Delete selected
            </Pill>
            <Pill onClick={onClearSelection}>Clear</Pill>
          </>
        ) : (
          <Cap style={{ color: 'rgba(245,243,238,0.45)' }}>
            Click thumbnails to select · drag to reorder
          </Cap>
        )}

        <div style={{ flex: 1 }} />

        <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>Thumb size</Cap>
        <input
          type="range"
          min={80}
          max={240}
          value={thumbSize}
          onChange={(e) => onThumbSize(Number(e.target.value))}
          style={{ accentColor: '#f5f3ee', width: 140 }}
        />
      </div>

      {activeSet.files.length === 0 ? (
        <EmptyDropZone onClickAdd={() => fileInputRef.current?.click()} dragActive={dragActive} />
      ) : (
        <div
          style={{
            marginTop: 22,
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`,
            gap: 14,
          }}
        >
          {activeSet.files.map((file, i) => (
            <Thumb
              key={file.id}
              file={file}
              index={i}
              setName={activeSet.name}
              selected={selectedFileIds.has(file.id)}
              draggedId={draggedFileId}
              dragOverId={dragOverFileId}
              thumbSize={thumbSize}
              onToggleSelect={() => onToggleSelect(file.id)}
              onDragStart={() => onTileDragStart(file.id)}
              onDragOver={(e) => onTileDragOver(file.id, e)}
              onDragEnd={onTileDragEnd}
            />
          ))}
        </div>
      )}

      {dragActive && (
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
          <div
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontStyle: 'italic',
              fontSize: 44,
              fontWeight: 300,
              color: '#f5f3ee',
              textAlign: 'center',
            }}
          >
            Drop to add photos
            <br />
            <Cap style={{ display: 'inline-block', marginTop: 12, color: 'rgba(245,243,238,0.65)' }}>
              to {activeSet.name || 'this set'}
            </Cap>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Destination picker
// ─────────────────────────────────────────────────────────────────────────────

function DestinationPicker({
  destinations,
  value,
  editing,
  onChange,
  onAdd,
  onRemove,
  onToggleEditing,
}: {
  destinations: Destination[];
  value: string;
  editing: boolean;
  onChange: (slug: string) => void;
  onAdd: (label: string, folderId: string) => Destination | null;
  onRemove: (slug: string) => void;
  onToggleEditing: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftFolderId, setDraftFolderId] = useState('');

  const commit = () => {
    if (!draftLabel.trim() || !draftFolderId.trim()) return;
    const d = onAdd(draftLabel.trim(), draftFolderId.trim());
    if (d) onChange(d.slug);
    setDraftLabel('');
    setDraftFolderId('');
    setAdding(false);
  };

  const cancel = () => {
    setDraftLabel('');
    setDraftFolderId('');
    setAdding(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {destinations.map((d) => {
        const isActive = value === d.slug;
        return (
          <button
            key={d.slug}
            onClick={() => onChange(d.slug)}
            style={{
              padding: '6px 14px',
              border: `1px solid ${isActive ? '#f5f3ee' : 'rgba(245,243,238,0.18)'}`,
              background: isActive ? '#f5f3ee' : 'transparent',
              color: isActive ? '#0a0a0a' : 'rgba(245,243,238,0.85)',
              borderRadius: 999,
              fontFamily: 'DM Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            {d.label}
            {editing && d.custom && (
              <span
                onClick={(e: ReactMouseEvent) => {
                  e.stopPropagation();
                  onRemove(d.slug);
                }}
                style={{ marginLeft: 8, color: '#e74c3c', cursor: 'pointer' }}
              >
                ×
              </span>
            )}
          </button>
        );
      })}

      {adding ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            border: '1px solid #f5f3ee',
            borderRadius: 999,
          }}
        >
          <input
            autoFocus
            value={draftLabel}
            placeholder="Label…"
            onChange={(e) => setDraftLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f5f3ee',
              fontFamily: 'DM Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              width: 90,
            }}
          />
          <span style={{ color: 'rgba(245,243,238,0.4)' }}>·</span>
          <input
            value={draftFolderId}
            placeholder="Folder ID…"
            onChange={(e) => setDraftFolderId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              else if (e.key === 'Escape') cancel();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f5f3ee',
              fontFamily: 'DM Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'none',
              width: 150,
            }}
          />
          <button
            onClick={commit}
            disabled={!draftLabel.trim() || !draftFolderId.trim()}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f5f3ee',
              cursor:
                !draftLabel.trim() || !draftFolderId.trim() ? 'not-allowed' : 'pointer',
              opacity: !draftLabel.trim() || !draftFolderId.trim() ? 0.4 : 1,
              fontFamily: 'DM Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              padding: 0,
            }}
          >
            Add
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: '6px 12px',
            border: '1px dashed rgba(245,243,238,0.35)',
            background: 'transparent',
            color: 'rgba(245,243,238,0.65)',
            borderRadius: 999,
            fontFamily: 'DM Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          + New
        </button>
      )}

      {destinations.some((d) => d.custom) && (
        <button
          onClick={onToggleEditing}
          style={{
            background: 'transparent',
            border: 'none',
            color: editing ? '#f5f3ee' : 'rgba(245,243,238,0.45)',
            cursor: 'pointer',
            fontFamily: 'DM Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            padding: '6px 8px',
          }}
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty drop zone
// ─────────────────────────────────────────────────────────────────────────────

function EmptyDropZone({
  onClickAdd,
  dragActive,
}: {
  onClickAdd: () => void;
  dragActive: boolean;
}) {
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
      <div
        style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontStyle: 'italic',
          fontSize: 36,
          fontWeight: 300,
          color: '#f5f3ee',
          letterSpacing: '-0.01em',
        }}
      >
        Drop photos here
      </div>
      <Cap style={{ color: 'rgba(245,243,238,0.55)', display: 'inline-block', marginTop: 12 }}>
        or click to browse
      </Cap>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Thumb
// ─────────────────────────────────────────────────────────────────────────────

function Thumb({
  file,
  index,
  setName,
  selected,
  draggedId,
  dragOverId,
  thumbSize,
  onToggleSelect,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  file: UploadFile;
  index: number;
  setName: string;
  selected: boolean;
  draggedId: string | null;
  dragOverId: string | null;
  thumbSize: number;
  onToggleSelect: () => void;
  onDragStart: () => void;
  onDragOver: (e: ReactDragEvent) => void;
  onDragEnd: () => void;
}) {
  const isDragged = draggedId === file.id;
  const isDragOver = dragOverId === file.id && draggedId !== file.id;
  const ratioHeight = thumbSize * 1.25;
  const renderedName = setName ? `${setName} (${index + 1})` : `(${index + 1})`;

  return (
    <div
      draggable={!file.missing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onClick={onToggleSelect}
      style={{
        position: 'relative',
        cursor: file.missing ? 'not-allowed' : 'grab',
        opacity: isDragged ? 0.4 : 1,
        outline: selected
          ? '2px solid #f5f3ee'
          : isDragOver
          ? '2px dashed #f5f3ee'
          : '1px solid rgba(245,243,238,0.08)',
        outlineOffset: 0,
        background: '#1a1a1a',
        userSelect: 'none',
        transition: 'opacity 0.15s',
      }}
    >
      <div
        style={{
          width: '100%',
          height: ratioHeight,
          background: file.dataURL
            ? `url("${file.dataURL}") center/cover no-repeat #1a1a1a`
            : '#1a1a1a',
          position: 'relative',
        }}
      >
        {file.missing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 10,
              textAlign: 'center',
            }}
          >
            <Cap style={{ color: '#d4a93e' }}>Re-attach</Cap>
          </div>
        )}
        {file.duplicate && !file.missing && (
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
      </div>
      <div
        style={{
          padding: '8px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 6,
        }}
      >
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
          {renderedName}
        </span>
        <Cap style={{ color: 'rgba(245,243,238,0.4)', fontSize: 8 }}>
          {file.size ? formatBytes(file.size) : ''}
        </Cap>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Push modal
// ─────────────────────────────────────────────────────────────────────────────

function PushModal({
  sets,
  destinations,
  blockers,
  pushing,
  pushedOk,
  pushError,
  onClose,
  onConfirm,
}: {
  sets: UploadSet[];
  destinations: Destination[];
  blockers: string[];
  pushing: boolean;
  pushedOk: boolean;
  pushError: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
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
        if (e.target === e.currentTarget && !pushing) onClose();
      }}
    >
      <div
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(245,243,238,0.12)',
          maxWidth: 760,
          width: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: 32,
        }}
      >
        {pushedOk ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Cap style={{ color: '#76c893' }}>Pushed</Cap>
            <h2
              style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontStyle: 'italic',
                fontWeight: 300,
                fontSize: 56,
                margin: '14px 0 16px',
                letterSpacing: '-0.02em',
                color: '#f5f3ee',
              }}
            >
              All sets are on their way.
            </h2>
            <p
              style={{
                fontStyle: 'italic',
                color: 'rgba(245,243,238,0.65)',
                fontSize: 18,
                lineHeight: 1.5,
              }}
            >
              The studio will reset in a moment.
            </p>
          </div>
        ) : pushing ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>Uploading…</Cap>
            <div
              style={{
                width: 80,
                height: 2,
                background: 'rgba(245,243,238,0.18)',
                margin: '24px auto',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#f5f3ee',
                  transform: 'translateX(-100%)',
                  animation: 'pushBar 1.2s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>Confirm push</Cap>
              <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>
                {sets.length} set{sets.length === 1 ? '' : 's'}
              </Cap>
            </div>
            <Rule style={{ marginTop: 12 }} />
            <h2
              style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontStyle: 'italic',
                fontWeight: 300,
                fontSize: 48,
                margin: '20px 0 8px',
                letterSpacing: '-0.02em',
                color: '#f5f3ee',
              }}
            >
              Ready to push?
            </h2>
            <p
              style={{
                fontStyle: 'italic',
                color: 'rgba(245,243,238,0.65)',
                fontSize: 16,
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              Each set&apos;s photos will be renamed and uploaded to its destination&apos;s
              Drive folder.
            </p>

            {(blockers.length > 0 || pushError) && (
              <div
                style={{
                  marginTop: 22,
                  padding: '14px 16px',
                  border: '1px solid rgba(231,76,60,0.4)',
                  background: 'rgba(231,76,60,0.08)',
                }}
              >
                <Cap style={{ color: '#e74c3c' }}>
                  {pushError ? 'Upload failed' : 'Resolve before pushing'}
                </Cap>
                <ul
                  style={{
                    margin: '10px 0 0',
                    padding: '0 0 0 18px',
                    color: '#e74c3c',
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 11,
                    lineHeight: 1.7,
                  }}
                >
                  {pushError ? (
                    <li>{pushError}</li>
                  ) : (
                    blockers.map((b, i) => <li key={i}>{b}</li>)
                  )}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              {sets.map((s) => {
                const dest = destinations.find((d) => d.slug === s.destination);
                return (
                  <div
                    key={s.id}
                    style={{ padding: '16px 0', borderTop: '1px solid rgba(245,243,238,0.08)' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'Cormorant Garamond, serif',
                          fontStyle: 'italic',
                          fontSize: 24,
                          color: '#f5f3ee',
                        }}
                      >
                        {s.name || <span style={{ color: '#e74c3c' }}>(unnamed)</span>}
                      </div>
                      <Cap style={{ color: 'rgba(245,243,238,0.55)' }}>
                        → {dest ? dest.label : 'unassigned'} · {s.files.length} pl.
                      </Cap>
                    </div>
                    {s.files.length > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          fontFamily: 'DM Mono, monospace',
                          fontSize: 10,
                          color: 'rgba(245,243,238,0.55)',
                          letterSpacing: '0.18em',
                        }}
                      >
                        {s.name || '(name)'} (1) … {s.name || '(name)'} ({s.files.length})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 28,
                paddingTop: 18,
                borderTop: '1px solid rgba(245,243,238,0.08)',
              }}
            >
              <Pill onClick={onClose}>Cancel</Pill>
              <Pill kind="primary" onClick={onConfirm} disabled={blockers.length > 0}>
                Push to Drive →
              </Pill>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
