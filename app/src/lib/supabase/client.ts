/**
 * Supabase browser client (Studio only).
 *
 * Public site pages NEVER import this — they are a static export served from
 * the R2 CDN and make no runtime Supabase calls. Only the authenticated
 * `/studio` route uses this client (passkey / password auth + projects/images
 * writes + Storage uploads). Uses the public URL + publishable (anon) key; RLS
 * + the admin allowlist enforce that only the photographer can read/write.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient<Database> | undefined;

/** Lazily-created singleton browser client (avoids duplicate GoTrue instances). */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  if (!cached) {
    cached = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        // Opt into passkey (WebAuthn) auth — primary Studio sign-in via
        // signInWithPasskey()/registerPasskey()/auth.passkey.*. Without this
        // flag those methods throw at call time. (Typed in supabase-js ≥2.105;
        // this build exposes auth.experimental.passkey, so no cast is needed.)
        experimental: { passkey: true },
      },
    });
  }
  return cached;
}
