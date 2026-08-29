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
/**
 * How many prefetches may be in flight at once.
 *
 * Images come from the same host as the API and share one HTTP/2 connection
 * with it, so firing a whole page at once (a 20-row list fired 20) put the
 * screen's own API calls behind a burst of downloads. Four keeps the cache
 * warming without the list's request queueing behind its own thumbnails.
 */
const MAX_CONCURRENT_PREFETCH = 4;

const queue: string[] = [];
let inFlight = 0;

function pump(): void {
  while (inFlight < MAX_CONCURRENT_PREFETCH && queue.length > 0) {
    const url = queue.shift() as string;
    inFlight += 1;
    Image.prefetch(url)
      .then(ok => { if (ok !== false) markLoaded(url); })
      .catch(() => {})
      .finally(() => {
        inFlight -= 1;
        pump();
      });
  }
}

export function prefetchImages(urls: Array<string | null | undefined>): void {
  for (const raw of urls) {
    const url = resolveImageUrl(raw);
    // `queue.includes` guards against a list that re-renders before its
    // first batch has drained; the queue is at most a page long.
    if (!url || seen.has(url) || queue.includes(url)) continue;
    queue.push(url);
  }
  pump();
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
