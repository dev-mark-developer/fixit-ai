import { withTimeout } from '../src/utils/withTimeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('passes a prompt result through', async () => {
    await expect(withTimeout(Promise.resolve('token'), 1000, null)).resolves.toBe('token');
  });

  it('falls back when the promise never settles', async () => {
    const pending = withTimeout(new Promise<string>(() => {}), 1000, 'fallback');
    jest.advanceTimersByTime(1000);
    await expect(pending).resolves.toBe('fallback');
  });

  it('keeps a rejection a rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, null)).rejects.toThrow('boom');
  });
});
