/**
 * Pickers emit non-standard MIME spellings. `react-native-image-picker` builds
 * its type by concatenating a *sniffed extension* onto "image/", so an
 * ordinary JPEG arrives as the bogus `image/jpg` (ImagePickerManager.mm).
 *
 * That matters because the upload endpoints match their allow-list **exactly
 * and case-sensitively** — verified 2026-08-18 against
 * `/dating/matches/{id}/uploads`, which refuses `image/jpg`, `image/pjpeg` and
 * even `image/JPEG` while accepting `image/jpeg`. Canonicalising here fixes the
 * real upload on Android (where the declared type is what gets sent) as well as
 * any client-side check.
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
