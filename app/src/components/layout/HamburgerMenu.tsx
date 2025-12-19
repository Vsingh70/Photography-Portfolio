/**
 * HamburgerMenu Component
 *
 * Full-screen mobile navigation overlay.
 * - Animated slide-in/slide-out using framer-motion
 * - Closes on link click or overlay tap
 * - Accessible keyboard navigation
 */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from 'next-themes';

interface NavLink {
  href: string;
  label: string;
}

interface HamburgerMenuProps {
  /** Controls menu open/close state */
  isOpen: boolean;
  /** Callback to close the menu */
  onClose: () => void;
  /** Navigation links to display */
  links: NavLink[];
}

export function HamburgerMenu({ isOpen, onClose, links }: HamburgerMenuProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay - covers the page content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-[90]"
            style={{
              backgroundColor: !mounted ? '#ffffff' : (resolvedTheme === 'dark' ? '#121212' : '#ffffff')
            }}
            aria-hidden="true"
          />

          {/* Menu content - sits on top of backdrop */}
          <div className="fixed inset-0 z-[100]">
            {/* Close button */}
            <div className="absolute right-4 top-4 sm:right-6 sm:top-6 md:right-8 md:top-8 lg:right-10 lg:top-10">
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-opacity-10"
                style={{
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = resolvedTheme === 'dark' ? '#343a40' : '#f1f3f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-label="Close navigation menu"
              >
                <svg
                  className="h-6 w-6"
                  style={{
                    color: !mounted ? '#212529' : (resolvedTheme === 'dark' ? '#ffffff' : '#212529')
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Navigation links - centered in screen */}
            <nav className="flex h-full w-full flex-col items-center justify-center gap-6">
              {links.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                >
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className="block px-4 py-2 font-display font-light text-4xl transition-colors sm:text-5xl"
                    style={{
                      color: !mounted ? '#212529' : (resolvedTheme === 'dark' ? '#ffffff' : '#212529')
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = resolvedTheme === 'dark' ? '#dee2e6' : '#495057';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = resolvedTheme === 'dark' ? '#ffffff' : '#212529';
                    }}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* Footer */}
            <div className="absolute bottom-4 left-0 right-0 sm:bottom-6 md:bottom-8 lg:bottom-10">
              <p className="font-display text-center text-sm font-light text-primary-600 dark:text-primary-400">
                © {new Date().getFullYear()} Viraj Singh Photography
              </p>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
