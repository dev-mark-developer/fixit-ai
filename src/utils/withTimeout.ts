/**
 * `promise`, or `fallback` once `ms` pass without it settling. For optional
 * steps — a location fix, a push token — that must never hold a user action
 * hostage: the native calls behind them can go quiet without resolving or
 * failing. The original promise keeps running; its late result is just not
 * waited for.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
