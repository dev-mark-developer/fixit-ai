import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useModuleStatus } from '../store/ModuleStatusContext';
import { Colors } from '../utils/colors';
import type { RootStackParamList } from '../types/navigation';
import HomeScreen from '../screens/main/HomeScreen';
import DatingNavigator from './DatingNavigator';
import PenpalNavigator from './PenpalNavigator';
import MentorNavigator from './MentorNavigator';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import MentorSetupScreen from '../screens/mentor/MentorSetupScreen';
import ProfileNavigator from './ProfileNavigator';

const Root = createNativeStackNavigator<RootStackParamList>();

const SHARED_HEADER = {
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.primary,
  headerTitleStyle: { color: Colors.text, fontWeight: '700' as const },
  headerShadowVisible: false,
};

export default function MainNavigator() {
  const { isMentor, hasDating, hasPenpal, loading } = useModuleStatus();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Mentors go directly to their dashboard — no root stack
  if (isMentor) {
    return <MentorNavigator />;
  }

  // Single module: land directly on that module (no Home in history)
  // Both or neither: land on Home screen
  const singleDating = hasDating && !hasPenpal;
  const singlePenpal = hasPenpal && !hasDating;
  const initialRoute: keyof RootStackParamList =
    singleDating ? 'Dating' :
    singlePenpal ? 'Penpal' :
    'Home';

  return (
    <Root.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Root.Screen name="Home" component={HomeScreen} />
      <Root.Screen name="Dating" component={DatingNavigator} />
      <Root.Screen name="Penpal" component={PenpalNavigator} />
      <Root.Screen
        name="MentorSetup"
        component={MentorSetupScreen}
        options={{ headerShown: true, title: 'Spiritual Guru', ...SHARED_HEADER }}
      />
      <Root.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: true, title: 'Notifications', ...SHARED_HEADER }}
      />
      <Root.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{ headerShown: false }}
      />
    </Root.Navigator>
  );
}
