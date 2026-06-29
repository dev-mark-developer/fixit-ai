import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export async function saveSession(token: string, user: AuthUser, refreshToken?: string): Promise<void> {
  const pairs: [string, string][] = [
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ];
  if (refreshToken) {
    pairs.push([REFRESH_TOKEN_KEY, refreshToken]);
  }
  await AsyncStorage.multiSet(pairs);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function getUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, REFRESH_TOKEN_KEY]);
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}
