import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../types/navigation';
import { Colors } from '../utils/colors';
import ProfileScreen from '../screens/main/ProfileScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import ChangePasswordScreen from '../screens/main/ChangePasswordScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import FaqsScreen from '../screens/main/FaqsScreen';
import ContactUsScreen from '../screens/main/ContactUsScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.primary,
        headerTitleStyle: { color: Colors.text, fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile', headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="Faqs" component={FaqsScreen} options={{ title: 'FAQs' }} />
      <Stack.Screen name="ContactUs" component={ContactUsScreen} options={{ title: 'Contact Us' }} />
    </Stack.Navigator>
  );
}
