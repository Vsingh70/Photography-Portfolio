/**
 * HamburgerMenu — full-screen editorial mobile nav + morphing toggle.
 *
 * Toggle and panel both render via createPortal to document.body so they
 * escape any parent stacking context. The toggle (z-60) sits above the
 * panel (z-50) and morphs from two recessive rules into an X.
 *
 * Over the cinematic home hero the toggle bars render cream (`light`); once
 * the panel is open they flip to ink so the X reads against the paper sheet.
 */

'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

interface NavLink {
  href: string;
  label: string;
}

interface HamburgerMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  links: NavLink[];
  currentPath: string;
  /** Render the closed toggle in cream (over the home hero). */
  light?: boolean;
}

const INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com/vflics';
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@vflics.com';

export function HamburgerMenu({
  isOpen,
  onToggle,
  onClose,
  links,
  currentPath,
  light = false,
}: HamburgerMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    document.documentElement.classList.add('overflow-hidden');
    return () => document.documentElement.classList.remove('overflow-hidden');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() =>
      ref.current?.querySelector<HTMLAnchorElement>('a')?.focus()
    );
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  // Closed-over-hero → cream; otherwise (and always when open) → ink.
  const barColor = isOpen ? 'var(--ink)' : light ? 'var(--cream)' : 'var(--ink)';

  return createPortal(
    <>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        data-state={isOpen ? 'open' : 'closed'}
        inert={!isOpen}
        className="
          fixed inset-0 z-50 flex flex-col bg-paper px-5 pb-10 sm:px-8
          transition-opacity duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
          md:hidden
          data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0
          data-[state=open]:opacity-100
        "
      >
        {/* Header row mirrors the Navbar's exact padding/size so the wordmark
            does not shift when the menu opens. */}
        <div className="flex items-center justify-between py-[18px]">
          <span
            id={labelId}
            className="font-display text-[20px] lowercase leading-none tracking-[0.16em] text-ink"
          >
            vflics
          </span>
          {/* Spacer matching the portal toggle so the wordmark sits clear of the X */}
          <span className="h-11 w-11" aria-hidden />
        </div>

        <nav className="mt-8 flex flex-col">
          {links.map((link, i) => {
            const active = currentPath === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                style={{ animationDelay: `${80 + i * 70}ms` }}
                className="menu-item group flex items-baseline justify-between border-b border-hair py-[22px]"
              >
                <span
                  className={`font-display text-[42px] font-light italic leading-none tracking-[-0.01em] transition-[color,transform] duration-300 group-hover:translate-x-1 ${
                    active ? 'text-ink' : 'text-ink group-hover:text-accent'
                  }`}
                >
                  {link.label}
                </span>
                <span className="meta text-[11px]">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center justify-between pt-8">
          <Link
            href="/"
            onClick={onClose}
            aria-label="vflics — home"
            className="inline-flex items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/vs logo black.svg"
              alt="Viraj Singh"
              className="h-9 w-auto object-contain dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/vs logo white.svg"
              alt="Viraj Singh"
              className="hidden h-9 w-auto object-contain dark:block"
            />
          </Link>
          <div className="flex items-center gap-6">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="font-display text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
            >
              Instagram
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              onClick={onClose}
              className="font-display text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
            >
              Email
            </a>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        data-state={isOpen ? 'open' : 'closed'}
        className="
          group fixed right-4 top-4 z-[60] flex h-11 w-11 items-center justify-end
          sm:right-6 md:hidden
        "
      >
        <span className="relative block h-4 w-6">
          <span
            data-state={isOpen ? 'open' : 'closed'}
            style={{ backgroundColor: barColor }}
            className="
              absolute right-0 top-[4px] block h-[1.5px] w-6 rounded-full
              transition-all duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
              data-[state=open]:top-[7px] data-[state=open]:rotate-45
            "
          />
          <span
            data-state={isOpen ? 'open' : 'closed'}
            style={{ backgroundColor: barColor }}
            className="
              absolute right-0 top-[11px] block h-[1.5px] w-4 rounded-full
              transition-all duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
              data-[state=open]:top-[7px] data-[state=open]:w-6 data-[state=open]:-rotate-45
            "
          />
        </span>
      </button>
    </>,
    document.body
  );
}
