/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundHandler } from './src/services/pushNotifications';
import { registerLocalBackgroundHandler } from './src/services/localNotifications';

// Both must be registered at module scope, before the app renders: when the
// app is woken for a background message — or a notification is pressed while
// it's backgrounded — there is no component tree to hang a listener off.
registerBackgroundHandler();
registerLocalBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
