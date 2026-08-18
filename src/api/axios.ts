import axios from 'axios';
import { getToken, getRefreshToken, getUser, saveSession } from '../store/auth';
import { getDeviceId } from '../utils/device';
import { triggerForceLogout } from '../store/authEventBridge';
import { attachApiLogger } from './logging';

//Local Dev
// const BASE_URL = 'http://localhost:5143/api'; // USB tunnel: adb reverse tcp:5143 tcp:5143
//Beta/UAT URL
const BASE_URL = 'https://beta.contentdevelopmentpros.com:4125/api'; // USB tunnel: adb reverse tcp:5143 tcp:5143

// Host origin (no /api suffix) — used to resolve relative image paths
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 25000,
  headers: { 'Content-Type': 'application/json' },
});

// Dev-only: log every request/response (headers, payload, body) to Metro
attachApiLogger(api);

// ── Token refresh state ───────────────────────────────────────────────────────
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function flushQueue(error: unknown, token: string | null = null) {
  pendingQueue.forEach(p => (token ? p.resolve(token) : p.reject(error)));
  pendingQueue = [];
}

// ── Request: attach access token ──────────────────────────────────────────────
api.interceptors.request.use(async config => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: silently refresh on 401, then retry ────────────────────────────
api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config;

    const is401 = error.response?.status === 401;
    const alreadyRetried = original._retry === true;
    const isRefreshEndpoint = original.url?.includes('auth/refresh-token');

    if (!is401 || alreadyRetried || isRefreshEndpoint) {
      return Promise.reject(error);
    }

    // If a refresh is already in progress, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: token => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const [refreshToken, deviceId, user] = await Promise.all([
        getRefreshToken(),
        getDeviceId(),
        getUser(),
      ]);

      if (!refreshToken || !user) {
        flushQueue(error);
        triggerForceLogout();
        return Promise.reject(error);
      }

      // Use a plain axios call (not `api`) to avoid re-entering this interceptor
      const res = await axios.post(`${BASE_URL}/auth/refresh-token`, {
        refreshToken,
        deviceId,
      });

      const data = res.data?.data;
      await saveSession(
        data.accessToken,
        {
          id: data.userId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          role: data.role,
        },
        data.refreshToken,
      );

      flushQueue(null, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      flushQueue(refreshError);
      triggerForceLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
