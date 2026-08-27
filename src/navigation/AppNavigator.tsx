import React, { useState, useCallback, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useNavigationContainerRef } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../store/AuthContext';
import { ModuleStatusProvider } from '../store/ModuleStatusContext';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { Colors } from '../utils/colors';
import SplashScreen from '../screens/SplashScreen';
import ScreenDebugBadge from '../components/dev/ScreenDebugBadge';
import { onForegroundMessage, onNotificationTap } from '../services/pushNotifications';
import type { PushPayload } from '../services/pushNotifications';

// ─── Push notification deep-linking ──────────────────────────────────────────

/**
 * Routes a tapped notification. A payload carrying `matchId` opens that chat
 * directly; anything else falls back to the Notifications list.
 *
 * A tap from a cold start can arrive before the navigator mounts, so the
 * target is held until `isReady()`.
 */
function usePushDeepLink(
  navigationRef: ReturnType<typeof useNavigationContainerRef>,
  authenticated: boolean,
) {
  const pending = useRef<PushPayload | null>(null);

  const route = useCallback((payload: PushPayload) => {
    // Both targets live in the authenticated navigator, and a cold-start tap
    // arrives before it mounts — so hold the payload until we can actually
    // reach them. (Notifications for a signed-out device are possible: the
    // backend has no way to deregister a token on logout, gap #19.)
    if (!navigationRef.isReady() || !authenticated) {
      pending.current = payload;
      return;
    }
    // The ref isn't bound to a param list, so navigate is untyped here.
    const navigate = navigationRef.navigate as (name: string, params?: object) => void;

    const matchId = Number(payload.data.matchId);
    const matchedUserId = Number(payload.data.senderId ?? payload.data.matchedUserId);
    if (Number.isFinite(matchId) && matchId > 0 && Number.isFinite(matchedUserId)) {
      navigate('DatingChatDetail', {
        matchId,
        matchedUserId,
        matchedUserName: payload.data.senderName ?? payload.title ?? 'Chat',
      });
      return;
    }
    navigate('Notifications');
  }, [navigationRef, authenticated]);

  // Read through a ref so the subscription is registered exactly once.
  // Re-subscribing would re-run getInitialNotification and could act on the
  // launching notification twice.
  const routeRef = useRef(route);
  useEffect(() => { routeRef.current = route; }, [route]);

  useEffect(() => {
    const unsubTap = onNotificationTap((payload) => routeRef.current(payload));
    // Foreground messages are raised as a notification (see
    // `onForegroundMessage`) rather than navigating — yanking someone out of
    // what they're doing is hostile. Tapping the banner routes via `unsubTap`.
    const unsubForeground = onForegroundMessage();
    return () => {
      unsubTap();
      unsubForeground();
    };
  }, []);

  /** Replays a held tap once the navigator is up and the user is signed in. */
  const drain = useCallback(() => {
    const payload = pending.current;
    if (!payload || !navigationRef.isReady() || !authenticated) return;
    pending.current = null;
    route(payload);
  }, [navigationRef, authenticated, route]);

  // Covers the sign-in-after-tap case; `onReady` covers the cold-start case.
  useEffect(() => { drain(); }, [drain]);

  return drain;
}

const NavigatorContent = React.memo(({ authenticated }: { authenticated: boolean }) =>
  authenticated ? (
    <ModuleStatusProvider>
      <MainNavigator />
    </ModuleStatusProvider>
  ) : (
    <AuthNavigator />
  ),
);

export default function AppNavigator() {
  const { authenticated, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [routeName, setRouteName] = useState('');
  const navigationRef = useNavigationContainerRef();

  const drainPushDeepLink = usePushDeepLink(navigationRef, authenticated);

  const syncRoute = useCallback(() => {
    if (navigationRef.isReady()) {
      // Same reason as `navigate` above: the ref carries no param list, so
      // getCurrentRoute() widens to `never` without a cast.
      const current = navigationRef.getCurrentRoute() as { name?: string } | undefined;
      setRouteName(current?.name ?? '');
    }
  }, [navigationRef]);

  const handleReady = useCallback(() => {
    syncRoute();
    drainPushDeepLink();
  }, [syncRoute, drainPushDeepLink]);

  if (!splashDone) {
    return <SplashScreen onFinish={() => setSplashDone(true)} />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={handleReady}
      onStateChange={syncRoute}
    >
      <NavigatorContent authenticated={authenticated} />
      <ScreenDebugBadge routeName={routeName} />
    </NavigationContainer>
  );
}
