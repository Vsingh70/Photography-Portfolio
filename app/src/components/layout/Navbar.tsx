/**
 * Navbar Component
 *
 * Primary navigation for the photography portfolio.
 * - Hidden during homepage animation, fades in after completion
 * - Fixed position with backdrop blur for modern aesthetic
 * - Integrates HamburgerMenu for mobile responsiveness
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Container } from '@/components/ui';
import { HamburgerMenu } from './HamburgerMenu';

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

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="fixed left-0 right-0 top-0 z-50 border-b border-primary-200 bg-white/95 backdrop-blur-sm"
        >
          <Container>
            <div className="flex items-center justify-between py-4">
              {/* Logo/Brand */}
              <Link
                href="/"
                className="font-display text-2xl font-bold text-primary-900 transition-colors hover:text-primary-700"
              >
                VIRAJ SINGH
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden items-center gap-8 md:flex">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="font-medium text-primary-700 transition-colors hover:text-primary-900"
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
                <span className="h-0.5 w-6 bg-primary-900 transition-all"></span>
                <span className="h-0.5 w-6 bg-primary-900 transition-all"></span>
                <span className="h-0.5 w-6 bg-primary-900 transition-all"></span>
              </button>
            </div>
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
