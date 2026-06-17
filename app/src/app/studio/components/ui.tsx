'use client';

/**
 * Shared editorial UI primitives for the Studio: the DM-Mono tracked-uppercase
 * `Cap` label, the rounded `Pill` button, and the hairline `Rule`. Visual style
 * preserved verbatim from the original StudioApp (cream #f5f3ee on near-black).
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export const INK = '#0a0a0a';
export const CREAM = '#f5f3ee';
export const DIM = 'rgba(245,243,238,0.55)';

const SERIF = 'Cormorant Garamond, serif';
const MENU_EASE = [0.16, 1, 0.3, 1] as const;

export function Cap({ children, style }: { children: ReactNode; style?: CSSProperties }) {
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

export function Pill({
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

export function Rule({ style }: { style?: CSSProperties }) {
  return <div style={{ height: 1, background: 'rgba(245,243,238,0.08)', ...style }} />;
}

/**
 * Editorial combobox: a free-text input with an animated dropdown of saved
 * options. Type a new value (committed on blur / Enter) or pick an existing one.
 * The menu opens/closes with a framer-motion opacity/scale/y transition and is
 * keyboard-navigable (ArrowUp/Down + Enter + Escape); closes on outside-click.
 * Reduced motion → instant. Theme: cream-on-near-black, matching the Studio.
 *
 * `value` is the committed string; `onCommit` fires when the user picks an
 * option, presses Enter, or blurs to a changed value (so a brand-new typed
 * value can be autosaved as gear by the caller).
 */
export function Combobox({
  value,
  options,
  placeholder,
  onCommit,
  reducedMotion: reducedMotionProp,
  style,
}: {
  value: string;
  options: string[];
  placeholder?: string;
  onCommit: (next: string) => void;
  reducedMotion?: boolean;
  style?: CSSProperties;
}) {
  const sysReduced = useReducedMotion() ?? false;
  const reduced = reducedMotionProp ?? sysReduced;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  // Index of the keyboard-highlighted option in the *filtered* list, -1 = none.
  const [activeIdx, setActiveIdx] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set the moment an option is picked so the ensuing blur doesn't re-commit the
  // stale typed draft over the chosen value.
  const justChoseRef = useRef(false);
  const listId = useId();

  // Keep the visible draft synced when the committed value changes externally
  // (e.g. "apply to all", EXIF pre-fill) and the field isn't being edited.
  useEffect(() => {
    if (!open) setDraft(value);
  }, [value, open]);

  // Filter options by the current draft (case-insensitive substring); when the
  // draft exactly equals the committed value show the full list (just opened).
  const q = draft.trim().toLowerCase();
  const filtered =
    q && q !== value.trim().toLowerCase()
      ? options.filter((o) => o.toLowerCase().includes(q))
      : options;

  // Outside-click closes the menu (the input's onBlur commits the draft).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const commit = (next: string) => {
    const trimmed = next.trim();
    if (trimmed !== value.trim()) onCommit(trimmed);
  };

  const choose = (option: string) => {
    justChoseRef.current = true;
    setDraft(option);
    commit(option);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIdx((i) => (filtered.length ? (i + 1) % filtered.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (filtered.length ? (i <= 0 ? filtered.length - 1 : i - 1) : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && activeIdx >= 0 && filtered[activeIdx]) choose(filtered[activeIdx]);
      else {
        commit(draft);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(value);
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', ...style }}>
      <input
        ref={inputRef}
        value={draft}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        onChange={(e) => {
          setDraft(e.target.value);
          setActiveIdx(-1);
          if (!open) setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.currentTarget.style.borderBottomColor = CREAM;
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          e.currentTarget.style.borderBottomColor = 'rgba(245,243,238,0.18)';
          // An option pick already committed (via choose); don't re-commit the
          // stale draft over it. Otherwise commit on blur (tab-out etc.) — a
          // no-op if unchanged.
          if (justChoseRef.current) {
            justChoseRef.current = false;
            return;
          }
          commit(draft);
        }}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid rgba(245,243,238,0.18)',
          padding: '5px 0 7px',
          fontFamily: SERIF,
          fontSize: 16,
          color: CREAM,
          outline: 'none',
        }}
      />
      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: reduced ? 0 : 0.16, ease: MENU_EASE }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 70,
              margin: 0,
              padding: '4px 0',
              listStyle: 'none',
              maxHeight: 200,
              overflowY: 'auto',
              background: '#0a0a0a',
              border: '1px solid rgba(245,243,238,0.18)',
              boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
              transformOrigin: 'top',
            }}
          >
            {filtered.map((option, i) => {
              const isActive = i === activeIdx;
              const isCurrent = option === value;
              return (
                <li
                  key={option}
                  role="option"
                  aria-selected={isCurrent}
                  // Use mousedown (fires before input blur) so the pick lands.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(option);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    padding: '7px 12px',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(245,243,238,0.1)' : 'transparent',
                    fontFamily: SERIF,
                    fontSize: 15,
                    color: isCurrent ? '#d4a93e' : CREAM,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span>{option}</span>
                  {isCurrent && <span style={{ fontSize: 12 }}>✓</span>}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Editorial select: a pick-from-options dropdown built the same way as the
 * Combobox (`AnimatePresence` open/close on the MENU_EASE curve, reduced-motion
 * safe, keyboard-navigable, closes on outside-click) but without free-text entry
 * — the trigger shows the chosen label and the menu offers a fixed option list.
 *
 * Used for the constrained exposure fields (aperture / shutter / ISO, and a
 * zoom's focal length) in the structured Settings editor, where the allowed
 * values are physically bounded by the lens. An optional leading blank option
 * ("—" → '') lets the user clear the field. Theme: cream-on-near-black.
 */
export function Select({
  value,
  options,
  placeholder = '—',
  emptyLabel = '—',
  onChange,
  reducedMotion: reducedMotionProp,
  disabled,
  style,
}: {
  /** Committed value (must equal one of `options` to show as chosen, else placeholder). */
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  /** Label for the leading clear/blank option (set to null to omit it). */
  emptyLabel?: string | null;
  onChange: (next: string) => void;
  reducedMotion?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const sysReduced = useReducedMotion() ?? false;
  const reduced = reducedMotionProp ?? sysReduced;
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // The full option list, with an optional leading blank/clear entry.
  const full: { value: string; label: string }[] =
    emptyLabel === null ? options : [{ value: '', label: emptyLabel }, ...options];

  const current = options.find((o) => o.value === value);
  const triggerLabel = current ? current.label : placeholder;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (next: string) => {
    if (next !== value) onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIdx((i) => (full.length ? (i + 1) % full.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIdx((i) => (full.length ? (i <= 0 ? full.length - 1 : i - 1) : -1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open && activeIdx >= 0 && full[activeIdx]) choose(full[activeIdx].value);
      else setOpen((v) => !v);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', ...style }}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${open ? CREAM : 'rgba(245,243,238,0.18)'}`,
          padding: '5px 0 7px',
          fontFamily: SERIF,
          fontSize: 16,
          color: current ? CREAM : DIM,
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {triggerLabel}
        </span>
        <span style={{ fontSize: 10, color: DIM, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>
          ▾
        </span>
      </button>
      <AnimatePresence>
        {open && full.length > 0 && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: reduced ? 0 : 0.16, ease: MENU_EASE }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 70,
              margin: 0,
              padding: '4px 0',
              listStyle: 'none',
              maxHeight: 220,
              overflowY: 'auto',
              background: '#0a0a0a',
              border: '1px solid rgba(245,243,238,0.18)',
              boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
              transformOrigin: 'top',
            }}
          >
            {full.map((option, i) => {
              const isActive = i === activeIdx;
              const isCurrent = option.value === value;
              return (
                <li
                  key={option.value || '__empty__'}
                  role="option"
                  aria-selected={isCurrent}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(option.value);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    padding: '7px 12px',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(245,243,238,0.1)' : 'transparent',
                    fontFamily: SERIF,
                    fontSize: 15,
                    color: isCurrent ? '#d4a93e' : CREAM,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span>{option.label}</span>
                  {isCurrent && <span style={{ fontSize: 12 }}>✓</span>}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

const serif = 'Cormorant Garamond, serif';

/** Big serif-italic heading used throughout the dark editorial UI. */
export function Heading({
  children,
  size = 48,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <h2
      style={{
        fontFamily: serif,
        fontStyle: 'italic',
        fontWeight: 300,
        fontSize: size,
        letterSpacing: '-0.02em',
        margin: 0,
        color: CREAM,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}
