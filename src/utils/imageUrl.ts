import { API_ORIGIN } from '../api/axios';

/**
 * Image URLs from the API are sometimes relative (e.g. "/uploads/x.jpg").
 * React Native's <Image> silently renders nothing for those, so resolve
 * them against the API host.
 *
 * Anything that already carries a scheme passes through untouched — http(s)
 * from the API, plus the file:// / content:// / ph:// / data: URIs the image
 * picker hands back for a freshly chosen local photo.
 */
export function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}
