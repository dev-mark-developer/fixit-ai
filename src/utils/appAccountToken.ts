/**
 * Apple requires `appAccountToken` to be a UUID, but our user ids are plain
 * ints. The webhook matches the purchase back to an account through this
 * value, so whatever we send here has to be something the backend can resolve.
 *
 * The real source is `identifier` on the login response — a per-user GUID.
 * The derived form below is only a fallback for sessions saved before that
 * field existed; the backend can reverse it by reading the last 12 digits as
 * a decimal user id.
 */

/** `00000000-0000-4000-8000-<userId zero-padded to 12>` */
export function deriveAppAccountToken(userId: number): string {
  const padded = String(Math.max(0, Math.trunc(userId))).padStart(12, '0').slice(-12);
  return `00000000-0000-4000-8000-${padded}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * The token to hand StoreKit: the backend-issued GUID when we have one,
 * otherwise the derived form.
 *
 * Lower-cased deliberately. StoreKit takes a `UUID`, and Apple renders it
 * **lower-case** in the signed transaction the webhook receives — so the value
 * coming back will not match the upper-case form the backend stores unless the
 * comparison is case-insensitive. Sending it lower-case makes both ends agree
 * on one spelling; the backend still has to compare case-insensitively to be
 * safe (see gap #20).
 */
export function resolveAppAccountToken(
  userId: number,
  backendToken?: string | null,
): string {
  return isUuid(backendToken) ? backendToken.toLowerCase() : deriveAppAccountToken(userId);
}
