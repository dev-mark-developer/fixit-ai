import { PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { Asset, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import { datingApi, MAX_CHAT_ATTACHMENTS } from '../api/dating';
import type { ChatAttachment, ChatFileType, ChatUploadFile } from '../api/dating';
import { fileTypeFromMime, normalizeFileType } from '../utils/chatMedia';
import { canonicalMime } from '../utils/mime';

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

/** Why a pick produced nothing. Cancelling is not a failure and has none. */
export type PickFailure = 'permission' | 'unavailable' | 'error';

/** A pick, split into what can be sent and what the API would refuse. */
export interface PickResult {
  accepted: StagedAttachment[];
  rejected: StagedAttachment[];
  /**
   * Set when the picker never got as far as returning files. Previously any
   * `errorCode` was swallowed, so denying camera access made "Take Photo" do
   * nothing at all — no camera, no explanation.
   */
  failure?: PickFailure;
}

function failureFrom(errorCode: string): PickFailure {
  if (errorCode === 'permission') return 'permission';
  if (errorCode === 'camera_unavailable') return 'unavailable';
  return 'error';
}

/**
 * Without camera access, opening the camera shows a dead black viewfinder
 * that can still "take" a blank photo — QA reported it on both platforms.
 *
 * - Android: `react-native-image-picker` deliberately doesn't ask (this app
 *   declares CAMERA in its manifest, so the OS wants the runtime grant), so
 *   it is asked for here.
 * - iOS: 8.2.1 has a permission check but never calls it; it is wired in by
 *   `patches/react-native-image-picker+8.2.1.patch` (applied on install by
 *   patch-package), which returns the `permission` error instead.
 */
async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return status === PermissionsAndroid.RESULTS.GRANTED;
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
  if (result.didCancel) return { accepted: [], rejected: [] };
  if (result.errorCode) {
    return { accepted: [], rejected: [], failure: failureFrom(result.errorCode) };
  }
  return partitionSupported(
    (result.assets ?? [])
      .map(assetToStaged)
      .filter((a): a is StagedAttachment => a !== null)
      .slice(0, limit),
  );
}

/**
 * Camera capture — one photo. Recording a video from chat was removed on
 * request; videos already in the library can still be sent.
 */
export async function pickFromCamera(): Promise<PickResult> {
  const options: CameraOptions = {
    mediaType: 'photo',
    quality: 0.8,
    maxWidth: 1920,
    maxHeight: 1920,
    saveToPhotos: false,
  };

  if (!(await ensureCameraPermission())) {
    return { accepted: [], rejected: [], failure: 'permission' };
  }

  const result = await launchCamera(options);
  if (result.didCancel) return { accepted: [], rejected: [] };
  if (result.errorCode) {
    return { accepted: [], rejected: [], failure: failureFrom(result.errorCode) };
  }
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
