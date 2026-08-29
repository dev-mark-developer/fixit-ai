import { PermissionsAndroid, Platform } from 'react-native';
import { getApps } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  deleteToken,
  getInitialNotification,
  getMessaging,
  getToken,
  hasPermission,
  isDeviceRegisteredForRemoteMessages,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import type { RemoteMessage } from '@react-native-firebase/messaging';
import { authApi } from '../api/auth';
import { getDeviceId } from '../utils/device';
import { displayLocalNotification, onLocalNotificationTap } from './localNotifications';
import type { PushPayload } from '../types/notifications';

/**
 * Everything here is a no-op until a Firebase config file is present
 * (`android/app/google-services.json` / `ios/GoogleService-Info.plist`).
 * Those can only come from the Firebase console, so the whole module is
 * written to degrade quietly rather than crash a build that doesn't have
 * them yet — see docs/PUSH_NOTIFICATIONS.md.
 */
export function isPushAvailable(): boolean {
  try {
    return getApps().length > 0;
  } catch {
    return false;
  }
}

/**
 * Dev-only console logging, same shape as the API logger in `src/api/logging.ts`.
 *
 * The token is printed in full and unmasked so it can be copied out of Metro
 * and pasted into the Firebase console to target a test send — that's the
 * whole point of having it here. It's a device identifier, so keep it behind
 * `__DEV__`: release builds print nothing.
 */
function log(message: string, extra?: unknown): void {
  if (!__DEV__) return;
  if (extra === undefined) console.log(`🔔 [Push] ${message}`);
  else console.log(`🔔 [Push] ${message}`, extra);
}

/** Re-exported so existing importers don't have to care where it moved to. */
export type { PushPayload };

/** Normalises an FCM payload so callers don't depend on RNFB types. */
export function toPushPayload(message: RemoteMessage): PushPayload {
  const data: Record<string, string> = {};
  Object.entries(message?.data ?? {}).forEach(([key, value]) => {
    data[key] = typeof value === 'string' ? value : JSON.stringify(value);
  });
  return { title: message?.notification?.title, body: message?.notification?.body, data };
}

// ── Permission ──────────────────────────────────────────────────────────────

/**
 * Asks for notification permission.
 *
 * Android 13 (API 33) gated notifications behind a runtime permission; below
 * that it's granted at install time. iOS always prompts, and returns
 * "provisional" for quiet delivery, which still yields a token.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushAvailable()) return false;

  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return true;
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (await PermissionsAndroid.check(permission)) return true;
    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  // Deprecated in RNFB v26 in favour of react-native-permissions, but still
  // functional and avoids pulling in another native module just for this.
  const status = await requestPermission(getMessaging());
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

/** Current permission state without prompting. */
export async function hasNotificationPermission(): Promise<boolean> {
  if (!isPushAvailable()) return false;
  try {
    if (Platform.OS === 'android') {
      if (Number(Platform.Version) < 33) return true;
      return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    const status = await hasPermission(getMessaging());
    return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

// ── Token ───────────────────────────────────────────────────────────────────

/**
 * The device's FCM registration token, or null if push isn't set up, the user
 * declined, or the device has no Play Services. Callers must treat null as
 * "no push for this device" rather than an error.
 */
export async function getPushToken(): Promise<string | null> {
  if (!isPushAvailable()) {
    // Much easier to spot than a silent null when push "just doesn't work".
    log('no Firebase app — add the config file (see docs/PUSH_NOTIFICATIONS.md)');
    return null;
  }
  try {
    const messaging = getMessaging();

    // iOS can only mint an FCM token once it holds an APNs token. RNFB
    // registers for remote messages automatically, so we only *observe* that
    // here rather than driving it: calling registerDeviceForRemoteMessages()
    // is what produced `messaging/registration-timeout`, because it blocks
    // waiting on an APNs response that never comes on the Simulator.
    if (Platform.OS === 'ios' && !isDeviceRegisteredForRemoteMessages(messaging)) {
      log('APNs registration has not completed yet — a token may not be available');
    }

    const token = (await getToken(messaging)) || null;
    // On its own line so it can be selected and copied cleanly from Metro.
    if (token) log(`FCM token (${token.length} chars):\n${token}`);
    else log('FCM returned an empty token');
    return token;
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    log(`could not get an FCM token — ${message}`);
    if (Platform.OS === 'ios' && /apns|registration|unregistered|timed out/i.test(message)) {
      log(
        'iOS checklist: APNs registration needs a REAL DEVICE (the Simulator ' +
        'usually cannot complete it), the Push Notifications capability in ' +
        'Xcode, an APNs key uploaded to Firebase, and notifications allowed.',
      );
    }
    return null;
  }
}

/**
 * Pushes the current token to the backend.
 *
 * `POST /auth/heartbeat { deviceId, pushToken }` is the only endpoint that
 * accepts a token outside of login/register, so it doubles as the "my token
 * changed" channel. Safe to call repeatedly.
 */
export async function syncPushToken(token?: string | null): Promise<void> {
  const pushToken = token ?? (await getPushToken());
  if (!pushToken) return;
  const deviceId = await getDeviceId();
  try {
    await authApi.heartbeat(deviceId, pushToken);
    log(`token synced to backend for device ${deviceId}`);
  } catch (err) {
    // Callers deliberately swallow this; without a line here a failed sync
    // would be completely invisible.
    log(`token sync FAILED — ${(err as Error)?.message ?? String(err)}`);
    throw err;
  }
}

/**
 * Drops the device's token so it stops receiving notifications for the
 * account that just signed out. The next sign-in mints a fresh one.
 */
export async function clearPushToken(): Promise<void> {
  if (!isPushAvailable()) return;
  try {
    await deleteToken(getMessaging());
  } catch {
    // Nothing to delete, or no Play Services — either way there's no token.
  }
}

/**
 * Keeps the backend up to date when FCM rotates the token (app restore, data
 * clear, token expiry). Returns an unsubscribe.
 */
export function watchPushToken(): () => void {
  if (!isPushAvailable()) return () => {};
  try {
    return onTokenRefresh(getMessaging(), (token) => {
      log(`FCM token refreshed (${token.length} chars):\n${token}`);
      syncPushToken(token).catch(() => {
        // Offline or 401 — login and the next refresh will retry.
        // `syncPushToken` has already logged the reason.
      });
    });
  } catch {
    return () => {};
  }
}

// ── Delivery ────────────────────────────────────────────────────────────────

export type PushHandler = (payload: PushPayload) => void;

/**
 * Registers the handler FCM invokes when the app is in the background or
 * killed. Must run at module scope in `index.js`, before the app renders —
 * the JS context for a background message has no component tree.
 */
export function registerBackgroundHandler(handler?: PushHandler): void {
  if (!isPushAvailable()) return;
  try {
    setBackgroundMessageHandler(getMessaging(), async (message) => {
      const payload = toPushPayload(message);
      // A message carrying a `notification` block is drawn by the OS itself
      // while we're backgrounded — displaying it again would show it twice.
      // Data-only messages are never drawn, so those we raise ourselves.
      if (!message.notification) {
        await displayLocalNotification(payload).catch((err) => {
          log(`could not display a background notification — ${(err as Error)?.message ?? err}`);
        });
      }
      handler?.(payload);
    });
  } catch {
    // Firebase isn't configured; nothing will be delivered anyway.
  }
}

/**
 * Subscribes to messages that arrive while the app is open.
 *
 * Neither platform draws a system notification for these — FCM hands the
 * payload straight to JS — so each one is re-raised through notifee. That is
 * the only reason a foreground push is visible at all.
 */
export function onForegroundMessage(handler?: PushHandler): () => void {
  if (!isPushAvailable()) return () => {};
  try {
    return onMessage(getMessaging(), async (message) => {
      const payload = toPushPayload(message);
      log(`foreground message received: ${payload.title ?? '(no title)'}`);
      // Swallowing this is what made a broken foreground notification look
      // like a message that never arrived — the re-raise is the only thing
      // that draws it, so a failure here has to be visible.
      await displayLocalNotification(payload).catch((err) => {
        log(`could not display a foreground notification — ${(err as Error)?.message ?? err}`);
      });
      handler?.(payload);
    });
  } catch {
    return () => {};
  }
}

/**
 * Fires when a notification is tapped: once for taps that resume a
 * backgrounded app, and once at startup if a tap launched the app from cold.
 */
export function onNotificationTap(handler: PushHandler): () => void {
  // Both sources are needed, and they can't double-fire: a notification drawn
  // by notifee reports its tap through notifee, one drawn by the OS from an
  // FCM `notification` payload reports through FCM. Since foreground pushes
  // are re-raised via notifee, their taps arrive on the local path.
  //
  // Subscribed before the Firebase check because local notifications work
  // whether or not Firebase is configured.
  const unsubscribeLocal = onLocalNotificationTap(handler);
  if (!isPushAvailable()) return unsubscribeLocal;

  try {
    const messaging = getMessaging();

    getInitialNotification(messaging)
      .then((message) => { if (message) handler(toPushPayload(message)); })
      .catch(() => {});

    const unsubscribeRemote = onNotificationOpenedApp(
      messaging,
      (message) => handler(toPushPayload(message)),
    );
    return () => {
      unsubscribeLocal();
      unsubscribeRemote();
    };
  } catch {
    return unsubscribeLocal;
  }
}
