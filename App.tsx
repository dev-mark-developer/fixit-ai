import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/store/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { requestNotificationPermission } from './src/services/pushNotifications';
import { ensureNotificationChannel } from './src/services/localNotifications';

const queryClient = new QueryClient();

export default function App() {
  // Asked once at launch rather than at sign-in. On iOS this also has to
  // happen before anything asks for a token: APNs registration only completes
  // after notifications are allowed, and getToken() fails until it has.
  useEffect(() => {
    requestNotificationPermission().catch(() => {
      // Declined or unavailable — the app works fine without push.
    });
    // Android drops any notification naming a channel that doesn't exist,
    // so the channel has to be created before the first one arrives.
    ensureNotificationChannel().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
