'use client';

/**
 * Shared editorial UI primitives for the Studio: the DM-Mono tracked-uppercase
 * `Cap` label, the rounded `Pill` button, and the hairline `Rule`. Visual style
 * preserved verbatim from the original StudioApp (cream #f5f3ee on near-black).
 */

import type { CSSProperties, ReactNode } from 'react';

export const INK = '#0a0a0a';
export const CREAM = '#f5f3ee';
export const DIM = 'rgba(245,243,238,0.55)';

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
