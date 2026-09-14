import { clearExpiredLimits, isLimitRefusal, limitFor } from '../src/utils/swipeLimits';

describe('limitFor', () => {
  it('draws likes and super likes from separate allowances', () => {
    // The bug: one shared flag, so running out of super likes blocked likes too.
    expect(limitFor('Like')).toBe('like');
    expect(limitFor('SuperLike')).toBe('superLike');
  });

  it('never limits a pass', () => {
    expect(limitFor('Ignore')).toBeNull();
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
    // Verified against beta 2026-09-11: the second super like of the day.
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

describe('clearExpiredLimits', () => {
  it('keeps a limit reached today', () => {
    const reached = { like: '2026-09-11', superLike: null };
    expect(clearExpiredLimits(reached, '2026-09-11')).toBe(reached);
  });

  it('drops a limit reached on an earlier day, and only that one', () => {
    // Discover stays mounted, so without this yesterday's limit kept blocking.
    expect(clearExpiredLimits({ like: '2026-09-10', superLike: '2026-09-11' }, '2026-09-11'))
      .toEqual({ like: null, superLike: '2026-09-11' });
  });

  it('returns the same object when nothing expired, so state setters can bail out', () => {
    const none = { like: null, superLike: null };
    expect(clearExpiredLimits(none, '2026-09-11')).toBe(none);
  });
});
