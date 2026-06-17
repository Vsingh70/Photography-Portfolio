'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HamburgerMenu } from './HamburgerMenu';

interface NavbarProps {
  /** Kept for compatibility with existing callers. When false the bar is hidden. */
  visible?: boolean;
  /**
   * Recessive overlay mode for the cinematic home hero: the bar starts
   * transparent with cream chrome over the image, then resolves to a solid
   * paper bar once the hero scrolls away.
   */
  overlay?: boolean;
}

const DESKTOP_LINKS = [
  { href: '/gallery', label: 'Gallery' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

// Mobile full-screen menu carries Home as well (wordmark is the home link on desktop).
const MOBILE_LINKS = [
  { href: '/gallery', label: 'Gallery' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/', label: 'Home' },
];

const INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com/vflics';

export function Navbar({ visible = true, overlay = false }: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // In overlay mode the bar is "transparent" until the hero scrolls past.
  const [solid, setSolid] = useState(!overlay);

  useEffect(() => {
    if (!overlay) {
      setSolid(true);
      return;
    }
    const onScroll = () => {
      const past = window.scrollY > window.innerHeight * 0.82;
      setSolid((prev) => (prev === past ? prev : past));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overlay]);

  if (!visible) return null;

  // `transparent` = overlay chrome (cream text, no bar). Menu open forces solid.
  const transparent = overlay && !solid && !mobileMenuOpen;

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        data-solid={transparent ? 'false' : 'true'}
        className="fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-500"
        style={{
          backgroundColor: transparent
            ? 'transparent'
            : 'color-mix(in srgb, var(--paper) 86%, transparent)',
          backdropFilter: transparent ? 'none' : 'blur(10px)',
          WebkitBackdropFilter: transparent ? 'none' : 'blur(10px)',
          borderBottom: `1px solid ${transparent ? 'transparent' : 'var(--hair)'}`,
        }}
      >
        <div className="flex items-center justify-between px-5 py-[18px] sm:px-8 md:px-12 md:py-[22px] lg:px-16 xl:px-24">
          <Link
            href="/"
            aria-label="vflics — home"
            className="font-display text-[20px] lowercase leading-none tracking-[0.16em] transition-colors duration-500 md:text-[21px]"
            style={{ color: transparent ? 'var(--cream)' : 'var(--ink)' }}
          >
            vflics
          </Link>

          {/* Desktop nav — recessive, tracked metadata voice */}
          <nav className="hidden items-center gap-7 md:flex lg:gap-9">
            {DESKTOP_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href === '/gallery' && pathname.startsWith('/gallery'));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group relative font-display text-[13px] uppercase leading-none tracking-[0.18em] transition-colors duration-500"
                  style={{
                    color: transparent
                      ? active
                        ? 'var(--cream)'
                        : 'rgba(245,243,238,0.78)'
                      : active
                        ? 'var(--ink)'
                        : 'var(--ink-soft)',
                  }}
                >
                  {link.label}
                  <span
                    className="absolute -bottom-1.5 left-0 h-px w-0 bg-current transition-[width] duration-300 ease-out group-hover:w-full"
                    style={{ width: active ? '100%' : undefined }}
                    aria-hidden
                  />
                </Link>
              );
            })}

            <Link
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="transition-[color,transform] duration-500 hover:-translate-y-px"
              style={{
                color: transparent ? 'rgba(245,243,238,0.78)' : 'var(--ink-soft)',
              }}
            >
              <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </Link>
          </nav>

          {/* Spacer reserving the hamburger toggle's footprint on mobile */}
          <div className="h-11 w-11 md:hidden" aria-hidden />
        </div>
      </motion.header>

      <HamburgerMenu
        isOpen={mobileMenuOpen}
        onToggle={() => setMobileMenuOpen((o) => !o)}
        onClose={() => setMobileMenuOpen(false)}
        links={MOBILE_LINKS}
        currentPath={pathname}
        light={transparent}
      />
    </>
  );
}
