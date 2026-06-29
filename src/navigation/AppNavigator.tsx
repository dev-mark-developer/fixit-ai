import React, { useState, useCallback, useEffect } from 'react';
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

// ─── Push notification deep-linking ──────────────────────────────────────────
//
// TO ENABLE (requires Firebase setup — see src/utils/device.ts for instructions):
//
//   1. Complete Firebase setup (5 steps in device.ts)
//   2. Uncomment the block below
//   3. The navigation ref is already wired — tapping any push notification
//      will open the Notifications screen filtered to the correct module tab
//
// import messaging from '@react-native-firebase/messaging';
//
// function usePushDeepLink(navigationRef: ReturnType<typeof useNavigationContainerRef>) {
//   useEffect(() => {
//     // Foreground message: show in-app indicator or navigate
//     const unsubForeground = messaging().onMessage(async () => {
//       // optionally show a Toast / badge bump here
//     });
//
//     // Background / quit: tapped notification opens app to Notifications screen
//     const unsubBackground = messaging().onNotificationOpenedApp((remoteMessage) => {
//       if (navigationRef.isReady()) {
//         navigationRef.navigate('Notifications' as never);
//       }
//     });
//
//     // App launched by tapping a notification (quit state)
//     messaging().getInitialNotification().then((remoteMessage) => {
//       if (remoteMessage && navigationRef.isReady()) {
//         navigationRef.navigate('Notifications' as never);
//       }
//     });
//
//     return () => {
//       unsubForeground();
//       unsubBackground();
//     };
//   }, [navigationRef]);
// }

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

  // usePushDeepLink(navigationRef); // ← uncomment when Firebase is configured

  const syncRoute = useCallback(() => {
    if (navigationRef.isReady()) {
      setRouteName(navigationRef.getCurrentRoute()?.name ?? '');
    }
  }, [navigationRef]);

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
      onReady={syncRoute}
      onStateChange={syncRoute}
    >
      <NavigatorContent authenticated={authenticated} />
      <ScreenDebugBadge routeName={routeName} />
    </NavigationContainer>
  );
}
