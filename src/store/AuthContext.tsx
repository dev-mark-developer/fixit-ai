import React, { createContext, useContext, useState, useEffect } from 'react';
import { saveSession, clearSession, isLoggedIn, getUser, AuthUser } from './auth';
import { registerForceLogout } from './authEventBridge';

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
  };

  const logout = async () => {
    await clearSession();
    setAuthenticated(false);
    setUser(null);
  };

  useEffect(() => {
    registerForceLogout(logout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
