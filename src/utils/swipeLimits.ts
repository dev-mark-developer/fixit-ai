import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { toApiDate } from './datetime';

/**
 * Daily allowances on Discover. The admin panel sets how many likes and how
 * many super likes an account gets per day, with separate numbers for free and
 * premium. Passing on someone is never limited.
 *
 * No endpoint tells the app those numbers up front yet
 * (docs/BACKEND_LIKE_LIMITS.md), so it learns that an allowance has run out
 * when `POST /dating/swipe` refuses a swipe — see `isLimitRefusal`.
 */

export type SwipeAction = 'Like' | 'SuperLike' | 'Ignore';
export type SwipeLimit = 'like' | 'superLike';

/** The local day each allowance ran out on; null while it hasn't. */
export interface ReachedLimits {
  like: string | null;
  superLike: string | null;
}

const NONE_REACHED: ReachedLimits = { like: null, superLike: null };

/** The allowance a swipe draws on — none for a pass. */
export function limitFor(action: SwipeAction): SwipeLimit | null {
  if (action === 'Like') return 'like';
  if (action === 'SuperLike') return 'superLike';
  return null;
}

/**
 * Whether `POST /dating/swipe` refused because an allowance is spent.
 *
 * The contract agreed with the client was 402/403 (gap #22), but the live API
 * answers **400** with only a sentence to go on (verified 2026-09-11):
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
 * Drops any allowance that ran out before `today`, returning the same object
 * when nothing changed.
 *
 * When the server resets the count isn't published — UTC midnight, local
 * midnight and a rolling 24 hours are all possible. Local midnight is the
 * generous guess: if the server hasn't reset yet, the next swipe is refused
 * again and the limit simply comes back.
 */
export function clearExpiredLimits(reached: ReachedLimits, today: string): ReachedLimits {
  const like = reached.like === today ? reached.like : null;
  const superLike = reached.superLike === today ? reached.superLike : null;
  return like === reached.like && superLike === reached.superLike
    ? reached
    : { like, superLike };
}

/**
 * Which of today's allowances have run out.
 *
 * Discover stays mounted in the drawer, so a limit kept in plain state would
 * outlive the day it belongs to. Expired limits are dropped whenever the app
 * returns to the foreground; the screen also calls `clearExpired` on focus.
 */
export function useSwipeLimits(isPremium: boolean) {
  const [reached, setReachedState] = useState<ReachedLimits>(NONE_REACHED);
  // Swipe handlers check this between renders, so it is written in step with
  // the state rather than after it.
  const reachedRef = useRef(reached);
  const setReached = useCallback((next: ReachedLimits) => {
    reachedRef.current = next;
    setReachedState(next);
  }, []);

  const markReached = useCallback(
    (limit: SwipeLimit) =>
      setReached({ ...reachedRef.current, [limit]: toApiDate(new Date()) }),
    [setReached],
  );

  const isReached = useCallback(
    (limit: SwipeLimit) => reachedRef.current[limit] !== null,
    [],
  );

  const clearExpired = useCallback(
    () => setReached(clearExpiredLimits(reachedRef.current, toApiDate(new Date()))),
    [setReached],
  );

  // Buying premium swaps the free allowance for the premium one. What that
  // allows is the backend's call — the next refused swipe says so.
  useEffect(() => {
    if (isPremium) setReached(NONE_REACHED);
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
    isReached,
    markReached,
    clearExpired,
  };
}
