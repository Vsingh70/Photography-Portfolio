/** kebab-case a free-text title into a URL-safe slug (drops trailing hyphens). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Lenient sanitizer for *live* slug typing: keeps a single trailing hyphen so
 * the user can actually type "vdr-party" (the strict slugify strips a trailing
 * hyphen on every keystroke, making a dash impossible to enter). Lowercases,
 * strips diacritics, turns runs of invalid chars into one hyphen, and strips
 * leading hyphens. Run slugify() on blur to drop any leftover trailing hyphen.
 */
export function slugifyInput(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, ''); // strip leading hyphens, keep a trailing one while typing
}

/** Ensure a slug is unique against a set of taken slugs by suffixing -2, -3… */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = base || 'project';
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}
