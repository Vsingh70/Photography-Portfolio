/**
 * Tauri OAuth + Drive upload client.
 *
 * Wraps the Rust commands defined in src-tauri/src/oauth.rs.
 * Only callable when running inside the Tauri desktop app — calls throw
 * if @tauri-apps/api isn't available (web-only browser context).
 */

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let cachedInvoke: InvokeFn | null = null;

async function invoke(): Promise<InvokeFn> {
  if (cachedInvoke) return cachedInvoke;
  // Dynamic import so the build doesn't crash in pure-browser contexts.
  const mod = await import('@tauri-apps/api/core');
  cachedInvoke = mod.invoke as InvokeFn;
  return cachedInvoke;
}

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    '__TAURI_METADATA__' in window
  );
}

export async function startOAuth(): Promise<string> {
  const inv = await invoke();
  return inv<string>('start_oauth');
}

export async function signedInEmail(): Promise<string | null> {
  const inv = await invoke();
  return inv<string | null>('signed_in_email');
}

export async function signOut(): Promise<void> {
  const inv = await invoke();
  return inv<void>('sign_out');
}

export interface DriveUploadResult {
  id: string;
  name: string;
}

export async function uploadToDrive(opts: {
  folderId: string;
  filename: string;
  bytes: Uint8Array;
  mimeType?: string;
}): Promise<DriveUploadResult> {
  const inv = await invoke();
  return inv<DriveUploadResult>('upload_to_drive', {
    folderId: opts.folderId,
    filename: opts.filename,
    bytes: Array.from(opts.bytes),
    mimeType: opts.mimeType ?? null,
  });
}
