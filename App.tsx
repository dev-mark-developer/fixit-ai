import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/store/AuthContext';
import { SubscriptionProvider } from './src/store/SubscriptionContext';
import AppNavigator from './src/navigation/AppNavigator';
import { requestNotificationPermission } from './src/services/pushNotifications';
import { ensureNotificationChannel } from './src/services/localNotifications';
import { primeLocation } from './src/utils/location';

const queryClient = new QueryClient();

export default function App() {
  // Both permissions are asked for once at launch rather than mid-flow. On iOS
  // notifications also have to come before anything asks for a token: APNs
  // registration only completes after notifications are allowed, and
  // getToken() fails until it has.
  useEffect(() => {
    (async () => {
      await requestNotificationPermission().catch(() => {
        // Declined or unavailable — the app works fine without push.
      });
      // After the notification prompt, so iOS shows one at a time. Optional
      // too: refusing only means Discover can't sort by distance.
      primeLocation();
    })();
    // Android drops any notification naming a channel that doesn't exist,
    // so the channel has to be created before the first one arrives.
    ensureNotificationChannel().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SubscriptionProvider>
            <AppNavigator />
          </SubscriptionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
