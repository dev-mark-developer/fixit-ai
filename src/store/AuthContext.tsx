import React, { createContext, useContext, useState, useEffect } from 'react';
import { clearImageCacheRecord } from '../utils/imageCache';
import { saveSession, saveUser, clearSession, isLoggedIn, getUser, AuthUser } from './auth';
import { registerForceLogout } from './authEventBridge';
import { clearPushToken, syncPushToken, watchPushToken } from '../services/pushNotifications';
import { clearNotificationBadge } from '../services/localNotifications';
import LoadingOverlay from '../components/common/LoadingOverlay';

interface AuthContextType {
  authenticated: boolean;
  loading: boolean;
  user: AuthUser | null;
  login: (token: string, user: AuthUser, refreshToken?: string) => Promise<void>;
  /**
   * Patches the signed-in user everywhere it is read from (drawers, headers)
   * after a screen saves a change to the account — the session copy would
   * otherwise stay stale until the next sign-in.
   */
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  /**
   * Sign-out clears the push registration and the stored session before the
   * navigator swaps trees, which is long enough to look like a dead tap. The
   * overlay lives here rather than on a screen because six places call
   * `logout()` — drawers, lobby, profile, subscription — and QA reported the
   * missing feedback on one of them.
   */
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    Promise.all([isLoggedIn(), getUser()]).then(([loggedIn, u]) => {
      setAuthenticated(loggedIn);
      setUser(u);
      setLoading(false);
      /**
       * The app-icon badge is OS state, and it outlives the app: deleting and
       * reinstalling left the previous account's count sitting on the icon,
       * because nothing here has ever written to it — the number only comes
       * from the backend's `aps.badge`, so it stayed wrong until the next push
       * happened to carry a new one (QA 2026-09-23).
       *
       * With no session there is nobody it could be counting, so it goes. A
       * signed-in launch is left alone: the backend is the authority on that
       * account's count.
       */
      if (!loggedIn) clearNotificationBadge();
    });
  }, []);

  const login = async (token: string, userData: AuthUser, refreshToken?: string) => {
    await saveSession(token, userData, refreshToken);
    setAuthenticated(true);
    setUser(userData);
    // Login already sends whatever token existed at the time. This re-sends it
    // now that the session is authenticated, which is what picks up the token
    // when permission was granted mid-login or the device had none before.
    syncPushToken().catch(() => {});
  };

  const updateUser = async (patch: Partial<AuthUser>) => {
    const current = user ?? (await getUser());
    if (!current) return;
    const next = { ...current, ...patch };
    setUser(next);
    await saveUser(next);
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      // Drop the registration before the session goes, so this device stops
      // receiving notifications meant for the account signing out.
      await clearPushToken().catch(() => {});
      // The count belonged to the account that is leaving — same reasoning as
      // the launch path above, so whoever signs in next starts clean.
      clearNotificationBadge();
      await clearSession();
      // The next account gets its own images; don't let them inherit a record
      // saying someone else's avatars are already painted.
      clearImageCacheRecord();
      setAuthenticated(false);
      setUser(null);
    } finally {
      // Runs on the failure path too: a session that could not be cleared
      // must not leave the app stuck behind a spinner.
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    registerForceLogout(logout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FCM rotates tokens on its own schedule; push the new one whenever it does.
  useEffect(() => {
    if (!authenticated) return;
    return watchPushToken();
  }, [authenticated]);

  return (
    <AuthContext.Provider value={{ authenticated, loading, user, login, updateUser, logout }}>
      {children}
      <LoadingOverlay visible={loggingOut} label="Signing out…" />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
