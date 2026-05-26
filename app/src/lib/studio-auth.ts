/**
 * Lightweight auth gate shared by the Studio page + local Studio API routes.
 *
 * In dev (`NODE_ENV === 'development'`), allow everything — local Studio
 * workflow stays unchanged.
 *
 * In production, accept the request only if it carries `?key=<token>` that
 * matches the `STUDIO_UPLOAD_TOKEN` env var. This lets the Tauri desktop
 * app point at https://vflics.com/studio?key=<token> while keeping the page
 * 404 to anyone without the token.
 *
 * NOTE: This is *not* as strong as the bearer-token gate on
 * /api/studio/upload-remote — the token will appear in URL bars, referer
 * headers, and server logs. Acceptable for a one-user, obscure-path tool;
 * not acceptable for anything sensitive.
 */

export function studioKeyMatches(providedKey: string | null | undefined): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const expected = process.env.STUDIO_UPLOAD_TOKEN;
  if (!expected || !providedKey) return false;
  if (providedKey.length !== expected.length) return false;
  // Constant-time compare to defend against timing oracles.
  let diff = 0;
  for (let i = 0; i < providedKey.length; i++) {
    diff |= providedKey.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
