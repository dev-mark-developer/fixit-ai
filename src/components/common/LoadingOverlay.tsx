import React from 'react';
import { Modal, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../../utils/colors';

interface Props {
  visible: boolean;
  /** Optional line under the spinner, e.g. "Signing out…". */
  label?: string;
}

/**
 * Blocking, app-wide "this is working" overlay for an action that has no
 * screen of its own to spin on — sign-out being the case that prompted it.
 *
 * A `Modal` rather than an absolutely-positioned view so it covers whatever is
 * on screen (drawer, sheet, alert) and swallows taps while the action runs.
 */
export default function LoadingOverlay({ visible, label }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={Colors.primary} />
          {!!label && <Text style={styles.label}>{label}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    minWidth: 140,
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
  },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
});
