'use client';

/**
 * Editorial dark-themed date picker for the project `shot_date` field.
 *
 * A field-style trigger (showing the current value or "Add date") opens a
 * month-grid popover. Hand-rolled (no dependency) to match the Studio's
 * cream-on-near-black aesthetic — Cormorant serif month heading, DM Mono `Cap`
 * weekday labels, `Pill` button vocabulary for nav/clear. Year traversal: « / »
 * chevrons jump a whole year, and clicking the month/year heading swaps the day
 * grid for a 12-year picker (the inner ‹ / › then step the year window).
 * Keyboard-accessible (arrow keys move the focused day, Enter/Space selects,
 * Escape closes) and closes on outside-click. The value is the same
 * `YYYY-MM-DD` string the rest of the code uses for `shot_date` (empty string =
 * no date; shot_date is optional).
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Cap, Pill, CREAM, DIM } from './ui';

const SERIF = 'Cormorant Garamond, serif';
const POP_EASE = [0.16, 1, 0.3, 1] as const;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Parse a `YYYY-MM-DD` string to a *local* Date (no UTC shift). null if blank/invalid. */
function parseISO(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a local Date to `YYYY-MM-DD`. */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function prettyLabel(value: string): string {
  const d = parseISO(value);
  if (!d) return 'Add date';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseISO(value), [value]);
  const today = useMemo(() => new Date(), []);
  // The month currently shown in the grid; the day the keyboard "cursor" is on.
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [focusDay, setFocusDay] = useState<Date>(() => selected ?? today);
  // Clicking the header swaps the day grid for a 12-year picker grid.
  const [yearView, setYearView] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  // When opening, sync the view + cursor to the selected value (or today).
  useEffect(() => {
    if (!open) return;
    const base = selected ?? today;
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setFocusDay(base);
    setYearView(false);
    // Focus the grid so arrow keys work immediately.
    const t = window.setTimeout(() => gridRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, selected, today]);

  // Outside-click + Escape close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const commit = (d: Date) => {
    onChange(toISO(d));
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Grid: leading blanks for the 1st weekday, then the days of the month.
  const days = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [viewMonth]);

  const moveFocus = (deltaDays: number) => {
    setFocusDay((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + deltaDays);
      // Keep the visible month in sync with the cursor.
      if (next.getMonth() !== viewMonth.getMonth() || next.getFullYear() !== viewMonth.getFullYear()) {
        setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1));
      }
      return next;
    });
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); moveFocus(-1); break;
      case 'ArrowRight': e.preventDefault(); moveFocus(1); break;
      case 'ArrowUp': e.preventDefault(); moveFocus(-7); break;
      case 'ArrowDown': e.preventDefault(); moveFocus(7); break;
      case 'Enter':
      case ' ': e.preventDefault(); commit(focusDay); break;
      default: break;
    }
  };

  const stepMonth = (delta: number) =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const stepYear = (delta: number) =>
    setViewMonth((m) => new Date(m.getFullYear() + delta, m.getMonth(), 1));

  // The 12-year window shown in the year-grid view (aligned to multiples of 12).
  const yearWindowStart = useMemo(
    () => Math.floor(viewMonth.getFullYear() / 12) * 12,
    [viewMonth]
  );

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid rgba(245,243,238,0.18)',
          padding: '6px 0 8px',
          fontFamily: SERIF,
          fontSize: 18,
          color: selected ? CREAM : 'rgba(245,243,238,0.4)',
          cursor: 'pointer',
          outline: 'none',
          textAlign: 'left',
        }}
        onFocus={(e) => (e.currentTarget.style.borderBottomColor = CREAM)}
        onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(245,243,238,0.18)')}
      >
        <span>{prettyLabel(value)}</span>
        <Cap style={{ color: DIM, fontSize: 9 }}>{open ? '▲' : '▼'}</Cap>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={popId}
            role="dialog"
            aria-label="Choose a date"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: POP_EASE }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              zIndex: 60,
              width: 280,
              background: '#0a0a0a',
              border: '1px solid rgba(245,243,238,0.18)',
              boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
              padding: 16,
            }}
          >
            {/* Header nav: year chevrons + month chevrons flank a clickable
                month/year heading (click → year-grid). In year view the inner
                chevrons step the 12-year window instead of the month. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 6 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <NavBtn label="Previous year" onClick={() => stepYear(-1)}>«</NavBtn>
                <NavBtn
                  label={yearView ? 'Previous years' : 'Previous month'}
                  onClick={() => (yearView ? stepYear(-12) : stepMonth(-1))}
                >
                  ‹
                </NavBtn>
              </div>
              <button
                type="button"
                onClick={() => setYearView((v) => !v)}
                aria-label={yearView ? 'Back to days' : 'Choose a year'}
                aria-expanded={yearView}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: SERIF,
                  fontStyle: 'italic',
                  fontWeight: 300,
                  fontSize: 22,
                  color: CREAM,
                  letterSpacing: '-0.01em',
                  padding: '2px 0',
                  borderRadius: 2,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,243,238,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {yearView
                  ? `${yearWindowStart} – ${yearWindowStart + 11}`
                  : `${MONTH_NAMES[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`}
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                <NavBtn
                  label={yearView ? 'Next years' : 'Next month'}
                  onClick={() => (yearView ? stepYear(12) : stepMonth(1))}
                >
                  ›
                </NavBtn>
                <NavBtn label="Next year" onClick={() => stepYear(1)}>»</NavBtn>
              </div>
            </div>

            {yearView ? (
              /* Year grid: pick a year, then drop back to the day grid. */
              <div
                role="grid"
                aria-label="Years"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}
              >
                {Array.from({ length: 12 }, (_, i) => yearWindowStart + i).map((yr) => {
                  const isCurrent = yr === viewMonth.getFullYear();
                  const isSelYear = selected ? selected.getFullYear() === yr : false;
                  return (
                    <button
                      key={yr}
                      type="button"
                      role="gridcell"
                      aria-selected={isSelYear}
                      onClick={() => {
                        setViewMonth(new Date(yr, viewMonth.getMonth(), 1));
                        setYearView(false);
                        window.setTimeout(() => gridRef.current?.focus(), 0);
                      }}
                      style={{
                        padding: '10px 0',
                        background: isSelYear ? CREAM : 'transparent',
                        color: isSelYear ? '#0a0a0a' : CREAM,
                        border:
                          isCurrent && !isSelYear
                            ? '1px solid rgba(212,169,62,0.6)'
                            : '1px solid rgba(245,243,238,0.14)',
                        borderRadius: 2,
                        cursor: 'pointer',
                        fontFamily: SERIF,
                        fontSize: 16,
                        lineHeight: 1,
                        transition: 'background 0.12s, color 0.12s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelYear) e.currentTarget.style.background = 'rgba(245,243,238,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelYear) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {/* Weekday labels */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                  {WEEKDAYS.map((w, i) => (
                    <div key={i} style={{ textAlign: 'center', padding: '4px 0' }}>
                      <Cap style={{ color: DIM, fontSize: 9 }}>{w}</Cap>
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div
                  ref={gridRef}
                  tabIndex={0}
                  role="grid"
                  aria-label="Days"
                  onKeyDown={onGridKeyDown}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, outline: 'none' }}
                >
                  {days.map((d, i) => {
                    if (!d) return <div key={`b${i}`} />;
                    const isSel = selected ? sameDay(d, selected) : false;
                    const isFocus = sameDay(d, focusDay);
                    const isToday = sameDay(d, today);
                    return (
                      <button
                        key={toISO(d)}
                        type="button"
                        role="gridcell"
                        aria-selected={isSel}
                        tabIndex={-1}
                        onClick={() => commit(d)}
                        onMouseEnter={() => setFocusDay(d)}
                        style={{
                          aspectRatio: '1 / 1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isSel ? CREAM : isFocus ? 'rgba(245,243,238,0.1)' : 'transparent',
                          color: isSel ? '#0a0a0a' : CREAM,
                          border: isToday && !isSel ? '1px solid rgba(212,169,62,0.6)' : '1px solid transparent',
                          borderRadius: 2,
                          cursor: 'pointer',
                          fontFamily: SERIF,
                          fontSize: 16,
                          lineHeight: 1,
                          padding: 0,
                          transition: 'background 0.12s, color 0.12s',
                        }}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Footer: today + clear */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <Pill onClick={() => commit(today)}>Today</Pill>
              <Pill
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                disabled={!selected}
              >
                Clear
              </Pill>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: '1px solid rgba(245,243,238,0.18)',
        borderRadius: 999,
        color: CREAM,
        cursor: 'pointer',
        fontFamily: SERIF,
        fontSize: 20,
        lineHeight: 1,
        padding: 0,
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,243,238,0.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}
