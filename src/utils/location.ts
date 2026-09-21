import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

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
  // iOS calls back as soon as the user answers, or straight away if they
  // already have.
  return new Promise<boolean>((resolve) => {
    Geolocation.requestAuthorization(() => resolve(true), () => resolve(false));
  });
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

  const granted = await requestLocationPermission().catch(() => false);
  if (!granted) {
    refused = true;
    return null;
  }

  return new Promise<Coords | null>((resolve) => {
    let settled = false;
    const finish = (value: Coords | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    // The native timeout isn't always honoured — Android with location switched
    // off can simply go quiet — so the caller gets its own ceiling.
    const timer = setTimeout(() => finish(cached?.coords ?? null), timeout + 500);

    Geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        const coords: Coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        cached = { coords, at: Date.now() };
        finish(coords);
      },
      () => {
        clearTimeout(timer);
        finish(cached?.coords ?? null);
      },
      { enableHighAccuracy: false, timeout, maximumAge: CACHE_MS },
    );
  });
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
