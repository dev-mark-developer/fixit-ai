import { canonicalMime } from './mime';
import { formatFileSize } from './chatMedia';

/**
 * Ceiling for any single image the app uploads (avatars, dating gallery,
 * penpal profile). Checked on the device so the user gets told *what* is
 * wrong instead of watching a multi-megabyte upload fail into a generic
 * "could not upload the image".
 *
 * Pickers are configured with `maxWidth`/`maxHeight` + `quality`, so
 * `fileSize` is the size of the *resized* file — i.e. what actually goes
 * over the wire, not the camera original.
 */
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

const MAX_IMAGE_LABEL = '5 MB';

/**
 * Image types the upload endpoints are *verified* to refuse (2026-08-18; GIF
 * re-confirmed by QA on the dating gallery). Deliberately a deny-list for the
 * same reason as chat attachments: an allow-list wrongly blocked `image/jpg`,
 * and refusing a file the server would have taken is worse than letting the
 * server have the final say.
 */
const REJECTED_IMAGE_TYPES = new Set(['image/gif', 'image/heic', 'image/heif']);

const SUPPORTED_LABEL = 'JPEG, PNG or WebP';

/** The subset of a picker asset this check needs. */
export interface PickedImage {
  uri?: string | null;
  type?: string | null;
  fileSize?: number | null;
  fileName?: string | null;
}

function typeLabel(mime: string, fileName?: string | null): string {
  const subtype = mime.split('/')[1];
  if (subtype) return subtype.toUpperCase();
  const ext = fileName?.split('.').pop();
  return ext ? ext.toUpperCase() : 'That';
}

/**
 * `null` when the image can be sent, otherwise the reason to show the user.
 * Callers check this before uploading — the message is specific enough to act
 * on, which the server's response is not.
 */
export function imageRejectionReason(asset: PickedImage): string | null {
  const mime = canonicalMime(asset.type);

  if (mime && !mime.startsWith('image/')) {
    return `That file is not an image. Please choose a ${SUPPORTED_LABEL} photo.`;
  }

  if (REJECTED_IMAGE_TYPES.has(mime)) {
    return `${typeLabel(mime, asset.fileName)} images are not supported. Please choose a ${SUPPORTED_LABEL} photo.`;
  }

  const size = asset.fileSize ?? 0;
  if (size > MAX_IMAGE_UPLOAD_BYTES) {
    return `That image is ${formatFileSize(size)}. Please choose one under ${MAX_IMAGE_LABEL}.`;
  }

  return null;
}

/** What became of a batch of picked images. */
export interface MultiUploadOutcome {
  /** How many actually reached the server. */
  uploaded: number;
  /** How many were sent for upload (i.e. picked, minus the ones skipped). */
  attempted: number;
  /** Why files were never sent at all — unsupported type, too large. */
  skipped: string[];
  /** The server's reason for refusing, if it stopped the batch. */
  failure?: string | null;
}

/**
 * The alert copy for a multi-image pick, or `null` when everything went
 * through and the user should just see the new photos.
 *
 * A part-succeeded batch is the case worth getting right: the gallery ceiling
 * is enforced server-side and the app can't know it in advance (gap #28), so
 * "3 of 5 photos uploaded" plus the server's own reason is the only honest
 * thing to show.
 */
export function uploadOutcomeAlert(
  outcome: MultiUploadOutcome,
): { title: string; message: string } | null {
  const { uploaded, attempted, failure } = outcome;
  const skipped = [...new Set(outcome.skipped)];
  const parts: string[] = [];

  if (failure) {
    if (uploaded > 0) parts.push(`${uploaded} of ${attempted} photos uploaded.`);
    parts.push(failure);
  }
  if (skipped.length > 0) parts.push(...skipped);

  if (parts.length === 0) return null;

  const title = failure
    ? uploaded > 0
      ? 'Some Photos Not Uploaded'
      : 'Upload Failed'
    : 'Some Photos Skipped';

  return { title, message: parts.join('\n\n') };
}
