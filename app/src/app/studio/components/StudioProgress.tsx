'use client';

/**
 * StudioProgress — a circular progress indicator for the Studio top bar.
 *
 * Shows the current long-running operation as a small ring with a % in the
 * middle; clicking it opens (framer-motion) a panel detailing what's happening
 * and a lifecycle stepper (Upload → Trigger → Build & deploy).
 *
 * Progress fidelity by phase:
 *   - uploading  → REAL % (project/file counts from the publish flow)
 *   - triggering → brief, near-full
 *   - building   → ESTIMATE. The variant build (GitHub Actions) + deploy
 *     (Vercel) run off-client, so this page can't read their exact progress;
 *     we ease toward ~95% over an estimated window and label it as an estimate.
 *   - loading    → indeterminate spinner (loading a project's images)
 *
 * Returns null when idle, so the ring only appears while something is running.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cap } from './ui';

const CREAM = '#f5f3ee';
const INK = '#0a0a0a';
const ACCENT = '#d4a93e';
const GREEN = '#76c893';
const DIMTEXT = 'rgba(245,243,238,0.55)';
const MONO = 'DM Mono, monospace';
const SERIF = 'Cormorant Garamond, serif';
const EASE = [0.16, 1, 0.3, 1] as const;

export type ActivityKind = 'loading' | 'uploading' | 'triggering' | 'building';

export interface StudioActivity {
  kind: ActivityKind;
  /** 0..1 progress, or null for indeterminate. Ignored for `building`. */
  progress: number | null;
  /** Headline shown in the panel. */
  label: string;
  /** Optional mono detail line. */
  detail?: string;
  /** For `building`: ms timestamp the rebuild started (drives the estimate). */
  startedAt?: number;
  /** Estimated total ms for the `building` phase (default ~4 min). */
  estimateMs?: number;
}

const SIZE = 30;
const STROKE = 3;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

const STEPS: { kind: ActivityKind; label: string }[] = [
  { kind: 'uploading', label: 'Upload' },
  { kind: 'triggering', label: 'Trigger' },
  { kind: 'building', label: 'Build · deploy' },
];

function titleFor(kind: ActivityKind): string {
  switch (kind) {
    case 'loading':
      return 'Loading';
    case 'uploading':
      return 'Uploading to Supabase';
    case 'triggering':
      return 'Triggering rebuild';
    case 'building':
      return 'Building & deploying';
  }
}

const ORDER: ActivityKind[] = ['uploading', 'triggering', 'building'];
const stepIndex = (kind: ActivityKind) => ORDER.indexOf(kind);

export function StudioProgress({ activity }: { activity: StudioActivity | null }) {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  // Re-render on a timer while the building estimate advances.
  useEffect(() => {
    if (activity?.kind !== 'building') return;
    const id = setInterval(() => setTick((t) => t + 1), 300);
    return () => clearInterval(id);
  }, [activity?.kind]);

  // Close the panel when the activity ends.
  useEffect(() => {
    if (!activity) setOpen(false);
  }, [activity]);

  if (!activity) return null;

  // Resolve the ring fraction.
  let frac = activity.progress;
  if (activity.kind === 'building' && activity.startedAt) {
    const est = activity.estimateMs ?? 4 * 60_000;
    frac = Math.min(0.95, (Date.now() - activity.startedAt) / est); // never claim 100% — we can't know
  }
  const indeterminate = frac === null;
  const pct = frac === null ? null : Math.round(frac * 100);
  const color = activity.kind === 'building' ? ACCENT : CREAM;

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${titleFor(activity.kind)}${pct !== null ? ` — ${pct}%` : ''}`}
        title={titleFor(activity.kind)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span style={{ position: 'relative', width: SIZE, height: SIZE, display: 'inline-block' }}>
          {indeterminate ? (
            <motion.svg
              width={SIZE}
              height={SIZE}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
            >
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(245,243,238,0.15)" strokeWidth={STROKE} />
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * 0.72}
              />
            </motion.svg>
          ) : (
            <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(245,243,238,0.15)" strokeWidth={STROKE} />
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - (frac ?? 0))}
                style={{ transition: 'stroke-dashoffset 0.35s ease' }}
              />
            </svg>
          )}
          {pct !== null && (
            <span
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: MONO,
                fontSize: 8,
                color: CREAM,
              }}
            >
              {pct}
            </span>
          )}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.22, ease: EASE }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              left: 0,
              zIndex: 90,
              width: 290,
              background: INK,
              border: '1px solid rgba(245,243,238,0.14)',
              boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
              padding: 16,
              transformOrigin: 'top left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Cap style={{ color: ACCENT }}>{titleFor(activity.kind)}</Cap>
              {pct !== null && <Cap style={{ color: DIMTEXT }}>{pct}%</Cap>}
            </div>
            <p style={{ margin: '8px 0 0', fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, color: CREAM, lineHeight: 1.4 }}>
              {activity.label}
            </p>
            {activity.detail && (
              <p style={{ margin: '6px 0 0', fontFamily: MONO, fontSize: 10, color: DIMTEXT, lineHeight: 1.5, letterSpacing: '0.04em' }}>
                {activity.detail}
              </p>
            )}

            {/* Lifecycle stepper */}
            {activity.kind !== 'loading' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
                {STEPS.map((s) => {
                  const active = s.kind === activity.kind;
                  const done = stepIndex(activity.kind) > stepIndex(s.kind);
                  return (
                    <div key={s.kind} style={{ flex: 1 }}>
                      <div style={{ height: 3, background: done ? GREEN : active ? ACCENT : 'rgba(245,243,238,0.14)' }} />
                      <span
                        style={{
                          display: 'block',
                          marginTop: 6,
                          fontFamily: MONO,
                          fontSize: 7.5,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: active ? CREAM : 'rgba(245,243,238,0.4)',
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {activity.kind === 'building' && (
              <p style={{ margin: '12px 0 0', fontFamily: MONO, fontSize: 9, color: 'rgba(245,243,238,0.4)', lineHeight: 1.5 }}>
                Estimated — the variant build (GitHub Actions) and deploy (Vercel) run off this page, so the exact remote progress isn’t visible. Usually 2–6 min.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
