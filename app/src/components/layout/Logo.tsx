'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export function Logo() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Show placeholder during SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <Link href="/" className="block h-10 w-auto">
        <div className="h-10 w-32 animate-pulse rounded bg-primary-200 dark:bg-primary-700" />
      </Link>
    );
  }

  const logoSrc = resolvedTheme === 'dark'
    ? '/vs logo white.svg'
    : '/vs logo black.svg';

  return (
    <Link href="/" className="block">
      <Image
        src={logoSrc}
        alt="Viraj Singh Photography"
        width={120}
        height={40}
        className="h-10 w-auto transition-opacity hover:opacity-80"
        priority
      />
    </Link>
  );
}
