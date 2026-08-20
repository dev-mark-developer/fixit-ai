import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { Asset, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import { datingApi, MAX_CHAT_ATTACHMENTS } from '../api/dating';
import type { ChatAttachment, ChatFileType, ChatUploadFile } from '../api/dating';
import { fileTypeFromMime, normalizeFileType } from '../utils/chatMedia';

/**
 * A file chosen (or recorded) on the device and waiting in the composer tray.
 * It becomes a {@link ChatAttachment} once uploaded.
 */
export interface StagedAttachment extends ChatUploadFile {
  /** Stable list key — the local URI can repeat if the same photo is picked twice. */
  key: string;
  fileType: ChatFileType;
  sizeBytes?: number;
  /** Voice notes only; drives the tray label before upload. */
  durationMs?: number;
}

/**
 * Pickers emit non-standard MIME spellings. `react-native-image-picker` builds
 * its type by concatenating a *sniffed extension* onto "image/", so an
 * ordinary JPEG arrives as the bogus `image/jpg` (ImagePickerManager.mm).
 *
 * That matters because `/dating/matches/{id}/uploads` matches its allow-list
 * **exactly and case-sensitively** — verified 2026-08-18, it refuses
 * `image/jpg`, `image/pjpeg` and even `image/JPEG` while accepting
 * `image/jpeg`. Canonicalising here fixes the real upload on Android (where
 * the declared type is what gets sent) as well as the check below.
 */
const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'video/mov': 'video/quicktime',
  'video/mpeg4': 'video/mp4',
  'audio/mp3': 'audio/mpeg',
  'audio/x-mpeg': 'audio/mpeg',
  'audio/x-m4a': 'audio/m4a',
  'audio/mp4': 'audio/m4a',
};

/** Lower-cases, strips any `;codecs=…`, and maps known aliases. */
export function canonicalMime(type?: string | null): string {
  const base = (type ?? '').toLowerCase().split(';')[0].trim();
  return MIME_ALIASES[base] ?? base;
}

/**
 * Types the API is *verified* to refuse (2026-08-18). Deliberately a
 * deny-list, not an allow-list: an allow-list wrongly blocked `image/jpg`,
 * and blocking a file the server would have taken is worse than letting the
 * server have the final say. Anything not listed here is attempted, and a
 * refusal still surfaces the API's own message.
 */
const REJECTED_MIME_TYPES = new Set([
  'image/heic', 'image/heif', 'image/gif',
  'video/x-m4v', 'video/3gpp', 'video/webm',
  'audio/wav', 'audio/vnd.wave', 'audio/ogg', 'audio/3gpp', 'audio/amr', 'audio/x-caf',
]);

export function isSupportedAttachment(file: { type: string }): boolean {
  return !REJECTED_MIME_TYPES.has(canonicalMime(file.type));
}

/** A pick, split into what can be sent and what the API would refuse. */
export interface PickResult {
  accepted: StagedAttachment[];
  rejected: StagedAttachment[];
}

function partitionSupported(items: StagedAttachment[]): PickResult {
  const accepted: StagedAttachment[] = [];
  const rejected: StagedAttachment[] = [];
  items.forEach((item) => (isSupportedAttachment(item) ? accepted : rejected).push(item));
  return { accepted, rejected };
}

/** User-facing explanation for the files that were dropped from a pick. */
export function unsupportedMessage(rejected: StagedAttachment[]): string {
  const kinds = [...new Set(rejected.map((r) => canonicalMime(r.type)))].join(', ');
  return `${rejected.length === 1 ? 'That file' : `${rejected.length} files`} (${kinds}) ` +
    "can't be sent. Photos must be JPEG, PNG or WebP; videos MP4 or MOV.";
}

let sequence = 0;
function nextKey(): string {
  sequence += 1;
  return `staged-${Date.now()}-${sequence}`;
}

/** Turns an image-picker asset into a tray entry. */
function assetToStaged(asset: Asset): StagedAttachment | null {
  if (!asset.uri) return null;
  // Canonical, because the API matches its allow-list exactly — the picker's
  // own `image/jpg` would be refused.
  const mime = canonicalMime(asset.type);
  const fileType = fileTypeFromMime(mime, asset.fileName);
  const fallbackExt = fileType === 'Video' ? 'mp4' : 'jpg';
  return {
    key: nextKey(),
    uri: asset.uri,
    name: asset.fileName || `${fileType.toLowerCase()}-${Date.now()}.${fallbackExt}`,
    // The API sniffs the MIME type, so never let it go up empty.
    type: mime || (fileType === 'Video' ? 'video/mp4' : 'image/jpeg'),
    fileType,
    sizeBytes: asset.fileSize ?? undefined,
    durationMs: asset.duration ? Math.round(asset.duration * 1000) : undefined,
  };
}

export function stageVoiceNote(file: ChatUploadFile, durationMs: number): StagedAttachment {
  return { ...file, key: nextKey(), fileType: 'VoiceNote', durationMs };
}

/**
 * Opens the gallery for photos *and* videos. `remainingSlots` caps the
 * multi-select so the tray can never exceed the hub's 10-file ceiling.
 */
export async function pickFromLibrary(remainingSlots: number): Promise<PickResult> {
  const limit = Math.max(0, Math.min(remainingSlots, MAX_CHAT_ATTACHMENTS));
  if (limit === 0) return { accepted: [], rejected: [] };

  const options: ImageLibraryOptions = {
    mediaType: 'mixed',
    selectionLimit: limit,
    quality: 0.8,
    // Keep uploads sane without visibly degrading a chat-sized photo.
    maxWidth: 1920,
    maxHeight: 1920,
  };

  const result = await launchImageLibrary(options);
  if (result.didCancel || result.errorCode) return { accepted: [], rejected: [] };
  return partitionSupported(
    (result.assets ?? [])
      .map(assetToStaged)
      .filter((a): a is StagedAttachment => a !== null)
      .slice(0, limit),
  );
}

/** Camera capture — photo or video, one at a time. */
export async function pickFromCamera(mediaType: 'photo' | 'video' = 'photo'): Promise<PickResult> {
  const options: CameraOptions = {
    mediaType,
    quality: 0.8,
    maxWidth: 1920,
    maxHeight: 1920,
    saveToPhotos: false,
  };

  const result = await launchCamera(options);
  if (result.didCancel || result.errorCode) return { accepted: [], rejected: [] };
  return partitionSupported(
    (result.assets ?? [])
      .map(assetToStaged)
      .filter((a): a is StagedAttachment => a !== null),
  );
}

/**
 * Uploads the tray in one multipart request and returns the descriptors to
 * hand to `SendMessageWithAttachments`.
 *
 * The response is trusted for `fileUrl`, but `fileType` is re-normalised
 * locally: the hub rejects anything that isn't exactly Image/Video/VoiceNote.
 */
export async function uploadStagedAttachments(
  matchId: number,
  staged: StagedAttachment[],
): Promise<ChatAttachment[]> {
  if (staged.length === 0) return [];

  const response = await datingApi.uploadChatFiles(
    matchId,
    staged.map(({ uri, name, type }) => ({ uri, name, type })),
  );

  const uploaded: any[] = response.data?.data ?? [];
  if (uploaded.length === 0) {
    throw new Error('Upload succeeded but no files came back.');
  }

  return uploaded.map((file, index) => {
    const source = staged[index];
    return {
      fileUrl: file.fileUrl,
      fileType:
        normalizeFileType(file.fileType) ??
        source?.fileType ??
        fileTypeFromMime(source?.type, file.fileName ?? source?.name),
      fileName: file.fileName ?? source?.name ?? null,
      fileSizeBytes: file.fileSizeBytes ?? source?.sizeBytes ?? null,
    };
  });
}
