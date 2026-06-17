'use client';

/**
 * Project reordering (req 5): a draggable list of all known projects (remote +
 * local drafts). Dragging commits a new ordering; on Save it persists
 * projects.sort_order for the remote ones. Local drafts keep their order in
 * memory (their sort_order is applied on publish).
 */

import { useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { StudioProject } from '@/lib/studio/types';
import { Cap, Pill, Heading, DIM } from './ui';

export function ReorderPanel({
  projects,
  onCommitOrder,
  saving,
}: {
  projects: StudioProject[];
  onCommitOrder: (orderedIds: string[]) => void;
  saving: boolean;
}) {
  const [order, setOrder] = useState<StudioProject[]>(projects);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Resync when the upstream project set changes identity (length/ids).
  const upstreamKey = projects.map((p) => p.id).join('|');
  const localKey = order.map((p) => p.id).join('|');
  if (!dirty && upstreamKey !== localKey) {
    setOrder(projects);
  }

  const onDrop = () => {
    if (draggedId && overId && draggedId !== overId) {
      const next = [...order];
      const from = next.findIndex((p) => p.id === draggedId);
      const to = next.findIndex((p) => p.id === overId);
      if (from >= 0 && to >= 0) {
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setOrder(next);
        setDirty(true);
      }
    }
    setDraggedId(null);
    setOverId(null);
  };

  return (
    <div style={{ maxWidth: 620 }}>
      <Cap style={{ color: DIM }}>Gallery order</Cap>
      <Heading size={40} style={{ marginTop: 10 }}>
        Reorder projects.
      </Heading>
      <p style={{ fontStyle: 'italic', color: DIM, fontSize: 15, marginTop: 10 }}>
        Drag to set how projects appear in the gallery index. Save writes the order to Supabase.
      </p>

      <div style={{ marginTop: 24 }}>
        {order.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: DIM }}>No projects yet.</p>
        ) : (
          order.map((p, i) => {
            const isDragged = draggedId === p.id;
            const isOver = overId === p.id && draggedId !== p.id;
            return (
              <div
                key={p.id}
                draggable
                onDragStart={() => setDraggedId(p.id)}
                onDragOver={(e: ReactDragEvent) => {
                  e.preventDefault();
                  setOverId(p.id);
                }}
                onDragEnd={onDrop}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 14,
                  padding: '14px 16px',
                  cursor: 'grab',
                  opacity: isDragged ? 0.4 : 1,
                  borderTop: isOver ? '2px solid #f5f3ee' : '1px solid rgba(245,243,238,0.08)',
                  userSelect: 'none',
                }}
              >
                <Cap style={{ color: 'rgba(245,243,238,0.4)', width: 28 }}>
                  {String(i + 1).padStart(2, '0')}
                </Cap>
                <span
                  style={{
                    fontFamily: 'Cormorant Garamond, serif',
                    fontStyle: 'italic',
                    fontSize: 22,
                    color: '#f5f3ee',
                    flex: 1,
                  }}
                >
                  {p.title || 'Untitled project'}
                </span>
                {!p.remote && <Cap style={{ color: '#d4a93e' }}>draft</Cap>}
                <Cap style={{ color: DIM }}>{p.category || '—'}</Cap>
              </div>
            );
          })
        )}
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
        <Pill
          kind="primary"
          disabled={!dirty || saving}
          onClick={() => {
            onCommitOrder(order.map((p) => p.id));
            setDirty(false);
          }}
        >
          {saving ? 'Saving…' : 'Save order'}
        </Pill>
        {dirty && (
          <Pill
            onClick={() => {
              setOrder(projects);
              setDirty(false);
            }}
          >
            Reset
          </Pill>
        )}
      </div>
    </div>
  );
}
