import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PenpalStackParamList } from '../types/navigation';
import { Colors } from '../utils/colors';
import { useModuleStatus } from '../store/ModuleStatusContext';
import PenpalEntryScreen from '../screens/penpal/PenpalEntryScreen';
import PenpalSetupScreen from '../screens/penpal/PenpalSetupScreen';
import PenpalLetterDetailScreen from '../screens/penpal/PenpalLetterDetailScreen';
import PenpalComposeScreen from '../screens/penpal/PenpalComposeScreen';
import PenpalPublicProfileScreen from '../screens/penpal/PenpalPublicProfileScreen';
import PenpalDrawerNavigator from './PenpalDrawerNavigator';

const Stack = createNativeStackNavigator<PenpalStackParamList>();

export default function PenpalNavigator() {
  const { hasPenpal } = useModuleStatus();
  const initialRoute: keyof PenpalStackParamList = hasPenpal
    ? 'PenpalMain'
    : 'PenpalEntry';

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.penpal,
        headerTitleStyle: { color: Colors.text, fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="PenpalEntry"
        component={PenpalEntryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PenpalSetup"
        component={PenpalSetupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PenpalMain"
        component={PenpalDrawerNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PenpalLetterDetail"
        component={PenpalLetterDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PenpalCompose"
        component={PenpalComposeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PenpalPublicProfile"
        component={PenpalPublicProfileScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
