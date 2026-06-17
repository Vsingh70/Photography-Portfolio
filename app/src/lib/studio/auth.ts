/**
 * Studio auth helpers for the passkey (WebAuthn) + password flow.
 *
 * Single-admin tool: passkeys are the daily sign-in (Face ID / Touch ID /
 * security key, discoverable so no email/username is typed); the password is
 * the one-time bootstrap + recovery. There is no email field anywhere — the
 * one admin address comes from NEXT_PUBLIC_STUDIO_EMAIL.
 *
 * These helpers centralise the Supabase passkey/password API calls and turn
 * raw error codes (server `AuthError.code` + browser `WebAuthnError.code`) into
 * friendly, editorial copy. All client-side; the public site never imports it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type Client = SupabaseClient<Database>;

/** The single owner address. Empty string means the app is misconfigured. */
export const ADMIN_EMAIL = process.env.NEXT_PUBLIC_STUDIO_EMAIL ?? '';

/**
 * `WebAuthnError.code` for an aborted ceremony. `isWebAuthnError` isn't
 * re-exported from `@supabase/supabase-js`, so we duck-type the `.code`
 * instead of deep-importing an internal module.
 */
const CEREMONY_ABORTED = 'ERROR_CEREMONY_ABORTED';

/** Narrow an unknown error (returned or thrown) to a string `code`. */
function errorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/**
 * True when a sign-in/registration error is just the user cancelling the
 * native passkey prompt — we treat this as a quiet no-op, not a real error.
 */
export function isUserCancelled(err: unknown): boolean {
  if (errorCode(err) === CEREMONY_ABORTED) return true;
  // Some browsers surface a raw DOMException for an aborted ceremony.
  if (err instanceof DOMException) return err.name === 'NotAllowedError' || err.name === 'AbortError';
  return false;
}

/** Friendly message for a passkey sign-in failure (returns null if cancelled). */
export function passkeySignInMessage(err: unknown): string | null {
  if (isUserCancelled(err)) return null;
  switch (errorCode(err)) {
    case 'passkey_disabled':
      return "Passkeys aren't enabled for this project yet.";
    case 'no_authenticator':
    case 'webauthn_no_credentials':
    case 'passkey_not_found':
      return 'No passkey found on this device — use your password below, then add one.';
    default:
      return err instanceof Error ? err.message : 'Could not sign in with a passkey.';
  }
}

/** Friendly message for a passkey registration failure (null if cancelled). */
export function passkeyRegisterMessage(err: unknown): string | null {
  if (isUserCancelled(err)) return null;
  switch (errorCode(err)) {
    case 'passkey_disabled':
      return "Passkeys aren't enabled for this project yet.";
    case 'webauthn_credential_exists':
      return 'Already registered on this device.';
    case 'too_many_passkeys':
      return "You've reached the passkey limit for this account.";
    default:
      return err instanceof Error ? err.message : 'Could not register a passkey.';
  }
}

/** Friendly message for a password sign-in failure. */
export function passwordSignInMessage(err: unknown): string {
  switch (errorCode(err)) {
    case 'invalid_credentials':
    case 'invalid_grant':
      return 'That password is incorrect.';
    case 'email_not_confirmed':
      return 'This account is not confirmed yet.';
    default:
      return err instanceof Error ? err.message : 'Could not sign in.';
  }
}

/**
 * Primary sign-in: a discoverable passkey. No email/username needed.
 * Returns `{ ok, cancelled, error }` — `cancelled` means a quiet no-op.
 */
export async function signInWithPasskey(
  supabase: Client
): Promise<{ ok: boolean; cancelled: boolean; error: string | null }> {
  try {
    const { error } = await supabase.auth.signInWithPasskey();
    if (error) {
      const msg = passkeySignInMessage(error);
      return { ok: false, cancelled: msg === null, error: msg };
    }
    return { ok: true, cancelled: false, error: null };
  } catch (err) {
    const msg = passkeySignInMessage(err);
    return { ok: false, cancelled: msg === null, error: msg };
  }
}

/** Password fallback sign-in against the single configured admin address. */
export async function signInWithPassword(
  supabase: Client,
  password: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!ADMIN_EMAIL) {
    return { ok: false, error: 'Studio email is not configured — set NEXT_PUBLIC_STUDIO_EMAIL.' };
  }
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
    if (error) return { ok: false, error: passwordSignInMessage(error) };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: passwordSignInMessage(err) };
  }
}
