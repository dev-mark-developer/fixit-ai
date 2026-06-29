import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { DatingStackParamList } from '../types/navigation';
import { Colors } from '../utils/colors';
import { useModuleStatus } from '../store/ModuleStatusContext';
import DatingLobbyScreen from '../screens/dating/DatingLobbyScreen';
import NonSpiritualEntryScreen from '../screens/dating/NonSpiritualEntryScreen';
import SpiritualEntryScreen from '../screens/dating/SpiritualEntryScreen';
import DatingInterestSelectionScreen from '../screens/dating/DatingInterestSelectionScreen';
import DatingIceBreakerSelectionScreen from '../screens/dating/DatingIceBreakerSelectionScreen';
import DatingProfileDetailScreen from '../screens/dating/DatingProfileDetailScreen';
import DatingChatDetailScreen from '../screens/dating/DatingChatDetailScreen';
import DatingPremiumScreen from '../screens/dating/DatingPremiumScreen';
import VettingQuizScreen from '../screens/dating/VettingQuizScreen';
import UploadCertificateScreen from '../screens/dating/UploadCertificateScreen';
import SpiritualMentorsScreen from '../screens/dating/SpiritualMentorsScreen';
import DatingDrawerNavigator from './DatingDrawerNavigator';

const Stack = createNativeStackNavigator<DatingStackParamList>();

export default function DatingNavigator() {
  const { hasDating } = useModuleStatus();
  const initialRoute: keyof DatingStackParamList = hasDating ? 'DatingMain' : 'DatingLobby';

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.dating,
        headerTitleStyle: { color: Colors.text, fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="DatingLobby" component={DatingLobbyScreen} options={{ title: 'Dating' }} />
      <Stack.Screen name="NonSpiritualEntry" component={NonSpiritualEntryScreen} options={{ title: 'Dating' }} />
      <Stack.Screen name="DatingInterestSelection" component={DatingInterestSelectionScreen} options={{ title: 'Your Interests' }} />
      <Stack.Screen name="DatingIceBreakerSelection" component={DatingIceBreakerSelectionScreen} options={{ title: 'Ice Breakers' }} />
      <Stack.Screen name="DatingMain" component={DatingDrawerNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="DatingProfileDetail" component={DatingProfileDetailScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="DatingChatDetail" component={DatingChatDetailScreen} options={{ title: 'Chat' }} />
      <Stack.Screen name="DatingPremium" component={DatingPremiumScreen} options={{ title: 'Go Premium' }} />
      <Stack.Screen name="SpiritualEntry" component={SpiritualEntryScreen} options={{ title: 'Spiritual Dating' }} />
      <Stack.Screen name="VettingQuiz" component={VettingQuizScreen} options={{ title: 'Vetting Quiz' }} />
      <Stack.Screen name="UploadCertificate" component={UploadCertificateScreen} options={{ title: 'Upload Certificate' }} />
      <Stack.Screen name="SpiritualMentors" component={SpiritualMentorsScreen} options={{ title: 'External Mentors' }} />
    </Stack.Navigator>
  );
}
