/**
 * The API serialises timestamps **without a zone marker** — `GET` bodies carry
 * "2026-09-09T09:12:44.601", not "…Z" (documented for chat in
 * docs/CHAT_API.md, and the rest of the API does the same). They are UTC.
 *
 * `new Date("2026-09-09T09:12:44.601")` reads that as *local* time, so on a
 * +05:00 device (PKT, where the team and QA sit) every row comes out exactly
 * five hours older than it is — which is why a request created seconds ago
 * displayed as "5 hours ago", and never changed. Tagging the bare ones before
 * parsing is the whole fix.
 *
 * Date-only values ("1990-05-14", a date of birth) are left alone: the spec
 * already parses those as UTC, and appending a marker would produce an
 * invalid date.
 */
export function parseApiDate(value?: string | null): Date {
  if (!value) return new Date(NaN);
  const text = value.trim();
  const hasTime = /\d[T ]\d/.test(text);
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  return new Date(hasTime && !hasZone ? `${text}Z` : text);
}

/**
 * "just now" / "5 mins ago" / "2 hours ago" / "3 days ago", falling back to a
 * plain date after a week. Empty string for anything unparseable, so a missing
 * timestamp renders as nothing rather than "Invalid Date".
 */
export function timeAgo(value?: string | null): string {
  const then = parseApiDate(value).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day} day${day > 1 ? 's' : ''} ago`;
  if (hr > 0) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
  if (min > 0) return `${min} min${min > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * A calendar date (`YYYY-MM-DD`) for the API, taken from the date the user
 * actually picked.
 *
 * `date.toISOString().slice(0, 10)` looks like it does this but does not: the
 * picker hands back **local midnight**, and converting that to UTC moves it
 * backwards anywhere east of Greenwich. On a +05:00 device (PKT) a birthday of
 * 14 May 1990 is stored as 1990-05-13 — a date of birth one day earlier than
 * the one entered, which is what the admin panel was showing.
 *
 * Reading the local y/m/d off the Date keeps the day the user chose.
 */
export function toApiDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The reverse of {@link toApiDate}: a calendar date from the API
 * ("2000-08-27") as local midnight of that same day, ready for a date picker.
 *
 * `new Date("2000-08-27")` is UTC midnight, which is still 26 August anywhere
 * west of Greenwich. The dating profile and mentor sign-up read the stored date
 * of birth that way, so a user in the Americas saw it a day early — and saving
 * the form sent that earlier day back, which the admin panel then showed.
 *
 * Only the leading date is read, so a timestamp works too. NaN for anything
 * else, including impossible dates like 2000-02-31.
 */
export function parseApiDateOnly(value?: string | null): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((value ?? '').trim());
  if (!match) return new Date(NaN);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getMonth() === month && date.getDate() === day ? date : new Date(NaN);
}
