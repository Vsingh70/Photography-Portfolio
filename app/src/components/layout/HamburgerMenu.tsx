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
import Image from 'next/image';
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
                  className="block transition-opacity hover:opacity-80"
                  aria-label="Instagram"
                >
                  {!mounted ? (
                    <div className="h-12 w-12 animate-pulse rounded bg-primary-200 dark:bg-primary-700" />
                  ) : (
                    <Image
                      src={resolvedTheme === 'dark' ? '/instagram-white.svg' : '/instagram-black.svg'}
                      alt="Instagram"
                      width={48}
                      height={48}
                      className="h-12 w-12"
                    />
                  )}
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
