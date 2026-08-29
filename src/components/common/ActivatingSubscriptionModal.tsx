import React from 'react';
import {
  ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '../../utils/colors';

interface Props {
  visible: boolean;
  accent: string;
  /**
   * `waiting` while we poll for Apple's server notification, `timeout` once the
   * webhook has taken longer than the activation window. Payment has already
   * gone through in both cases — this is never an error state.
   */
  phase: 'waiting' | 'timeout';
  checking?: boolean;
  onCheckAgain: () => void;
  onDismiss: () => void;
}

/**
 * Shown between Apple confirming the payment and our backend granting the
 * entitlement. Access is driven by the App Store webhook, so there is a short
 * gap where the purchase is real but the account isn't premium yet.
 */
export default function ActivatingSubscriptionModal({
  visible, accent, phase, checking, onCheckAgain, onDismiss,
}: Props) {
  const waiting = phase === 'waiting';

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={waiting ? () => {} : onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {waiting ? (
            <>
              <ActivityIndicator size="large" color={accent} style={styles.spinner} />
              <Text style={styles.title}>Activating your subscription…</Text>
              <Text style={styles.message}>
                Your payment went through. We're just waiting for the App Store
                to confirm it — this usually takes a few seconds.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>This is taking longer than usual</Text>
              <Text style={styles.message}>
                Your payment went through and nothing was lost. The App Store
                hasn't confirmed it with us yet — it normally arrives within a
                few minutes.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: accent }]}
                onPress={onCheckAgain}
                disabled={checking}
                activeOpacity={0.85}
              >
                {checking
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.primaryBtnText}>Check Again</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={onDismiss} activeOpacity={0.7} disabled={checking}>
                <Text style={styles.secondaryBtnText}>Close</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  spinner: { marginBottom: 18 },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 14,
  },
});
