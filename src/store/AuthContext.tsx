import React, { createContext, useContext, useState, useEffect } from 'react';
import { clearImageCacheRecord } from '../utils/imageCache';
import { saveSession, clearSession, isLoggedIn, getUser, AuthUser } from './auth';
import { registerForceLogout } from './authEventBridge';
import { clearPushToken, syncPushToken, watchPushToken } from '../services/pushNotifications';

interface AuthContextType {
  authenticated: boolean;
  loading: boolean;
  user: AuthUser | null;
  login: (token: string, user: AuthUser, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    Promise.all([isLoggedIn(), getUser()]).then(([loggedIn, u]) => {
      setAuthenticated(loggedIn);
      setUser(u);
      setLoading(false);
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

  const logout = async () => {
    // Drop the registration before the session goes, so this device stops
    // receiving notifications meant for the account signing out.
    await clearPushToken().catch(() => {});
    await clearSession();
    // The next account gets its own images; don't let them inherit a record
    // saying someone else's avatars are already painted.
    clearImageCacheRecord();
    setAuthenticated(false);
    setUser(null);
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
    <AuthContext.Provider value={{ authenticated, loading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
