/**
 * Footer — editorial sign-off.
 *
 * VS monogram (auto-swaps black/white by theme) on the left; a quiet tracked
 * row of Instagram / Email / © on the right. Hairline top rule, generous air.
 */

import Link from 'next/link';

const INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com/vflics';
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@vflics.com';

export const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-hair">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-12 sm:px-8 md:px-12 lg:px-16 xl:px-24">
        <Link
          href="/"
          aria-label="vflics — home"
          className="inline-flex items-center transition-opacity hover:opacity-80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/vs logo black.svg"
            alt="Viraj Singh"
            className="h-11 w-auto object-contain dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/vs logo white.svg"
            alt="Viraj Singh"
            className="hidden h-11 w-auto object-contain dark:block"
          />
        </Link>

        <div className="flex items-center gap-6 sm:gap-7">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
          >
            Instagram
          </a>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-display text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
          >
            Email
          </a>
          <span className="font-display text-[12px] uppercase tracking-[0.18em] text-muted">
            © {year} VFlics LLC
          </span>
        </div>
      </div>
    </footer>
  );
};
