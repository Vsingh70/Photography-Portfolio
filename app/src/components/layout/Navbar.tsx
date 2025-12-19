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
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
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
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="fixed left-0 right-0 top-0 z-50"
        >
          <Container size="full">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 md:px-8 lg:px-10">
              {/* Logo/Brand */}
              <Logo />

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
              </div>

              {/* Mobile Menu Button */}
              <button
                className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
              >
                <span
                  className="h-[2px] w-6 rounded-full transition-all"
                  style={{ backgroundColor: !mounted ? '#6b7280' : (resolvedTheme === 'dark' ? '#ffffff' : '#212529') }}
                ></span>
                <span
                  className="h-[2px] w-6 rounded-full transition-all"
                  style={{ backgroundColor: !mounted ? '#6b7280' : (resolvedTheme === 'dark' ? '#ffffff' : '#212529') }}
                ></span>
                <span
                  className="h-[2px] w-6 rounded-full transition-all"
                  style={{ backgroundColor: !mounted ? '#6b7280' : (resolvedTheme === 'dark' ? '#ffffff' : '#212529') }}
                ></span>
              </button>
            </div>

            {/* Responsive bottom border line */}
            <div className="border-b border-primary-200 px-4 dark:border-primary-700 sm:px-6 md:px-8 lg:px-10" />
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
