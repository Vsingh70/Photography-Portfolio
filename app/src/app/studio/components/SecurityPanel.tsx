'use client';

/**
 * Security panel: passkey (WebAuthn) management for the single admin.
 *
 * - Register a passkey for the current device (`registerPasskey()`), which
 *   requires the existing signed-in session.
 * - List the account's passkeys (`auth.passkey.list()`) with friendly name,
 *   created date, and last-used, each with rename (`auth.passkey.update`) and
 *   delete (`auth.passkey.delete`) actions.
 *
 * All client-side, dark editorial style. The public site never imports this.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { isUserCancelled, passkeyRegisterMessage } from '@/lib/studio/auth';
import { Cap, Pill, Rule, Heading, DIM, CREAM } from './ui';

type Client = SupabaseClient<Database>;

/** Mirrors the supabase-js `PasskeyListItem`. */
interface Passkey {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const SERIF = 'Cormorant Garamond, serif';

export function SecurityPanel({ supabase }: { supabase: Client }) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: listErr } = await supabase.auth.passkey.list();
    if (listErr) {
      setError(listErr.message);
      return;
    }
    setPasskeys(data ?? []);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: listErr } = await supabase.auth.passkey.list();
      if (cancelled) return;
      if (listErr) setError(listErr.message);
      else setPasskeys(data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const register = async () => {
    setRegistering(true);
    setError(null);
    setNotice(null);
    try {
      const { error: regErr } = await supabase.auth.registerPasskey();
      if (regErr) {
        const msg = passkeyRegisterMessage(regErr);
        if (msg) setError(msg);
      } else {
        setNotice('Passkey added. You can skip the password next time.');
        await refresh();
      }
    } catch (err) {
      if (!isUserCancelled(err)) {
        setError(passkeyRegisterMessage(err) ?? 'Could not register a passkey.');
      }
    } finally {
      setRegistering(false);
    }
  };

  const startRename = (pk: Passkey) => {
    setRenamingId(pk.id);
    setRenameValue(pk.friendly_name ?? '');
    setError(null);
    setNotice(null);
  };

  const commitRename = async (id: string) => {
    const friendlyName = renameValue.trim();
    if (!friendlyName) {
      setRenamingId(null);
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const { error: updErr } = await supabase.auth.passkey.update({ passkeyId: id, friendlyName });
      if (updErr) setError(updErr.message);
      else await refresh();
    } finally {
      setBusyId(null);
      setRenamingId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const { error: delErr } = await supabase.auth.passkey.delete({ passkeyId: id });
      if (delErr) setError(delErr.message);
      else await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <Cap style={{ color: DIM }}>Security</Cap>
      <Heading size={40} style={{ marginTop: 10 }}>
        Passkeys.
      </Heading>
      <p style={{ fontStyle: 'italic', color: DIM, fontSize: 15, marginTop: 10, maxWidth: 560 }}>
        Passkeys are your daily sign-in — Face ID, Touch ID, or a security key. Register one per
        device so you can skip the password. Passkeys are bound to the live domain, so register and
        use them on the production site.
      </p>

      <div style={{ marginTop: 22 }}>
        <Pill kind="primary" onClick={register} disabled={registering}>
          {registering ? 'Waiting…' : 'Register a passkey for this device'}
        </Pill>
      </div>

      {error && <Cap style={{ color: 'rgb(231,76,60)', display: 'block', marginTop: 16 }}>{error}</Cap>}
      {notice && (
        <Cap style={{ color: 'rgba(118,200,147,0.9)', display: 'block', marginTop: 16 }}>{notice}</Cap>
      )}

      <Rule style={{ marginTop: 28 }} />

      <Cap style={{ color: DIM, display: 'block', marginTop: 20, marginBottom: 6 }}>
        Registered passkeys
      </Cap>

      {loading ? (
        <p style={{ fontStyle: 'italic', color: DIM, fontSize: 15 }}>Loading…</p>
      ) : passkeys.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: DIM, fontSize: 15 }}>
          No passkeys yet — register one above to skip the password next time.
        </p>
      ) : (
        <div>
          {passkeys.map((pk) => {
            const isBusy = busyId === pk.id;
            return (
              <div
                key={pk.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 0',
                  borderTop: '1px solid rgba(245,243,238,0.08)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 220 }}>
                  {renamingId === pk.id ? (
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                      maxLength={120}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(pk.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      placeholder="e.g. MacBook Touch ID"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(245,243,238,0.25)',
                        padding: '4px 0 6px',
                        fontFamily: SERIF,
                        fontStyle: 'italic',
                        fontSize: 20,
                        color: CREAM,
                        outline: 'none',
                        width: 280,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        fontFamily: SERIF,
                        fontStyle: 'italic',
                        fontWeight: 300,
                        fontSize: 22,
                        color: CREAM,
                      }}
                    >
                      {pk.friendly_name || 'Unnamed passkey'}
                    </div>
                  )}
                  <Cap style={{ color: DIM, display: 'block', marginTop: 6 }}>
                    Added {fmtDate(pk.created_at)}
                    {pk.last_used_at ? ` · last used ${fmtDate(pk.last_used_at)}` : ' · never used'}
                  </Cap>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {renamingId === pk.id ? (
                    <>
                      <Pill onClick={() => commitRename(pk.id)} disabled={isBusy}>
                        Save
                      </Pill>
                      <Pill onClick={() => setRenamingId(null)} disabled={isBusy}>
                        Cancel
                      </Pill>
                    </>
                  ) : (
                    <>
                      <Pill onClick={() => startRename(pk)} disabled={isBusy}>
                        Rename
                      </Pill>
                      <Pill kind="danger" onClick={() => remove(pk.id)} disabled={isBusy}>
                        {isBusy ? '…' : 'Remove'}
                      </Pill>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
