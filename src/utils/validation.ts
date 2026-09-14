/**
 * Anchored, with a real TLD — unlike the `/\S+@\S+\.\S+/` the sign-up form
 * used to use, which is unanchored and so accepts anything *containing*
 * something email-shaped ("jo bloggs@x.com", "a@@b.com"). Those slipped past
 * the client and came back from the server as an opaque error instead of a
 * message under the field.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/**
 * Progressive mask for a phone field: 5551234567 → "(555) 123-4567", applied
 * as the user types.
 *
 * A number entered with a leading "+" is left as plain digits: the app has no
 * per-country grouping rules, and forcing "+44 7700 900123" into a US shape
 * would be worse than showing it unformatted.
 */
export function formatPhoneInput(input: string): string {
  const trimmed = input.trimStart();
  const digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    // E.164 allows at most 15 digits.
    return digits ? `+${digits.slice(0, 15)}` : '+';
  }

  const local = digits.slice(0, 10);
  if (local.length <= 3) return local;
  if (local.length <= 6) return `(${local.slice(0, 3)}) ${local.slice(3)}`;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

/** The dialable value behind the mask — what gets sent to the API. */
export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return value.trimStart().startsWith('+') ? `+${digits}` : digits;
}
