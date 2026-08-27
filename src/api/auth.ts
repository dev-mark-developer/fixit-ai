import api from './axios';

export const authApi = {
  /**
   * Keeps the session warm and, more usefully here, is the only endpoint that
   * accepts a push token outside of login/register — so it's how a rotated
   * FCM token reaches the backend mid-session.
   *
   * `pushToken` is nullable: sending null records the device as having no
   * push (permission revoked, Play Services missing).
   */
  heartbeat: (deviceId: string, pushToken: string | null) =>
    api.post('/auth/heartbeat', { deviceId, pushToken }),

  logout: () => api.post('/auth/logout'),
};
