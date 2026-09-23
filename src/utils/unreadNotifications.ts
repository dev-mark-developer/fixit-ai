import { useCallback, useSyncExternalStore } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';

export type NotificationModule = 'Dating' | 'Penpal' | 'Mentor';

/**
 * Unread notification counts per module, shared by every bell that shows one.
 *
 * Each Dating tab (Discover / Matches / Chats / My Profile) renders its own
 * DatingTopBar, so a count held in component state started at 0 on every tab
 * and the badge popped in once that tab's request came back. Kept here, a
 * freshly mounted header shows the last known count straight away, and a
 * refresh only re-renders when the server's number actually changed.
 */
const counts: Partial<Record<NotificationModule, number>> = {};
const inFlight: Partial<Record<NotificationModule, Promise<void>>> = {};
const listeners = new Set<() => void>();

function setCount(module: NotificationModule, value: number): void {
  if (counts[module] === value) return;
  counts[module] = value;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The last known count; 0 until the first load. */
export function getUnreadCount(module: NotificationModule): number {
  return counts[module] ?? 0;
}

/** `GET /notifications/unread-count?module=…`; overlapping calls share one request. */
export function refreshUnreadCount(module: NotificationModule): Promise<void> {
  if (!inFlight[module]) {
    inFlight[module] = api.get('/notifications/unread-count', { params: { module } })
      .then((res) => setCount(module, res.data?.data ?? 0))
      // Keep the last known count rather than dropping the badge on a failure.
      .catch(() => {})
      .finally(() => { delete inFlight[module]; });
  }
  return inFlight[module]!;
}

/**
 * Nudges a count after a local change (a notification marked read, or that
 * mark reverted) so every bell agrees without waiting for a refetch.
 */
export function adjustUnreadCount(module: NotificationModule, delta: number): void {
  const current = counts[module];
  if (current === undefined) return;
  setCount(module, Math.max(0, current + delta));
}

/** On sign-out, so the next account doesn't inherit this one's counts. */
export function clearUnreadCounts(): void {
  (Object.keys(counts) as NotificationModule[]).forEach((m) => { delete counts[m]; });
  listeners.forEach((l) => l());
}

/** The module's unread count, refreshed each time the calling screen gains focus. */
export function useUnreadNotificationCount(module: NotificationModule): number {
  const count = useSyncExternalStore(subscribe, () => getUnreadCount(module));

  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount(module);
    }, [module]),
  );

  return count;
}
