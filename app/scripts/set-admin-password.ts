#!/usr/bin/env tsx
/**
 * Set (or reset) the single Studio admin's password — the bootstrap + recovery
 * credential for the passkey flow. No email/SMTP involved.
 *
 *   npx tsx scripts/set-admin-password.ts
 *
 * Prompts for the password with hidden input (it never touches your shell
 * history). Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY +
 * NEXT_PUBLIC_STUDIO_EMAIL from .env.local, finds the admin user by that email,
 * and sets its password via the service-role admin API.
 */
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

async function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const envContent = await readFile(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  });
}

// Hidden password prompt. Compares numeric byte codes (13=CR, 10=LF, 3=Ctrl-C,
// 127=DEL, 8=BS, >=32 printable) to avoid embedding control chars in source.
// ASCII passwords assumed (fine for an admin credential).
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    stdin.resume();
    stdin.setRawMode?.(true);
    let input = '';
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 13 || byte === 10) {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(input);
          return;
        }
        if (byte === 3) {
          stdin.setRawMode?.(false);
          stdout.write('\n');
          process.exit(1);
        } else if (byte === 127 || byte === 8) {
          input = input.slice(0, -1);
        } else if (byte >= 32) {
          input += String.fromCharCode(byte);
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  await loadEnv();
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const email = (process.env.NEXT_PUBLIC_STUDIO_EMAIL || '').trim();
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  if (!email) throw new Error('Missing NEXT_PUBLIC_STUDIO_EMAIL in .env.local');

  const pw1 = await promptHidden(`New password for ${email}: `);
  if (pw1.length < 8) throw new Error('Password must be at least 8 characters.');
  const pw2 = await promptHidden('Confirm password: ');
  if (pw1 !== pw2) throw new Error('Passwords did not match.');

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Find the admin user by email (paginate defensively).
  let userId: string | undefined;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) throw new Error(`No auth user found for ${email}. Create the user in the dashboard first.`);

  const { error: updErr } = await supabase.auth.admin.updateUserById(userId, { password: pw1 });
  if (updErr) throw updErr;
  console.log(`✅ Password set for ${email}. Sign in with it, then register a passkey from the Studio's Security tab.`);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
