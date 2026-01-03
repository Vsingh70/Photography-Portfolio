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
  /** Current pathname for active link detection */
  currentPath: string;
}

export function HamburgerMenu({ isOpen, onClose, links, currentPath }: HamburgerMenuProps) {
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
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop overlay - covers the page content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            onClick={onClose}
            className="fixed inset-0 z-[9998] bg-white dark:bg-black"
            aria-hidden="true"
          />

          {/* Menu content - sits on top of backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[9999]"
          >
            {/* Navigation links - centered in screen */}
            <nav className="flex h-full w-full flex-col items-center justify-center gap-6">
              {links.map((link, index) => {
                const isActive = currentPath === link.href;
                return (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                  >
                    <Link
                      href={link.href}
                      onClick={onClose}
                      className={`block px-4 py-2 font-display font-light text-4xl transition-colors sm:text-5xl ${isActive ? 'underline underline-offset-8' : ''}`}
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
                );
              })}

              {/* Instagram Icon */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: links.length * 0.1, duration: 0.3 }}
              >
                <Link
                  href="https://www.instagram.com/_vflics"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="block text-primary-700 transition-colors hover:text-primary-900 dark:text-primary-300 dark:hover:text-white"
                  aria-label="Instagram"
                >
                  <svg className="h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </Link>
              </motion.div>
            </nav>

            {/* Footer */}
            <div className="absolute bottom-4 left-0 right-0 sm:bottom-6 md:bottom-8 lg:bottom-10">
              <p className="font-display text-center text-sm font-light text-primary-600 dark:text-primary-400">
                © {new Date().getFullYear()} Viraj Singh Photography
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
