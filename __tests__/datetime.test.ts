import { parseApiDate, timeAgo, toApiDate } from '../src/utils/datetime';

describe('parseApiDate', () => {
  it('reads a zone-less API timestamp as UTC, not local', () => {
    // The bug: on a +05:00 device this parsed five hours behind the real
    // instant, so a row created seconds ago rendered as "5 hours ago".
    expect(parseApiDate('2026-09-09T09:12:44.601').toISOString())
      .toBe('2026-09-09T09:12:44.601Z');
  });

  it('leaves a timestamp that already declares its zone alone', () => {
    expect(parseApiDate('2026-09-09T09:12:44.601Z').toISOString())
      .toBe('2026-09-09T09:12:44.601Z');
    expect(parseApiDate('2026-09-09T14:12:44.601+05:00').toISOString())
      .toBe('2026-09-09T09:12:44.601Z');
  });

  it('leaves a date-only value alone — appending a marker would break it', () => {
    const dob = parseApiDate('1990-05-14');
    expect(Number.isNaN(dob.getTime())).toBe(false);
    expect(dob.toISOString()).toBe('1990-05-14T00:00:00.000Z');
  });

  it('is NaN for nothing and for junk, so callers can render an empty label', () => {
    expect(Number.isNaN(parseApiDate(null).getTime())).toBe(true);
    expect(Number.isNaN(parseApiDate('').getTime())).toBe(true);
    expect(Number.isNaN(parseApiDate('not a date').getTime())).toBe(true);
  });
});

describe('timeAgo', () => {
  const isoAgo = (ms: number) =>
    new Date(Date.now() - ms).toISOString().replace('Z', ''); // as the API sends it

  it('says "just now" for a row the API created seconds ago', () => {
    expect(timeAgo(isoAgo(2_000))).toBe('just now');
  });

  it('counts minutes, hours and days', () => {
    expect(timeAgo(isoAgo(5 * 60_000))).toBe('5 mins ago');
    expect(timeAgo(isoAgo(60 * 60_000))).toBe('1 hour ago');
    expect(timeAgo(isoAgo(3 * 60 * 60_000))).toBe('3 hours ago');
    expect(timeAgo(isoAgo(50 * 60 * 60_000))).toBe('2 days ago');
  });

  it('renders nothing for a missing timestamp', () => {
    expect(timeAgo(undefined)).toBe('');
    expect(timeAgo('nonsense')).toBe('');
  });
});

describe('toApiDate', () => {
  it('keeps the day the user picked, not the UTC day', () => {
    // The picker hands back local midnight. toISOString() would move this back
    // to 1990-05-13 on any device east of Greenwich — a birthday a day early.
    const localMidnight = new Date(1990, 4, 14, 0, 0, 0);
    expect(toApiDate(localMidnight)).toBe('1990-05-14');
  });

  it('holds up late in the evening, when the UTC date has already rolled over', () => {
    expect(toApiDate(new Date(1990, 4, 14, 23, 30, 0))).toBe('1990-05-14');
  });

  it('pads single-digit months and days', () => {
    expect(toApiDate(new Date(2001, 0, 5))).toBe('2001-01-05');
  });
});
