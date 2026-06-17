'use client';

/**
 * Magic-link login gate for the Studio. Same dark editorial style as the app.
 * `shouldCreateUser` is left default (true) — the admin allowlist + RLS are the
 * real authorization gate, so a non-allowlisted account simply can't read or
 * write anything once signed in.
 */

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { Cap, Pill, CREAM, DIM, INK } from './ui';

export function LoginScreen({ supabase }: { supabase: SupabaseClient<Database> }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: `${window.location.origin}/studio` },
      });
      if (otpErr) throw otpErr;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the magic link.');
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
            A magic link is on its way to <span style={{ color: CREAM }}>{email.trim()}</span>. Open
            it on this device to enter the Studio.
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
              Enter your email and we&apos;ll send a one-time sign-in link.
            </p>
            <input
              type="email"
              value={email}
              autoFocus
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !busy) send();
              }}
              style={{
                display: 'block',
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(245,243,238,0.25)',
                padding: '10px 0 12px',
                fontFamily: 'Cormorant Garamond, serif',
                fontStyle: 'italic',
                fontWeight: 300,
                fontSize: 28,
                color: CREAM,
                outline: 'none',
                textAlign: 'center',
                marginBottom: 24,
              }}
              onFocus={(e) => (e.currentTarget.style.borderBottomColor = CREAM)}
              onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(245,243,238,0.25)')}
            />
            <Pill kind="primary" onClick={send} disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Send magic link'}
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
