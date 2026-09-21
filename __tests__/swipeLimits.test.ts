jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  allowancesFromCounters,
  clearExpiredLimits,
  freeAllowanceLines,
  isLimitRefusal,
  limitExpiry,
  limitFor,
  readStoredLimits,
} from '../src/utils/swipeLimits';

describe('limitFor', () => {
  it('keeps super likes apart from the daily swipes', () => {
    // The bug: one shared flag, so running out of super likes blocked likes too.
    expect(limitFor('Like')).toBe('like');
    expect(limitFor('SuperLike')).toBe('superLike');
  });

  it('counts a pass against the daily swipes, like a like', () => {
    // Verified on beta 2026-09-14: a pass took swipesUsedToday from 1 to 2.
    expect(limitFor('Ignore')).toBe('like');
  });
});

describe('isLimitRefusal', () => {
  const refused = (status: number) => ({ response: { status } });
  const refusedWith = (status: number, message: string) =>
    ({ response: { status, data: { success: false, message, errors: null } } });

  it('reads 402 and 403 as a spent allowance — the contract agreed with the client', () => {
    expect(isLimitRefusal(refused(402))).toBe(true);
    expect(isLimitRefusal(refused(403))).toBe(true);
  });

  it('reads the live API\'s 400 "daily limit" answer as a spent allowance', () => {
    // Beta on 2026-09-11, and unchanged after the backend update on 2026-09-14.
    expect(isLimitRefusal(refusedWith(400,
      'You have reached your daily limit of 1 super likes. Upgrade to Premium for more.',
    ))).toBe(true);
  });

  it('does not read every 400 as a limit — validation failures use it too', () => {
    expect(isLimitRefusal(refusedWith(400,
      'Please set up your dating profile before discovering.',
    ))).toBe(false);
  });

  it('treats any other failure as something else', () => {
    expect(isLimitRefusal(refused(400))).toBe(false);
    expect(isLimitRefusal(refused(429))).toBe(false);
    expect(isLimitRefusal(refused(500))).toBe(false);
    expect(isLimitRefusal(new Error('Network Error'))).toBe(false);
    expect(isLimitRefusal(undefined)).toBe(false);
  });
});

describe('limitExpiry', () => {
  const now = new Date('2026-09-14T13:46:35Z');
  const nextUtcMidnight = Date.parse('2026-09-15T00:00:00Z');

  it('uses the reset time the swipe response gave', () => {
    expect(limitExpiry('2026-09-15T00:00:00Z', now)).toBe(nextUtcMidnight);
  });

  it('falls back to the next midnight UTC, which is when the server resets', () => {
    expect(limitExpiry(undefined, now)).toBe(nextUtcMidnight);
    expect(limitExpiry('not a date', now)).toBe(nextUtcMidnight);
  });

  it('ignores a reset time that has already passed', () => {
    expect(limitExpiry('2026-09-14T00:00:00Z', now)).toBe(nextUtcMidnight);
  });

  it('rolls over the end of a month', () => {
    expect(limitExpiry(null, new Date('2026-09-30T23:30:00Z')))
      .toBe(Date.parse('2026-10-01T00:00:00Z'));
  });
});

describe('allowancesFromCounters', () => {
  // The successful swipes from the beta test on 2026-09-14 (free: 2 swipes, 1 super like).
  const afterSuperLike = {
    isMatch: false,
    matchId: null,
    isPremium: false,
    dailySwipeLimit: 2,
    swipesUsedToday: 1,
    swipesRemainingToday: 1,
    dailySuperLikeLimit: 1,
    superLikesUsedToday: 1,
    superLikesRemainingToday: 0,
    resetsAt: '2026-09-15T00:00:00Z',
  };
  const afterPass = { ...afterSuperLike, swipesUsedToday: 2, swipesRemainingToday: 0 };

  it('blocks super likes once they run out, while likes carry on', () => {
    expect(allowancesFromCounters(afterSuperLike)).toEqual({ like: false, superLike: true });
  });

  it('blocks both once the swipes run out — a super like uses up a swipe', () => {
    expect(allowancesFromCounters(afterPass)).toEqual({ like: true, superLike: true });
  });

  it('frees both when some of each is left', () => {
    expect(allowancesFromCounters({ isMatch: false, swipesRemainingToday: 3, superLikesRemainingToday: 2 }))
      .toEqual({ like: false, superLike: false });
  });

  it('says nothing when the counters are missing or unlimited', () => {
    expect(allowancesFromCounters({ isMatch: true, matchId: 26 }))
      .toEqual({ like: undefined, superLike: undefined });
    expect(allowancesFromCounters({ isMatch: false, swipesRemainingToday: null, superLikesRemainingToday: null }))
      .toEqual({ like: undefined, superLike: undefined });
    expect(allowancesFromCounters(undefined)).toEqual({ like: undefined, superLike: undefined });
  });
});

describe('clearExpiredLimits', () => {
  const reset = Date.parse('2026-09-15T00:00:00Z');

  it('keeps a limit until its reset time', () => {
    const reached = { like: reset, superLike: null };
    expect(clearExpiredLimits(reached, reset - 1)).toBe(reached);
  });

  it('drops a limit once its reset time comes, and only that one', () => {
    // Discover stays mounted, so without this yesterday's limit kept blocking.
    const later = reset + 24 * 60 * 60 * 1000;
    expect(clearExpiredLimits({ like: reset, superLike: later }, reset))
      .toEqual({ like: null, superLike: later });
  });

  it('returns the same object when nothing expired, so state setters can bail out', () => {
    const none = { like: null, superLike: null };
    expect(clearExpiredLimits(none, reset)).toBe(none);
  });
});

describe('readStoredLimits', () => {
  const now = Date.parse('2026-09-14T20:00:00Z');
  const reset = Date.parse('2026-09-15T00:00:00Z');
  const saved = (record: object) => JSON.stringify(record);

  it("gives back this user's limits after a relaunch", () => {
    // The bug: the limit lived only in memory, so a relaunch forgot it until the next refused swipe.
    expect(readStoredLimits(saved({ userId: 239, like: reset, superLike: reset, premium: false }), 239, now))
      .toEqual({ reached: { like: reset, superLike: reset }, premium: false });
  });

  it("ignores another account's limits", () => {
    expect(readStoredLimits(saved({ userId: 252, like: reset, superLike: null, premium: false }), 239, now))
      .toBeNull();
  });

  it('drops limits whose reset time has passed', () => {
    expect(readStoredLimits(saved({ userId: 239, like: now - 1, superLike: reset, premium: true }), 239, now))
      .toEqual({ reached: { like: null, superLike: reset }, premium: true });
    expect(readStoredLimits(saved({ userId: 239, like: now - 1, superLike: null }), 239, now))
      .toBeNull();
  });

  it('shrugs off nothing, junk and the wrong types', () => {
    expect(readStoredLimits(null, 239, now)).toBeNull();
    expect(readStoredLimits('{not json', 239, now)).toBeNull();
    expect(readStoredLimits(saved({ userId: 239, like: '2026-09-15', superLike: true }), 239, now))
      .toBeNull();
  });
});

describe('freeAllowanceLines', () => {
  it('shows the numbers set in the admin panel', () => {
    // Beta on 2026-09-14: GET /dating/config → freeSwipesPerDay 2, freeSuperLikesPerDay 1.
    expect(freeAllowanceLines({ freeSwipesPerDay: 2, freeSuperLikesPerDay: 1 }))
      .toEqual(['2 free swipes per day', '1 super like per day']);
  });

  it('gets singular and plural right', () => {
    expect(freeAllowanceLines({ freeSwipesPerDay: 1, freeSuperLikesPerDay: 5 }))
      .toEqual(['1 free swipe per day', '5 super likes per day']);
  });

  it('leaves the number out rather than guess when config is missing', () => {
    // The screen used to hardcode "10 free swipes per day" whatever the admin set.
    expect(freeAllowanceLines(null)).toEqual(['Free swipes every day', 'Super likes every day']);
    expect(freeAllowanceLines({})).toEqual(['Free swipes every day', 'Super likes every day']);
  });
});
