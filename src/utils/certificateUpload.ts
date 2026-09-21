import { apiErrorMessage } from './apiError';
import { formatFileSize } from './chatMedia';
import { canonicalMime } from './mime';

/**
 * Rules for the spiritual credential upload (`POST /dating/spiritual-request`).
 *
 * The server's list, from its own refusal (checked 2026-09-17): "Accepted:
 * application/pdf, image/jpeg, image/png, application/msword, …docx". The
 * screen offers the first three, which is what its copy promises. It matches
 * the type exactly, so `image/jpg` has to be sent as `image/jpeg`.
 */
const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export const CERTIFICATE_TYPES_LABEL = 'PDF, JPG or PNG';

/**
 * The server publishes no size limit: a 40 MB request is refused by the host
 * (413) and a 12 MB one got as far as the type check. 10 MB leaves room for a
 * scanned PDF and still fails fast, before a long upload (gap #36).
 */
export const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;
export const MAX_CERTIFICATE_LABEL = '10 MB';

/** What a picker hands back, from either the photo library or the Files app. */
export interface PickedCertificate {
  uri?: string | null;
  name?: string | null;
  type?: string | null;
  size?: number | null;
}

/** A file ready to send: an accepted type, and a name that matches it. */
export interface CertificateFile {
  uri: string;
  name: string;
  type: string;
  size: number | null;
}

export type CertificateCheck =
  | { ok: true; file: CertificateFile }
  | { ok: false; reason: string };

function extensionOf(name?: string | null): string {
  const match = /\.([^./\\]+)$/.exec(name ?? '');
  return match ? match[1].toLowerCase() : '';
}

/** "GIF", "HEIC", "MP4" — the part of the file a user recognises. */
function typeLabel(mime: string, name?: string | null): string | null {
  const ext = extensionOf(name);
  if (ext) return ext.toUpperCase();
  const subtype = mime.split('/')[1];
  // Skip the long vendor types ("vnd.openxmlformats-…"); they read as noise.
  return subtype && !subtype.includes('.') ? subtype.toUpperCase() : null;
}

function unsupportedTypeReason(mime: string, name?: string | null): string {
  const label = typeLabel(mime, name);
  const what = label ? `${label} files aren't` : "That file type isn't";
  return `${what} supported. Please choose a ${CERTIFICATE_TYPES_LABEL}.`;
}

/**
 * Checks a picked file before anything is uploaded. The type comes from the
 * picker, or from the extension when the picker gave none.
 */
export function checkCertificate(picked: PickedCertificate): CertificateCheck {
  if (!picked.uri) {
    return { ok: false, reason: 'That file could not be opened. Please choose another one.' };
  }

  const mime = canonicalMime(picked.type) || TYPE_BY_EXTENSION[extensionOf(picked.name)] || '';
  const extension = ACCEPTED_TYPES[mime];
  if (!extension) {
    return { ok: false, reason: unsupportedTypeReason(mime, picked.name) };
  }

  const size = picked.size ?? null;
  if (size !== null && size > MAX_CERTIFICATE_BYTES) {
    return {
      ok: false,
      reason: `That file is ${formatFileSize(size)}. Please choose one under ${MAX_CERTIFICATE_LABEL}.`,
    };
  }

  // The name travels with the upload, so it carries the extension of the type
  // actually sent ("IMG_0042.JPEG" → "IMG_0042.jpg").
  const base = (picked.name ?? '').replace(/\.[^.]*$/, '').trim() || 'certificate';
  return {
    ok: true,
    file: { uri: picked.uri, name: `${base}.${extension}`, type: mime, size },
  };
}

/**
 * What to tell the user when the upload itself fails. The server's own type
 * refusal lists raw MIME types, so it is reworded; anything else it says is
 * shown as is.
 */
export function certificateSubmitError(err: unknown): string {
  if ((err as any)?.response?.status === 413) {
    return `That file is too large to upload. Please choose one under ${MAX_CERTIFICATE_LABEL}.`;
  }
  const message = apiErrorMessage(err);
  const refused = message ? /document type '([^']*)' is not allowed/i.exec(message) : null;
  if (refused) return unsupportedTypeReason(canonicalMime(refused[1]), null);
  return message ?? 'Could not submit your document. Please try again.';
}
