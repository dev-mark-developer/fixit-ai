/**
 * One place that turns an axios failure into a sentence the user can act on.
 *
 * The backend is ASP.NET, so a rejected request usually arrives as
 * ProblemDetails:
 *
 *   { title: "One or more validation errors occurred.",
 *     status: 400,
 *     errors: { Email: ["'Email' is not a valid email address."] } }
 *
 * …while Identity endpoints (register, change-password) send `errors` as an
 * array of `{ code, description }` instead. Screens used to read `message`
 * first and fall back to `title`, which is how QA ended up looking at "One or
 * more validation errors occurred." and "An error occurred" — the boilerplate
 * outer wrapper — while the sentence that actually explains the failure sat
 * one level down in `errors`. So: details first, boilerplate never.
 */

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

const NETWORK_MESSAGE =
  'Unable to reach the server. Please check your connection and try again.';

const TIMEOUT_MESSAGE = 'The server took too long to respond. Please try again.';

/**
 * Server text that tells the user nothing. Matched as a prefix, so
 * "An error occurred while saving" — which *is* informative — still gets
 * through; only the bare boilerplate is dropped.
 */
const BOILERPLATE = [
  'one or more validation errors occurred',
  'an error occurred',
  'an unexpected error occurred',
  'unexpected error occurred',
  'unexpected error',
  'internal server error',
  'bad request',
  'object reference not set to an instance of an object',
];

function isUseless(text: string): boolean {
  const normalised = text.trim().toLowerCase().replace(/[.!\s]+$/, '');
  if (!normalised) return true;
  return BOILERPLATE.some((b) => normalised === b);
}

function usable(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && !isUseless(text) ? text : null;
}

/** Every field-level sentence in the payload, in the order the server sent them. */
function detailMessages(data: any): string[] {
  const errors = data?.errors;
  if (!errors) return [];

  // Identity: [{ code, description }] — or occasionally plain strings.
  if (Array.isArray(errors)) {
    return errors
      .map((e: any) => (typeof e === 'string' ? e : e?.description ?? e?.message))
      .map((m: unknown) => usable(m))
      .filter((m): m is string => m !== null);
  }

  // ProblemDetails: { Field: ["message", …] }
  if (typeof errors === 'object') {
    return Object.values(errors)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .map((m: unknown) => usable(m))
      .filter((m): m is string => m !== null);
  }

  return [];
}

/**
 * Field-level errors keyed the way a form keys them (`Email` → `email`), so a
 * screen can put the message under the input it belongs to instead of in an
 * alert. Only ProblemDetails carries field names; Identity's array does not.
 */
export function fieldErrors(err: unknown): Record<string, string> {
  const errors = (err as any)?.response?.data?.errors;
  if (!errors || Array.isArray(errors) || typeof errors !== 'object') return {};

  const out: Record<string, string> = {};
  Object.entries(errors).forEach(([key, value]) => {
    const message = (Array.isArray(value) ? value : [value])
      .map((m: unknown) => usable(m))
      .find((m): m is string => m !== null);
    if (!message || !key) return;
    // "$.dateOfBirth" (JSON-body binding errors) and "Email" both arrive here.
    const name = key.replace(/^\$\./, '').split('.').pop() ?? key;
    out[name.charAt(0).toLowerCase() + name.slice(1)] = message;
  });
  return out;
}

/** A status the user can be told something concrete about. */
function statusMessage(status?: number): string | null {
  if (!status) return null;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 413) return 'That file is too large to upload.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) return 'The server ran into a problem. Please try again in a moment.';
  return null;
}

/**
 * The most specific thing the server said, or `null` when it said nothing
 * worth repeating — which is the caller's cue to supply wording that fits the
 * screen ("Could not upload the photo") rather than echo boilerplate.
 */
export function apiErrorMessage(err: unknown): string | null {
  const e = err as any;

  if (e?.code === 'ECONNABORTED') return TIMEOUT_MESSAGE;
  if (!e?.response) return NETWORK_MESSAGE;

  const data = e.response.data;

  // A bare string body, as long as it isn't an HTML error page.
  if (typeof data === 'string') {
    const text = usable(data);
    if (text && text.length <= 300 && !text.startsWith('<')) return text;
  }

  const details = detailMessages(data);
  if (details.length > 0) return details.join('\n');

  return (
    usable(data?.message) ??
    usable(data?.detail) ??
    usable(data?.error) ??
    usable(data?.title) ??
    statusMessage(e.response.status)
  );
}

/** {@link apiErrorMessage} with screen-specific wording when the server gave none. */
export function extractApiError(err: unknown, fallback = DEFAULT_MESSAGE): string {
  return apiErrorMessage(err) ?? fallback;
}
