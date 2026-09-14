import { apiErrorMessage, extractApiError, fieldErrors } from '../src/utils/apiError';

const axiosError = (status: number, data: unknown) => ({ response: { status, data } });

describe('apiErrorMessage', () => {
  it('prefers a field detail over the ProblemDetails boilerplate title', () => {
    const err = axiosError(400, {
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { Email: ["'Email' is not a valid email address."] },
    });
    expect(apiErrorMessage(err)).toBe("'Email' is not a valid email address.");
  });

  it('reads Identity-style error arrays', () => {
    const err = axiosError(400, {
      message: 'One or more validation errors occurred.',
      errors: [{ code: 'PasswordMismatch', description: 'Incorrect password.' }],
    });
    expect(apiErrorMessage(err)).toBe('Incorrect password.');
  });

  it('returns null when the server said nothing usable, so callers can word it', () => {
    expect(apiErrorMessage(axiosError(400, { title: 'An error occurred' }))).toBeNull();
    expect(extractApiError(axiosError(400, { message: 'Unexpected error occurred.' }), 'Could not upload the photo.'))
      .toBe('Could not upload the photo.');
  });

  it('keeps a message that only starts like boilerplate', () => {
    const err = axiosError(400, { message: 'An error occurred while saving your profile.' });
    expect(apiErrorMessage(err)).toBe('An error occurred while saving your profile.');
  });

  it('explains the transport when there is no response at all', () => {
    expect(apiErrorMessage({ message: 'Network Error' })).toMatch(/Unable to reach the server/);
    expect(apiErrorMessage({ code: 'ECONNABORTED' })).toMatch(/took too long/);
  });

  it('falls back to a status sentence before the caller wording', () => {
    expect(apiErrorMessage(axiosError(500, {}))).toMatch(/server ran into a problem/);
    expect(apiErrorMessage(axiosError(413, {}))).toMatch(/too large/);
  });

  it('ignores an HTML error page body', () => {
    expect(extractApiError(axiosError(502, '<html><body>Bad Gateway</body></html>'), 'Fallback'))
      .toMatch(/server ran into a problem/);
  });

  it('joins several field errors', () => {
    const err = axiosError(400, { errors: { Email: ['Bad email'], Password: ['Too short'] } });
    expect(apiErrorMessage(err)).toBe('Bad email\nToo short');
  });
});

describe('fieldErrors', () => {
  it('keys messages the way a form does', () => {
    const err = axiosError(400, {
      errors: { Email: ['Bad email'], '$.dateOfBirth': ['Not a date'], CurrentPassword: ['Incorrect password.'] },
    });
    expect(fieldErrors(err)).toEqual({
      email: 'Bad email',
      dateOfBirth: 'Not a date',
      currentPassword: 'Incorrect password.',
    });
  });

  it('is empty for Identity arrays, which carry no field names', () => {
    expect(fieldErrors(axiosError(400, { errors: [{ description: 'Incorrect password.' }] }))).toEqual({});
    expect(fieldErrors(new Error('boom'))).toEqual({});
  });
});
