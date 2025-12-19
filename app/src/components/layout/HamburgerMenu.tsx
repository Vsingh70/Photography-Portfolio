/**
 * HamburgerMenu Component
 *
 * Full-screen mobile navigation overlay.
 * - Animated slide-in/slide-out using framer-motion
 * - Closes on link click or overlay tap
 * - Accessible keyboard navigation
 */

'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

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
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm dark:bg-black/70"
            aria-hidden="true"
          />

          {/* Menu panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl dark:bg-primary-900"
          >
            {/* Close button */}
            <div className="flex items-center justify-end p-6">
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-primary-100 dark:hover:bg-primary-800"
                aria-label="Close navigation menu"
              >
                <svg
                  className="h-6 w-6 text-primary-900 dark:text-primary-100"
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

            {/* Navigation links */}
            <nav className="flex flex-1 flex-col gap-2 px-6">
              {links.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                >
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className="block rounded-lg px-4 py-4 font-display text-2xl font-medium text-primary-900 transition-colors hover:bg-primary-50 dark:text-primary-100 dark:hover:bg-primary-800"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* Footer (optional - can add social links here) */}
            <div className="border-t border-primary-200 p-6 dark:border-primary-700">
              <p className="text-center text-sm text-primary-600 dark:text-primary-400">
                © {new Date().getFullYear()} Viraj Singh Photography
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
