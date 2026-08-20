import { Platform } from 'react-native';
import type { ChatUploadFile } from '../api/dating';

/**
 * iOS silently discards the `type` you put on a `{uri, name, type}` form part.
 *
 * `RCTNetworking.mm` fetches the local file through `RCTFileRequestHandler.mm`,
 * which derives a MIME type from the **file extension** via UTI, then
 * overwrites the part's `content-type` header with it. So a `.m4a` recording
 * always uploads as `audio/x-m4a` (Apple's UTI for `com.apple.m4a-audio`)
 * no matter what we declare.
 *
 * That matters because `/dating/matches/{id}/uploads` does not accept the
 * `audio/*` wildcard its docs promise — verified against the API 2026-08-18,
 * it allows exactly:
 *
 *   audio  →  audio/m4a · audio/aac · audio/mpeg
 *   image  →  image/jpeg · image/png · image/webp
 *   video  →  video/mp4 · video/quicktime
 *
 * `audio/x-m4a` is not on that list, so every voice note was rejected with
 * "Attachment type 'audio/x-m4a' is not allowed."
 *
 * A `base64` part takes a different branch in `processDataForHTTPQuery` that
 * returns no `contentType`, so the header we set from `type` survives intact.
 * Android already honours `type` (`NetworkingModule.constructMultipartBody`
 * parses it straight off the part headers), and base64 costs memory
 * proportional to the file, so this is used only where it's actually needed.
 */
function needsDeclaredType(file: ChatUploadFile): boolean {
  // Voice notes only. Photos are re-encoded to .jpg/.png by the image picker
  // and videos arrive as .mp4/.mov — all of which derive an accepted type.
  return Platform.OS === 'ios' && file.type.toLowerCase().startsWith('audio/');
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.onloadend = () => {
      // readAsDataURL gives "data:<mime>;base64,<payload>" — we want the payload.
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Builds the object to hand to `FormData.append`. Falls back to the ordinary
 * `{uri}` part if the file can't be read — that's still the right shape
 * everywhere except the iOS-audio case above.
 */
export async function buildUploadPart(file: ChatUploadFile): Promise<object> {
  const plain = { uri: file.uri, name: file.name, type: file.type };
  if (!needsDeclaredType(file)) return plain;

  try {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);
    if (!base64) return plain;
    return { base64, name: file.name, type: file.type };
  } catch {
    return plain;
  }
}
