import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseApiDate } from './datetime';
import type { DatingConfig, SwipeResult } from '../api/dating';

/**
 * Daily allowances on Discover. The admin panel sets how many swipes and how
 * many super likes an account gets per day, with separate numbers for free and
 * premium. A super like also uses up a swipe (verified on beta 2026-09-14).
 *
 * The app learns where it stands two ways (docs/BACKEND_LIKE_LIMITS.md):
 * - a successful `POST /dating/swipe` returns today's counters and `resetsAt`,
 *   so ♥/⭐ dim the moment an allowance runs out;
 * - before any counters have come back, a refused swipe does the same (see
 *   `isLimitRefusal`). `GET /dating/config` has the limits but not today's usage.
 *
 * What it learns is saved on the device with its reset time, so closing and
 * reopening the app doesn't forget a limit until the next refused swipe.
 *
 * A pass uses up a swipe as well (verified 2026-09-14), so once the swipes are
 * gone ✕ is blocked along with ♥ (decided 2026-09-14).
 */

export type SwipeAction = 'Like' | 'SuperLike' | 'Ignore';
export type SwipeLimit = 'like' | 'superLike';

/**
 * When each allowance comes back (epoch ms); null while it isn't spent. `like`
 * is the daily swipes, which ♥ and ✕ both draw on; `superLike` is ⭐'s own.
 */
export interface ReachedLimits {
  like: number | null;
  superLike: number | null;
}

const NONE_REACHED: ReachedLimits = { like: null, superLike: null };

const STORAGE_KEY = 'swipe_limits_v1';

/** The allowance a swipe draws on: a like and a pass both use the daily swipes. */
export function limitFor(action: SwipeAction): SwipeLimit {
  return action === 'SuperLike' ? 'superLike' : 'like';
}

/**
 * Whether `POST /dating/swipe` refused because an allowance is spent.
 *
 * The contract agreed with the client was 402/403 (gap #22), but the live API
 * answers **400** with only a sentence to go on — verified 2026-09-11, and still
 * the case after the backend update on 2026-09-14:
 *
 *   { "success": false, "errors": null,
 *     "message": "You have reached your daily limit of 1 super likes. Upgrade to Premium for more." }
 *
 * 400 is also what validation failures use, so the wording is the only tell
 * until the backend adds an error code — hence the match on "daily limit".
 */
export function isLimitRefusal(err: unknown): boolean {
  const res = (err as any)?.response;
  if (res?.status === 402 || res?.status === 403) return true;
  return res?.status === 400 && /daily limit/i.test(String(res.data?.message ?? ''));
}

/**
 * When a limit reached now stops applying: the `resetsAt` a swipe response gave,
 * or else the next midnight UTC — which is what `resetsAt` has been (verified
 * 2026-09-14: "2026-09-15T00:00:00Z").
 */
export function limitExpiry(resetsAt?: string | null, now: Date = new Date()): number {
  const serverReset = parseApiDate(resetsAt).getTime();
  if (!Number.isNaN(serverReset) && serverReset > now.getTime()) return serverReset;
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

/**
 * What a successful swipe's counters say about each button: true when its
 * allowance is used up, false when some is left, undefined when the response
 * doesn't say (e.g. an unlimited `null`). Running out of swipes stops super
 * likes too, since a super like uses up a swipe.
 */
export function allowancesFromCounters(
  result?: SwipeResult | null,
): { like?: boolean; superLike?: boolean } {
  const swipesLeft = result?.swipesRemainingToday;
  const superLikesLeft = result?.superLikesRemainingToday;
  const swipesOut = typeof swipesLeft === 'number' ? swipesLeft <= 0 : undefined;
  const superLikesOut = typeof superLikesLeft === 'number' ? superLikesLeft <= 0 : undefined;

  let superLike: boolean | undefined;
  if (swipesOut || superLikesOut) superLike = true;
  else if (swipesOut === false && superLikesOut === false) superLike = false;

  return { like: swipesOut, superLike };
}

/**
 * Drops any limit whose reset time has come, returning the same object when
 * nothing changed.
 */
export function clearExpiredLimits(reached: ReachedLimits, now: number): ReachedLimits {
  const like = reached.like !== null && reached.like > now ? reached.like : null;
  const superLike = reached.superLike !== null && reached.superLike > now ? reached.superLike : null;
  return like === reached.like && superLike === reached.superLike
    ? reached
    : { like, superLike };
}

/** What a relaunch gets back: the limits, and whether they were reached on premium. */
export interface StoredLimits {
  reached: ReachedLimits;
  premium: boolean;
}

/**
 * Reads the saved limits back, keeping only the signed-in user's and only those
 * that haven't reset yet. Null when there is nothing usable.
 */
export function readStoredLimits(raw: string | null, userId: number, now: number): StoredLimits | null {
  if (!raw) return null;
  let saved: any;
  try {
    saved = JSON.parse(raw);
  } catch {
    return null;
  }
  if (saved?.userId !== userId) return null;

  const expiry = (value: unknown) => (typeof value === 'number' ? value : null);
  const reached = clearExpiredLimits(
    { like: expiry(saved.like), superLike: expiry(saved.superLike) },
    now,
  );
  if (reached.like === null && reached.superLike === null) return null;
  return { reached, premium: saved.premium === true };
}

/**
 * The free plan's daily allowances, worded for a features list. The numbers
 * come from the admin panel via `GET /dating/config`; without them the lines
 * leave the number out rather than show a guess.
 */
export function freeAllowanceLines(config?: DatingConfig | null): [string, string] {
  const swipes = config?.freeSwipesPerDay;
  const superLikes = config?.freeSuperLikesPerDay;
  return [
    typeof swipes === 'number'
      ? `${swipes} free ${swipes === 1 ? 'swipe' : 'swipes'} per day`
      : 'Free swipes every day',
    typeof superLikes === 'number'
      ? `${superLikes} ${superLikes === 1 ? 'super like' : 'super likes'} per day`
      : 'Super likes every day',
  ];
}

/**
 * Which of today's allowances have run out, for the signed-in user.
 *
 * Discover stays mounted in the drawer, so a limit kept in plain state would
 * outlive the reset. Expired limits are dropped whenever the app returns to the
 * foreground; the screen also calls `clearExpired` on focus.
 */
export function useSwipeLimits(isPremium: boolean, userId?: number | null) {
  const [reached, setReachedState] = useState<ReachedLimits>(NONE_REACHED);
  // Swipe handlers check this between renders, so it is written in step with
  // the state rather than after it.
  const reachedRef = useRef(reached);

  const userIdRef = useRef(userId);
  const isPremiumRef = useRef(isPremium);
  useEffect(() => { isPremiumRef.current = isPremium; }, [isPremium]);

  // Whether the current limits were reached on premium. Buying premium lifts
  // only limits reached on the free plan.
  const reachedAsPremiumRef = useRef(false);

  // The latest `resetsAt` a swipe response gave — refusals don't carry one.
  const resetsAtRef = useRef<string | null>(null);

  const setReached = useCallback((next: ReachedLimits) => {
    if (next === reachedRef.current) return;
    reachedRef.current = next;
    setReachedState(next);

    const id = userIdRef.current;
    if (id == null) return;
    if (next.like === null && next.superLike === null) {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    } else {
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ userId: id, ...next, premium: reachedAsPremiumRef.current }),
      ).catch(() => {});
    }
  }, []);

  // Reads back what an earlier launch saved. Flips `restored` once the read is
  // done, whether or not anything was there.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    userIdRef.current = userId;
    if (userId == null) return;
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        const saved = readStoredLimits(raw, userId, Date.now());
        const current = reachedRef.current;
        const nothingYet = current.like === null && current.superLike === null;
        // A limit reached on the free plan doesn't survive a move to premium.
        const outgrown = saved !== null && !saved.premium && isPremiumRef.current;
        if (saved && nothingYet && !outgrown) {
          reachedAsPremiumRef.current = saved.premium;
          setReached(saved.reached);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRestored(true);
      });
    return () => { cancelled = true; };
  }, [userId, setReached]);

  const markReached = useCallback((limit: SwipeLimit) => {
    reachedAsPremiumRef.current = isPremiumRef.current;
    setReached({ ...reachedRef.current, [limit]: limitExpiry(resetsAtRef.current) });
  }, [setReached]);

  /** Brings both buttons in line with a successful swipe's counters. */
  const applyCounters = useCallback((result?: SwipeResult | null) => {
    if (result?.resetsAt) resetsAtRef.current = result.resetsAt;
    reachedAsPremiumRef.current =
      typeof result?.isPremium === 'boolean' ? result.isPremium : isPremiumRef.current;

    const { like, superLike } = allowancesFromCounters(result);
    const expiry = limitExpiry(resetsAtRef.current);
    const current = reachedRef.current;
    const next: ReachedLimits = {
      like: like === undefined ? current.like : like ? expiry : null,
      superLike: superLike === undefined ? current.superLike : superLike ? expiry : null,
    };
    if (next.like !== current.like || next.superLike !== current.superLike) {
      setReached(next);
    }
  }, [setReached]);

  const isReached = useCallback(
    (limit: SwipeLimit) => reachedRef.current[limit] !== null,
    [],
  );

  const clearExpired = useCallback(
    () => setReached(clearExpiredLimits(reachedRef.current, Date.now())),
    [setReached],
  );

  // Buying premium swaps the free allowance for the premium one. What that
  // allows is the backend's call — the next swipe's counters say so. Limits
  // reached on premium stay, or the subscription status loading at every
  // launch would wipe them.
  useEffect(() => {
    if (isPremium && !reachedAsPremiumRef.current) setReached(NONE_REACHED);
  }, [isPremium, setReached]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') clearExpired();
    });
    return () => sub.remove();
  }, [clearExpired]);

  return {
    likeLimitReached: reached.like !== null,
    superLikeLimitReached: reached.superLike !== null,
    /** True once the limits saved by an earlier launch have been read back. */
    limitsRestored: restored,
    isReached,
    markReached,
    applyCounters,
    clearExpired,
  };
}
