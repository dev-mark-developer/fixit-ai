/**
 * The one shape every notification is reduced to, whether it came from FCM or
 * was raised locally by the app. Lives here rather than in either service so
 * `pushNotifications` can depend on `localNotifications` without a cycle.
 */
export interface PushPayload {
  title?: string;
  body?: string;
  /**
   * FCM data values are always strings over the wire, so local notifications
   * use the same convention — a deep link built from `data.matchId` behaves
   * identically no matter which side raised it.
   */
  data: Record<string, string>;
}
