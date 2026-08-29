import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MentorStackParamList } from '../types/navigation';
import { Colors } from '../utils/colors';
import { mentorApi } from '../api/mentor';
import { useSubscription } from '../store/SubscriptionContext';
import { isIapSupported } from '../services/iap';
import MentorProfileSetupScreen from '../screens/mentor/MentorProfileSetupScreen';
import MentorSubscriptionScreen from '../screens/mentor/MentorSubscriptionScreen';
import MentorEditProfileScreen from '../screens/mentor/MentorEditProfileScreen';
import MentorDrawerNavigator from './MentorDrawerNavigator';
import DatingNavigator from './DatingNavigator';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import ChangePasswordScreen from '../screens/main/ChangePasswordScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import FaqsScreen from '../screens/main/FaqsScreen';
import ContactUsScreen from '../screens/main/ContactUsScreen';

const Stack = createNativeStackNavigator<MentorStackParamList>();

const SHARED_HEADER = {
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.mentor,
  headerTitleStyle: { color: Colors.text, fontWeight: '700' as const },
  headerShadowVisible: false,
};

export default function MentorNavigator() {
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const { isPremium, loading: subscriptionLoading } = useSubscription();

  useEffect(() => {
    mentorApi.getProfile()
      .then((res) => setHasProfile(!!res.data?.data))
      .catch(() => setHasProfile(false))
      .finally(() => setProfileLoading(false));
  }, []);

  // The mentor programme is subscription-only. Android has no billing yet, so
  // gating it there would lock those accounts out with no way to pay.
  const gated = isIapSupported && !isPremium;

  if (profileLoading || (isIapSupported && subscriptionLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.mentor} />
      </View>
    );
  }

  // Landing on the paywall as the stack's initial route is what makes the gate
  // hard: there is nothing beneath it to go back to.
  const initialRoute: keyof MentorStackParamList = !hasProfile
    ? 'MentorProfileSetup'
    : gated
      ? 'MentorSubscription'
      : 'MentorMain';

  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={SHARED_HEADER}>
      <Stack.Screen
        name="MentorProfileSetup"
        component={MentorProfileSetupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MentorDating"
        component={DatingNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MentorSubscription"
        component={MentorSubscriptionScreen}
        options={{ headerShown: false }}
        initialParams={{ gate: gated }}
      />
      <Stack.Screen
        name="MentorMain"
        component={MentorDrawerNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MentorEditProfile"
        component={MentorEditProfileScreen}
        options={{ title: 'Edit Profile' }}
      />
      {/* Shared utility screens — accessible from drawer menu */}
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen as any}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen as any}
        options={{ title: 'Change Password' }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen as any}
        options={{ title: 'Edit Profile' }}
      />
      <Stack.Screen
        name="Faqs"
        component={FaqsScreen as any}
        options={{ title: 'FAQs' }}
      />
      <Stack.Screen
        name="ContactUs"
        component={ContactUsScreen as any}
        options={{ title: 'Contact Us' }}
      />
    </Stack.Navigator>
  );
}
