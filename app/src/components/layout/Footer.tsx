/**
 * Footer Component
 *
 * Global footer used across all pages
 * - Theme-aware styling matching the site design system
 * - Uses Canela font for brand and headings
 * - Minimal, elegant design with proper dark mode support
 * - Responsive layout with social links and navigation
 */

import Link from 'next/link';
import { Container } from '../ui';

export interface FooterProps {
  showSocial?: boolean;
  showContact?: boolean;
}

export const Footer = ({ showSocial = true, showContact = true }: FooterProps) => {
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    {
      name: 'Instagram',
      href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || '#',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
    },
    {
      name: 'Facebook',
      href: process.env.NEXT_PUBLIC_FACEBOOK_URL || '#',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
  ];

  return (
    <footer className="bg-white dark:bg-black mt-auto">
      <Container>
        <div className="pt-4 pb-8 sm:pt-6 sm:pb-10">
          {/* Get In Touch - Single Row */}
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-8 md:gap-12">
            {/* Email */}
            {showContact && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-primary-600 dark:text-primary-400">Email:</p>
                <a
                  href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@example.com'}`}
                  className="text-sm text-primary-900 dark:text-white hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  {process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@example.com'}
                </a>
              </div>
            )}

            {/* Social Links */}
            {showSocial && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-primary-600 dark:text-primary-400">Follow:</p>
                <div className="flex gap-3">
                  {socialLinks.map((social) => (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-700 dark:text-primary-300 hover:text-primary-900 dark:hover:text-white transition-colors"
                      aria-label={social.name}
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Copyright */}
            <div className="hidden sm:block">
              <p className="text-xs text-primary-600 dark:text-primary-400">
                © {currentYear} Viraj Singh Photography
              </p>
            </div>
          </div>

          {/* Copyright - Mobile Only */}
          <div className="mt-6 text-center sm:hidden">
            <p className="text-xs text-primary-600 dark:text-primary-400">
              © {currentYear} Viraj Singh Photography
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
};
