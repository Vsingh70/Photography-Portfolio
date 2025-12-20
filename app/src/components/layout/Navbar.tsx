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
import Image from 'next/image';
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
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="font-display font-light text-primary-700 transition-colors hover:text-primary-900 dark:text-primary-300 dark:hover:text-primary-100"
                  >
                    {link.label}
                  </Link>
                ))}

                {/* Instagram Icon */}
                <Link
                  href="https://www.instagram.com/_vflics"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-opacity hover:opacity-80"
                  aria-label="Instagram"
                >
                  {!mounted ? (
                    <div className="h-6 w-6 animate-pulse rounded bg-primary-200 dark:bg-primary-700" />
                  ) : (
                    <Image
                      src={resolvedTheme === 'dark' ? '/instagram-white.svg' : '/instagram-black.svg'}
                      alt="Instagram"
                      width={48}
                      height={48}
                      className="h-8 w-8"
                    />
                  )}
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
          />
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
