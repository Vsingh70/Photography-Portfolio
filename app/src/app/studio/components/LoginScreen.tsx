'use client';

/**
 * Login gate for the Studio. Same dark editorial style as the app.
 *
 * Single-admin tool, two ways in:
 *   1. Primary — a passkey (Face ID / Touch ID / security key). Discoverable,
 *      so there's no email/username field; `signInWithPasskey()` runs the
 *      WebAuthn ceremony and sets the session.
 *   2. Fallback — a password (the one-time bootstrap + recovery). NO email
 *      field is shown: the address is the configured owner
 *      (NEXT_PUBLIC_STUDIO_EMAIL). `signInWithPassword({ email, password })`.
 *
 * There is no self-registration here; RLS + the admin allowlist remain the
 * authorization gate regardless. `onPasswordSignedIn` lets the parent show a
 * one-time "add a passkey" nudge after a password sign-in.
 */

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  ADMIN_EMAIL,
  signInWithPasskey,
  signInWithPassword,
} from '@/lib/studio/auth';
import { Cap, Pill, DIM, INK, CREAM } from './ui';

type Client = SupabaseClient<Database>;

const SERIF = 'Cormorant Garamond, serif';

export function LoginScreen({
  supabase,
  onPasswordSignedIn,
}: {
  supabase: Client;
  onPasswordSignedIn?: () => void;
}) {
  const [busy, setBusy] = useState<null | 'passkey' | 'password'>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');

  const configError = !ADMIN_EMAIL
    ? 'Studio email is not configured — set NEXT_PUBLIC_STUDIO_EMAIL.'
    : null;

  const onPasskey = async () => {
    setBusy('passkey');
    setError(null);
    const { ok, cancelled, error: msg } = await signInWithPasskey(supabase);
    setBusy(null);
    // On success the auth state change drives the parent into the composer.
    if (!ok && !cancelled) setError(msg);
  };

  const onPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy('password');
    setError(null);
    const { ok, error: msg } = await signInWithPassword(supabase, password);
    setBusy(null);
    if (ok) {
      setPassword('');
      onPasswordSignedIn?.();
    } else {
      setError(msg);
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
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: 56,
            letterSpacing: '-0.02em',
            margin: '18px 0 14px',
            color: CREAM,
          }}
        >
          Sign in.
        </h1>

        <p
          style={{
            fontStyle: 'italic',
            fontSize: 16,
            lineHeight: 1.55,
            color: 'rgba(245,243,238,0.7)',
            margin: '0 0 28px',
          }}
        >
          Private studio. Sign in with your passkey — Face ID, Touch ID, or a
          security key.
        </p>

        <Pill
          kind="primary"
          onClick={onPasskey}
          disabled={busy !== null || configError !== null}
          style={{ justifyContent: 'center', minWidth: 220 }}
        >
          {busy === 'passkey' ? 'Waiting…' : 'Sign in with passkey'}
        </Pill>

        {/* Password fallback */}
        <div style={{ marginTop: 26 }}>
          {!showPassword ? (
            <button
              type="button"
              onClick={() => {
                setShowPassword(true);
                setError(null);
              }}
              disabled={configError !== null}
              style={{
                background: 'transparent',
                border: 'none',
                color: DIM,
                cursor: configError ? 'not-allowed' : 'pointer',
                fontFamily: 'DM Mono, monospace',
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                opacity: configError ? 0.4 : 1,
                textDecoration: 'underline',
                textUnderlineOffset: 4,
              }}
            >
              Use password instead
            </button>
          ) : (
            <form
              onSubmit={onPassword}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                autoComplete="current-password"
                style={{
                  width: '100%',
                  maxWidth: 320,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(245,243,238,0.25)',
                  padding: '8px 0 10px',
                  fontFamily: SERIF,
                  fontStyle: 'italic',
                  fontSize: 20,
                  color: CREAM,
                  outline: 'none',
                  textAlign: 'center',
                }}
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = CREAM)}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(245,243,238,0.25)')}
              />
              <Pill
                kind="default"
                type="submit"
                disabled={busy !== null || !password}
                style={{ justifyContent: 'center', minWidth: 180 }}
              >
                {busy === 'password' ? 'Signing in…' : 'Sign in →'}
              </Pill>
            </form>
          )}
        </div>

        {(error ?? configError) && (
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
            {error ?? configError}
          </p>
        )}
      </div>
    </div>
  );
}
