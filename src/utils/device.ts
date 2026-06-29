import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'device_id';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getPlatform(): string {
  return Platform.OS === 'ios' ? 'iOS' : 'Android';
}

/**
 * Returns the FCM push token for the current device.
 *
 * TO ENABLE PUSH NOTIFICATIONS:
 * 1. npm install @react-native-firebase/app @react-native-firebase/messaging
 * 2. Create a Firebase project at https://console.firebase.google.com
 * 3. Add google-services.json to android/app/
 * 4. Add GoogleService-Info.plist to ios/
 * 5. Run: cd android && ./gradlew clean
 * 6. Replace the body of this function with:
 *      const messaging = require('@react-native-firebase/messaging').default;
 *      await messaging().requestPermission();
 *      return await messaging().getToken();
 */
export async function getPushToken(): Promise<string | null> {
  return null;
}
