import { Alert } from 'react-native';
import { usersApi } from '../api/users';

/**
 * Delete Account — one flow shared by every settings surface (member profile
 * and the dating / penpal / mentor drawers).
 *
 * Native alerts for the same reason as blockReportMenu: the entry points sit
 * inside drawers, where an RN modal can't present while the drawer is still
 * closing. Two confirmations because the action is irreversible — a single
 * mis-tap in a drawer must never be able to reach it.
 *
 * On success the caller's `logout` tears the session down: the account is
 * gone server-side, and the local cleanup needed (push token, badge, image
 * cache, stored session) is exactly the sign-out path.
 */
export function confirmDeleteAccount(logout: () => Promise<void>): void {
  Alert.alert(
    'Delete Account',
    'This permanently deletes your account and everything in it — your profile, matches, chats, letters and subscription access.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Account',
        style: 'destructive',
        onPress: () => confirmForever(logout),
      },
    ],
  );
}

function confirmForever(logout: () => Promise<void>): void {
  Alert.alert(
    'Are you sure?',
    'Your account cannot be recovered once it is deleted.',
    [
      { text: 'Keep My Account', style: 'cancel' },
      {
        text: 'Delete Forever',
        style: 'destructive',
        onPress: async () => {
          try {
            await usersApi.deleteAccount();
          } catch (err: any) {
            Alert.alert(
              'Error',
              err?.response?.data?.message ??
                'Could not delete your account. Please try again.',
            );
            return;
          }
          await logout();
        },
      },
    ],
  );
}
