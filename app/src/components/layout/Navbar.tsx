/**
 * Navbar Component
 *
 * Primary navigation for the photography portfolio.
 * - Hidden during homepage animation, fades in after completion
 * - Fixed position with backdrop blur for modern aesthetic
 * - Integrates HamburgerMenu for mobile responsiveness
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Container } from '@/components/ui';
import { HamburgerMenu } from './HamburgerMenu';
import { Logo } from './Logo';

interface NavbarProps {
  /** Controls visibility with smooth fade animation */
  visible?: boolean;
}

interface NavLink {
  href: string;
  label: string;
}

const navLinks: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/contact', label: 'Contact' },
  { href: '/about', label: 'About' },
];

export function Navbar({ visible = true }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className={`fixed left-0 right-0 top-0 ${mobileMenuOpen ? 'z-[10000]' : 'z-50 bg-white dark:bg-black'}`}
        >
          <Container size="full">
            <div className={`flex items-center justify-between px-4 py-4 sm:px-6 md:px-8 lg:px-10 ${!mobileMenuOpen ? 'bg-white dark:bg-black' : ''}`}>
              {/* Logo/Brand - only visible when menu is closed */}
              {!mobileMenuOpen && <Logo />}

              {/* Desktop Navigation */}
              <div className="hidden items-center gap-6 md:flex lg:gap-8">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`font-display font-light text-primary-700 transition-colors hover:text-primary-900 dark:text-primary-300 dark:hover:text-primary-100 ${isActive ? 'underline underline-offset-4' : ''}`}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                {/* Instagram Icon */}
                <Link
                  href="https://www.instagram.com/_vflics"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-700 transition-colors hover:text-primary-900 dark:text-primary-300 dark:hover:text-white"
                  aria-label="Instagram"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </Link>
              </div>

              {/* Mobile Menu Button - animates between hamburger and X */}
              <button
                className={`flex h-10 w-10 items-center justify-center md:hidden ${mobileMenuOpen ? 'fixed right-[32px] top-4 z-[10001] sm:right-[40px] sm:top-6 md:right-[48px] md:top-8 lg:right-[56px] lg:top-10' : 'relative'}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              >
                <div className="relative h-5 w-6">
                  {/* Top bar - rotates to form top part of X */}
                  <motion.span
                    className="absolute left-0 h-[2px] w-6 rounded-full"
                    style={{ backgroundColor: !mounted ? '#6b7280' : (resolvedTheme === 'dark' ? '#ffffff' : '#212529') }}
                    animate={mobileMenuOpen ? {
                      rotate: 45,
                      y: 9
                    } : {
                      rotate: 0,
                      y: 0
                    }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  />

                  {/* Middle bar - rotates to form bottom part of X */}
                  <motion.span
                    className="absolute left-0 top-[9px] h-[2px] w-6 rounded-full"
                    style={{ backgroundColor: !mounted ? '#6b7280' : (resolvedTheme === 'dark' ? '#ffffff' : '#212529') }}
                    animate={mobileMenuOpen ? {
                      rotate: -45
                    } : {
                      rotate: 0
                    }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  />

                  {/* Bottom bar - fades out */}
                  <motion.span
                    className="absolute left-0 top-[18px] h-[2px] w-6 rounded-full"
                    style={{ backgroundColor: !mounted ? '#6b7280' : (resolvedTheme === 'dark' ? '#ffffff' : '#212529') }}
                    animate={mobileMenuOpen ? {
                      opacity: 0
                    } : {
                      opacity: 1
                    }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              </button>
            </div>

            {/* Responsive bottom border line - only visible when menu is closed */}
            {!mobileMenuOpen && (
              <div className="border-b border-primary-200 px-4 dark:border-primary-700 sm:px-6 md:px-8 lg:px-10" />
            )}
          </Container>

          {/* Mobile Menu */}
          <HamburgerMenu
            isOpen={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            links={navLinks}
            currentPath={pathname}
          />
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
