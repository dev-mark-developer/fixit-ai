// Module-level callback slot so the axios interceptor can trigger a logout
// without importing React context (which would cause a circular dependency).
// AuthProvider registers its logout fn here on mount.
let _forceLogout: (() => void) | null = null;

export function registerForceLogout(fn: () => void) {
  _forceLogout = fn;
}

export function triggerForceLogout() {
  _forceLogout?.();
}
