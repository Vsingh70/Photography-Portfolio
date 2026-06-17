'use client';

/**
 * Magic-link login gate for the Studio. Same dark editorial style as the app.
 *
 * Single-admin tool: there is NO open email field. The sign-in link only ever
 * goes to the configured owner address (NEXT_PUBLIC_STUDIO_EMAIL), and
 * `shouldCreateUser: false` means no new accounts are ever created from here —
 * a visitor can't request a link to an arbitrary inbox or self-register.
 * (RLS + the admin allowlist remain the authorization gate regardless.)
 */

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { Cap, Pill, CREAM, DIM, INK } from './ui';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_STUDIO_EMAIL ?? '';

function maskEmail(addr: string): string {
  const [user, domain] = addr.split('@');
  if (!user || !domain) return addr;
  const head = user.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(1, user.length - 1))}@${domain}`;
}

export function LoginScreen({ supabase }: { supabase: SupabaseClient<Database> }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!ADMIN_EMAIL) {
      setError('Studio email is not configured — set NEXT_PUBLIC_STUDIO_EMAIL.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: ADMIN_EMAIL,
        options: {
          emailRedirectTo: `${window.location.origin}/studio`,
          // Single-admin: never create a new account from the login screen.
          shouldCreateUser: false,
        },
      });
      if (otpErr) throw otpErr;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the sign-in link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: INK,
        color: CREAM,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <Cap style={{ color: DIM }}>vflics Studio</Cap>
        <h1
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: 56,
            letterSpacing: '-0.02em',
            margin: '18px 0 14px',
            color: CREAM,
          }}
        >
          {sent ? 'Check your email.' : 'Sign in.'}
        </h1>

        {sent ? (
          <p style={{ fontStyle: 'italic', fontSize: 16, lineHeight: 1.55, color: 'rgba(245,243,238,0.7)', margin: 0 }}>
            A one-time sign-in link is on its way to{' '}
            <span style={{ color: CREAM }}>{maskEmail(ADMIN_EMAIL)}</span>. Open it on this device to
            enter the Studio.
          </p>
        ) : (
          <>
            <p
              style={{
                fontStyle: 'italic',
                fontSize: 16,
                lineHeight: 1.55,
                color: 'rgba(245,243,238,0.7)',
                margin: '0 0 28px',
              }}
            >
              Private studio. A one-time sign-in link will be sent to the owner&apos;s inbox.
            </p>
            <Pill kind="primary" onClick={send} disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </Pill>
          </>
        )}

        {error && (
          <p
            style={{
              marginTop: 22,
              fontFamily: 'DM Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgb(231,76,60)',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
