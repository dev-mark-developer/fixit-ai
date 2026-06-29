import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Colors } from '../../utils/colors';
import { sharedApi } from '../../api/shared';

interface Props {
  visible: boolean;
  reportedUserId: number;
  module: 'Dating' | 'Penpal';
  onClose: () => void;
}

const REASON_MAX = 500;

export default function ReportModal({ visible, reportedUserId, module, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setReason('');
    setDone(false);
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please describe the reason for your report.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await sharedApi.reportUser(reportedUserId, reason.trim(), module);
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const nearLimit = reason.length >= REASON_MAX * 0.85;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {done ? (
            <>
              <Text style={styles.doneIcon}>✅</Text>
              <Text style={styles.title}>Report Submitted</Text>
              <Text style={styles.doneMsg}>
                Thank you. Our team will review this report and take appropriate action.
              </Text>
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                <Text style={styles.submitBtnText}>Close</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Report User</Text>
              <Text style={styles.subtitle}>
                Describe why you're reporting this user. We review all reports carefully.
              </Text>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="E.g. Inappropriate content, harassment, spam..."
                  placeholderTextColor={Colors.textMuted}
                  value={reason}
                  onChangeText={(v) => { setReason(v); setError(''); }}
                  multiline
                  maxLength={REASON_MAX}
                  textAlignVertical="top"
                />
                <Text style={[styles.counter, nearLimit && styles.counterNear]}>
                  {reason.length}/{REASON_MAX}
                </Text>
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={submitting}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                  {submitting
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <Text style={styles.submitBtnText}>Submit</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 360,
  },
  doneIcon: { fontSize: 44, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 16 },
  doneMsg: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 },
  inputWrapper: { marginBottom: 4 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    padding: 12, fontSize: 14, color: Colors.text, backgroundColor: Colors.background,
    minHeight: 100,
  },
  counter: { fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 8 },
  counterNear: { color: Colors.error },
  errorText: { fontSize: 12, color: Colors.error, marginBottom: 12 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  submitBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.error,
  },
  closeBtn: {
    paddingVertical: 13, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.error, marginTop: 4,
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
