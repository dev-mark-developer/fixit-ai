import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  EventType,
  TriggerType,
} from '@notifee/react-native';
import type { Event, TimestampTrigger } from '@notifee/react-native';
import type { PushPayload } from '../types/notifications';

/**
 * Notifications the app raises itself — immediately or on a schedule.
 *
 * This is also what makes **remote** notifications visible while the app is
 * open: FCM hands a foreground message straight to JS and displays nothing,
 * so `pushNotifications` routes those through `displayLocalNotification`.
 */

/**
 * Must match `messaging_android_notification_channel_id` in `firebase.json`,
 * so notifications pushed by the backend land in the same channel as local
 * ones. Android silently drops notifications naming a channel that was never
 * created — `ensureNotificationChannel()` is what creates it.
 */
export const DEFAULT_CHANNEL_ID = 'fixit_default';

let channelPromise: Promise<string> | null = null;

/** Creates the default Android channel. No-op on iOS; safe to call repeatedly. */
export function ensureNotificationChannel(): Promise<string> {
  if (Platform.OS !== 'android') return Promise.resolve('');
  if (!channelPromise) {
    channelPromise = notifee
      .createChannel({
        id: DEFAULT_CHANNEL_ID,
        name: 'General',
        description: 'Messages, matches and app updates',
        // HIGH is what makes a notification appear as a heads-up banner.
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PRIVATE,
        vibration: true,
      })
      .catch((err) => {
        // Let a later call retry rather than caching the failure forever.
        channelPromise = null;
        throw err;
      });
  }
  return channelPromise;
}

export interface LocalNotification {
  title?: string;
  body?: string;
  /** Deep-link keys — same contract as an FCM payload's `data`. */
  data?: Record<string, string>;
  /** Reuse an id to replace an existing notification instead of stacking. */
  id?: string;
}

function toNotifeeNotification(notification: LocalNotification) {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    android: {
      channelId: DEFAULT_CHANNEL_ID,
      // Falls back to the app icon; see docs/PUSH_NOTIFICATIONS.md for why a
      // dedicated monochrome `ic_notification` would be better.
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default' },
    },
    ios: {
      // iOS suppresses banners for foreground notifications unless asked.
      foregroundPresentationOptions: { banner: true, list: true, sound: true },
    },
  };
}

/** Shows a notification immediately. Resolves to its id. */
export async function displayLocalNotification(notification: LocalNotification): Promise<string> {
  await ensureNotificationChannel();
  return notifee.displayNotification(toNotifeeNotification(notification));
}

/**
 * Shows a notification at `date`. Uses an inexact trigger, which Android may
 * defer by a few minutes under Doze — exact timing would need the
 * `SCHEDULE_EXACT_ALARM` permission, which isn't worth it for reminders.
 */
export async function scheduleLocalNotification(
  notification: LocalNotification,
  date: Date,
): Promise<string> {
  await ensureNotificationChannel();
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) throw new Error('Invalid notification date.');
  if (timestamp <= Date.now()) {
    // Android rejects a trigger in the past; showing it now is the sane read
    // of "notify me at a time that has already passed".
    return displayLocalNotification(notification);
  }

  const trigger: TimestampTrigger = { type: TriggerType.TIMESTAMP, timestamp };
  return notifee.createTriggerNotification(toNotifeeNotification(notification), trigger);
}

export function cancelLocalNotification(id: string): Promise<void> {
  return notifee.cancelNotification(id);
}

export function cancelAllLocalNotifications(): Promise<void> {
  return notifee.cancelAllNotifications();
}

/** Ids of notifications scheduled but not yet fired. */
export function getScheduledNotificationIds(): Promise<string[]> {
  return notifee.getTriggerNotificationIds();
}

/** Clears the iOS app-icon badge (and the shade on Android). */
export async function clearNotificationBadge(): Promise<void> {
  try {
    await notifee.setBadgeCount(0);
  } catch {
    // Not supported everywhere; nothing depends on it succeeding.
  }
}

// ── Taps ────────────────────────────────────────────────────────────────────

function eventToPayload(event: Event): PushPayload {
  const notification = event.detail.notification;
  const data: Record<string, string> = {};
  Object.entries(notification?.data ?? {}).forEach(([key, value]) => {
    data[key] = typeof value === 'string' ? value : JSON.stringify(value);
  });
  return { title: notification?.title, body: notification?.body, data };
}

/**
 * A press that arrived while the app was backgrounded. The background handler
 * runs before any screen can subscribe, so the payload waits here for
 * `onLocalNotificationTap` to pick it up once the UI is listening.
 */
let pendingPress: PushPayload | null = null;

/**
 * Registers the handler notifee needs for events raised while the app is
 * backgrounded. Call from `index.js` at module scope — notifee warns if no
 * handler is registered by the time an event fires.
 */
export function registerLocalBackgroundHandler(): void {
  notifee.onBackgroundEvent(async (event) => {
    if (event.type === EventType.PRESS) {
      pendingPress = eventToPayload(event);
    }
  });
}

/**
 * Subscribes to notification presses: while the app is open, one that
 * happened while it was backgrounded, and one that launched it from cold.
 */
export function onLocalNotificationTap(handler: (payload: PushPayload) => void): () => void {
  const unsubscribe = notifee.onForegroundEvent((event) => {
    if (event.type === EventType.PRESS) handler(eventToPayload(event));
  });

  // Launched by pressing a notification while the app was killed.
  notifee
    .getInitialNotification()
    .then((initial) => {
      if (!initial) return;
      const data: Record<string, string> = {};
      Object.entries(initial.notification?.data ?? {}).forEach(([key, value]) => {
        data[key] = typeof value === 'string' ? value : JSON.stringify(value);
      });
      handler({
        title: initial.notification?.title,
        body: initial.notification?.body,
        data,
      });
    })
    .catch(() => {});

  if (pendingPress) {
    const payload = pendingPress;
    pendingPress = null;
    handler(payload);
  }

  return unsubscribe;
}
