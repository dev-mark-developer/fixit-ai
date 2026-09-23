import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { withTimeout } from './withTimeout';

/**
 * The device's position, sent with sign-up / sign-in (`latitude` / `longitude`
 * on `POST /auth/register` and `POST /auth/login`) and with `GET /dating/discover`,
 * where the API sorts and filters the deck by distance.
 *
 * It is always optional: a refusal, location switched off or a slow fix leaves
 * the fields out rather than holding up sign-in or the deck.
 */
export interface Coords {
  latitude: number;
  longitude: number;
}

/**
 * The prompt is ours to raise: Android goes through `PermissionsAndroid`, like
 * the camera and microphone do, and iOS is asked explicitly below.
 */
Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
  enableBackgroundLocationUpdates: false,
});

/** The last fix, so a screen refresh doesn't wake the GPS again. */
let cached: { coords: Coords; at: number } | null = null;
const CACHE_MS = 5 * 60_000;

/** Set once the user says no, so every later call stops re-prompting. */
let refused = false;

/** iOS: this run's permission request, pending or answered (see below). */
let iosPermission: Promise<boolean> | null = null;

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    // Approximate location is enough for a distance filter, so an "only
    // approximate" grant counts as granted.
    if (await PermissionsAndroid.check(fine)) return true;
    if (await PermissionsAndroid.check(coarse)) return true;
    const result = await PermissionsAndroid.request(fine);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  // The iOS library answers only when the authorization *changes*: the first
  // call is answered (iOS reports the status when the location manager is
  // created, and again when the user picks), but a later call waits for a
  // change that never comes. That left sign-in spinning forever once the
  // 5-minute cache had lapsed. So iOS is asked once per run and every caller
  // shares the answer; a later refusal in Settings still shows up, as an error
  // from getCurrentPosition.
  if (!iosPermission) {
    iosPermission = new Promise<boolean>((resolve) => {
      Geolocation.requestAuthorization(() => resolve(true), () => resolve(false));
    });
  }
  return iosPermission;
}

/**
 * The current position, or null when it can't be had — permission refused,
 * location off, or the fix took too long. Never throws, so callers can send the
 * fields only when they arrived.
 *
 * @param options.timeoutMs how long to wait for a fix (default 8s)
 * @param options.force ignore the cache, and ask again after an earlier refusal
 */
export async function getCurrentCoords(
  options?: { timeoutMs?: number; force?: boolean },
): Promise<Coords | null> {
  const timeout = options?.timeoutMs ?? 8000;

  if (options?.force) refused = false;
  else if (cached && Date.now() - cached.at < CACHE_MS) return cached.coords;

  if (refused) return cached?.coords ?? null;

  const lookup = (async (): Promise<Coords | null> => {
    const granted = await requestLocationPermission().catch(() => false);
    if (!granted) {
      refused = true;
      return null;
    }
    return new Promise<Coords | null>((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const coords: Coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          cached = { coords, at: Date.now() };
          resolve(coords);
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout, maximumAge: CACHE_MS },
      );
    });
  })();

  // One ceiling over the whole lookup, the permission step included. Neither
  // native call is guaranteed to answer — the iOS permission call above, or
  // Android with location switched off — and a caller like sign-in must not
  // wait on them. A permission prompt still up keeps going in the background.
  const coords = await withTimeout(lookup, timeout + 500, null);
  return coords ?? cached?.coords ?? null;
}

/**
 * Asks at app launch, next to the notification prompt, and warms the cache with
 * a first fix so sign-in, sign-up and Discover find coordinates ready rather
 * than prompting mid-flow. Never throws and is never awaited — fire and forget.
 */
export async function primeLocation(): Promise<void> {
  await getCurrentCoords();
}

/** The last fix without asking for a new one — for callers that must not wait. */
export function lastKnownCoords(): Coords | null {
  return cached?.coords ?? null;
}
