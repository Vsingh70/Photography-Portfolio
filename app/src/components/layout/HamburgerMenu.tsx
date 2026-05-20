/**
 * HamburgerMenu — full-screen mobile nav + morphing toggle button.
 *
 * Both elements are rendered via createPortal to document.body so they
 * escape any parent stacking context. The toggle button sits at z-60
 * (above the menu at z-50) so it's always visible and clickable,
 * regardless of what's beneath. No z-index dance with the Navbar.
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
}

const INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com/vflics';

export function HamburgerMenu({
  isOpen,
  onToggle,
  onClose,
  links,
  currentPath,
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
          fixed inset-0 z-50 bg-white transition-opacity duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
          dark:bg-black md:hidden
          data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0
          data-[state=open]:opacity-100
        "
      >
        <h2 id={labelId} className="sr-only">
          Main menu
        </h2>

        <nav className="flex h-full flex-col items-center justify-center gap-6">
          {links.map((link, i) => {
            const isActive = currentPath === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                style={{ animationDelay: `${i * 100}ms` }}
                className={`
                  menu-item block px-4 py-2 font-display text-4xl font-light
                  text-primary-900 transition-colors hover:text-primary-700
                  dark:text-white dark:hover:text-primary-300
                  sm:text-5xl
                  ${isActive ? 'underline underline-offset-8' : ''}
                `}
              >
                {link.label}
              </Link>
            );
          })}

          <Link
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            aria-label="Instagram"
            style={{ animationDelay: `${links.length * 100}ms` }}
            className="
              menu-item block text-primary-700 transition-colors
              hover:text-primary-900
              dark:text-primary-300 dark:hover:text-white
            "
          >
            <svg className="h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </Link>
        </nav>

        <p className="absolute bottom-6 left-0 right-0 text-center font-display text-sm font-light text-primary-600 dark:text-primary-400">
          © {new Date().getFullYear()} Viraj Singh Photography
        </p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        className="
          fixed right-4 top-4 z-[60] flex h-10 w-10 items-center justify-center
          sm:right-6 sm:top-6 md:right-8 md:top-8 md:hidden lg:right-10 lg:top-10
        "
      >
        <span className="relative block h-5 w-6">
          <span
            data-state={isOpen ? 'open' : 'closed'}
            className="
              absolute left-0 top-0 block h-[2px] w-6 rounded-full bg-primary-900
              transition-transform duration-300 ease-in-out dark:bg-white
              data-[state=open]:translate-y-[9px] data-[state=open]:rotate-45
            "
          />
          <span
            data-state={isOpen ? 'open' : 'closed'}
            className="
              absolute left-0 top-[9px] block h-[2px] w-6 rounded-full bg-primary-900
              transition-transform duration-300 ease-in-out dark:bg-white
              data-[state=open]:-rotate-45
            "
          />
          <span
            data-state={isOpen ? 'open' : 'closed'}
            className="
              absolute left-0 top-[18px] block h-[2px] w-6 rounded-full bg-primary-900
              transition-opacity duration-300 ease-in-out dark:bg-white
              data-[state=open]:opacity-0
            "
          />
        </span>
      </button>
    </>,
    document.body
  );
}
