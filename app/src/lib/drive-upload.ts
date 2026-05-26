/**
 * Drive write helper for the Upload Studio.
 *
 * Uses the `drive.file` scope: the service account can only see/edit files
 * IT creates. To upload into existing folders, share each folder with the
 * service account email and grant Editor access.
 */

import { google } from 'googleapis';
import { Readable } from 'stream';

function getDrive() {
  const email = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error(
      'Drive credentials missing. Set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY.'
    );
  }
  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  return google.drive({ version: 'v3', auth });
}

export async function uploadToDrive(opts: {
  folderId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: {
      name: opts.filename,
      parents: [opts.folderId],
      mimeType: opts.mimeType,
    },
    media: {
      mimeType: opts.mimeType,
      body: Readable.from(opts.buffer),
    },
    fields: 'id, name',
  });
  return { id: res.data.id!, name: res.data.name! };
}
