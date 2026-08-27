import { useEffect } from 'react';
import { Image } from 'react-native';
import { resolveImageUrl } from './imageUrl';

/**
 * Session-scoped record of image URLs that have already been decoded once.
 *
 * React Native's <Image> caches bitmaps natively (Fresco on Android,
 * NSURLCache on iOS), so remounting a screen usually re-reads from cache
 * rather than re-downloading. What it does *not* do is tell us that, so
 * every remount used to flash a spinner even on an instant cache hit.
 *
 * Tracking the URLs we've seen lets a remount render the bitmap directly,
 * with no placeholder frame. It's deliberately session-scoped: the native
 * caches survive a restart, but we can't inspect them, so after a cold
 * start the first paint of each image shows a spinner again.
 */
const MAX_TRACKED = 500;
const seen = new Set<string>();

/** True when this URL has painted before, i.e. we can skip the spinner. */
export function hasLoaded(url?: string | null): boolean {
  return !!url && seen.has(url);
}

export function markLoaded(url?: string | null): void {
  if (!url) return;
  // Set preserves insertion order, so the oldest entry is the first key.
  if (seen.size >= MAX_TRACKED) {
    const oldest = seen.values().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
  seen.add(url);
}

/**
 * Warm the native cache for a batch of URLs — call it when a list's data
 * arrives so rows paint filled instead of spinning as they scroll into view.
 * Failures are swallowed: a dead link just means the row falls back to its
 * spinner-then-fallback path, same as if we'd never prefetched.
 */
export function prefetchImages(urls: Array<string | null | undefined>): void {
  for (const raw of urls) {
    const url = resolveImageUrl(raw);
    if (!url || seen.has(url)) continue;
    Image.prefetch(url)
      .then(ok => { if (ok !== false) markLoaded(url); })
      .catch(() => {});
  }
}

/**
 * Prefetch a list's images whenever the list changes. Takes raw API URLs
 * (relative or absolute) — they're resolved the same way <RemoteImage> does,
 * so a warmed URL is recognised as already-loaded when the row renders.
 */
export function usePrefetchImages(urls: Array<string | null | undefined>): void {
  // The array is rebuilt every render; the joined URLs are what actually change.
  const key = urls.join('\u0000');
  useEffect(() => {
    prefetchImages(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Drop the record — call on logout so a new user doesn't inherit it. */
export function clearImageCacheRecord(): void {
  seen.clear();
}
