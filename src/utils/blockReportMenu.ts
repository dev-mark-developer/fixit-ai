import { Alert } from 'react-native';

/**
 * The flag's choices on a card: Block or Report.
 *
 * Native alerts rather than a popover or modal sheet: a popover would be
 * clipped by the card it sits in, and on iOS a modal can't be presented while
 * another is still dismissing — which is exactly what Block → confirm, or
 * Report → the report modal, would do. Three buttons is also Android's limit.
 */
export function showBlockReportMenu(
  name: string,
  actions: { onBlock: () => Promise<void>; onReport: () => void },
): void {
  Alert.alert(name, undefined, [
    {
      text: 'Block',
      style: 'destructive',
      onPress: () => confirmBlock(name, actions.onBlock),
    },
    { text: 'Report', onPress: actions.onReport },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

function confirmBlock(name: string, onBlock: () => Promise<void>): void {
  Alert.alert(
    'Block User',
    `Are you sure you want to block ${name}? They will no longer be able to see or contact you.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => {
          onBlock().catch((err) => {
            Alert.alert(
              'Error',
              err?.response?.data?.message ?? 'Could not block this user. Please try again.',
            );
          });
        },
      },
    ],
  );
}
