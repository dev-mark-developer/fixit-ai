import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../utils/colors';
import { sharedApi } from '../../api/shared';

interface Props {
  visible: boolean;
  reportedUserId: number;
  module: 'Dating' | 'Penpal';
  reportedName?: string;
  onClose: () => void;
}

const REASONS = [
  "I'm not interested in this person",
  'Fake profile',
  'Rude or abusive behaviour',
  'Spam or commercial',
  'Hate speech',
  'Underage',
  'Other',
];

const REASON_MAX = 500;

export default function ReportModal({
  visible,
  reportedUserId,
  module,
  reportedName,
  onClose,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const accent = module === 'Penpal' ? Colors.penpal : Colors.dating;
  const isOther = selected === 'Other';

  const handleClose = () => {
    setSelected(null);
    setOtherText('');
    setDone(false);
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!selected) {
      setError('Please select a reason.');
      return;
    }
    const reason = isOther ? otherText.trim() : selected;
    if (isOther && !reason) {
      setError('Please describe the reason for your report.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await sharedApi.reportUser(reportedUserId, reason, module);
      setDone(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          'Could not submit report. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {done ? (
            <>
              <Text style={styles.doneIcon}>✅</Text>
              <Text style={styles.doneTitle}>Report Submitted</Text>
              <Text style={styles.doneMsg}>
                Thank you. Our team will review this report and take appropriate
                action.
              </Text>
              <TouchableOpacity
                style={[styles.reportBtn, { backgroundColor: accent }]}
                onPress={handleClose}
              >
                <Text style={styles.reportBtnText}>Close</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title}>
                  Report{' '}
                  <Text style={{ color: accent }}>{reportedName ?? 'User'}</Text>
                </Text>
                <TouchableOpacity onPress={handleClose} hitSlop={8}>
                  <Text style={styles.close}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.reasonScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {REASONS.map(reason => {
                  const active = selected === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      style={styles.reasonRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelected(reason);
                        setError('');
                      }}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          active && { borderColor: accent },
                        ]}
                      >
                        {active && (
                          <View
                            style={[styles.radioInner, { backgroundColor: accent }]}
                          />
                        )}
                      </View>
                      <Text style={styles.reasonText}>{reason}</Text>
                    </TouchableOpacity>
                  );
                })}

                {isOther && (
                  <TextInput
                    style={styles.describeInput}
                    placeholder="Describe here"
                    placeholderTextColor={Colors.textMuted}
                    value={otherText}
                    onChangeText={v => {
                      setOtherText(v);
                      setError('');
                    }}
                    multiline
                    maxLength={REASON_MAX}
                    textAlignVertical="top"
                  />
                )}
              </ScrollView>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[styles.reportBtn, { backgroundColor: accent }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.reportBtnText}>Report</Text>
                )}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    maxHeight: '82%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 19, fontWeight: '800', color: Colors.text },
  close: { fontSize: 18, color: Colors.text },

  reasonScroll: { flexGrow: 0 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { flex: 1, fontSize: 14, color: Colors.text },
  describeInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: Colors.text,
    minHeight: 90,
    marginTop: 2,
    marginBottom: 4,
  },

  errorText: { fontSize: 12, color: Colors.error, marginTop: 8 },

  reportBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 14,
  },
  reportBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  doneIcon: { fontSize: 44, textAlign: 'center', marginBottom: 12 },
  doneTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  doneMsg: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
});
