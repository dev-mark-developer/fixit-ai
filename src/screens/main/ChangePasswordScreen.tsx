import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';
import api from '../../api/axios';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ChangePassword'>;

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter (a–z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number (0–9)', test: (p: string) => /\d/.test(p) },
  { label: 'Special character (!@#...)', test: (p: string) => /[^a-zA-Z\d]/.test(p) },
];

export default function ChangePasswordScreen({ navigation }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const allRulesMet = PASSWORD_RULES.every((r) => r.test(newPassword));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!currentPassword) e.currentPassword = 'Current password is required';
    if (!newPassword) e.newPassword = 'New password is required';
    else if (!allRulesMet) e.newPassword = 'Password does not meet all requirements';
    if (!confirmPassword) e.confirmPassword = 'Please confirm your new password';
    else if (newPassword !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setAlert({ title: 'Password Changed', message: 'Your password has been updated successfully.' });
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data?.message ?? data?.title ?? 'Failed to change password. Please try again.';
      setAlert({ title: 'Error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <AppInput
        label="Current Password"
        placeholder="Enter current password"
        value={currentPassword}
        onChangeText={(v) => { setCurrentPassword(v); setErrors((e) => ({ ...e, currentPassword: '' })); }}
        secureToggle
        error={errors.currentPassword}
      />

      <AppInput
        label="New Password"
        placeholder="Create a new password"
        value={newPassword}
        onChangeText={(v) => { setNewPassword(v); setErrors((e) => ({ ...e, newPassword: '' })); }}
        secureToggle
        error={errors.newPassword}
        onBlur={() => setNewPasswordTouched(true)}
      />

      {/* Password strength rules — shown after first blur */}
      {newPasswordTouched && (
        <View style={styles.policyBox}>
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(newPassword);
            return (
              <View key={rule.label} style={styles.policyRow}>
                <Text style={[styles.policyIcon, met ? styles.policyMet : styles.policyUnmet]}>
                  {met ? '✓' : '○'}
                </Text>
                <Text style={[styles.policyLabel, met ? styles.policyMet : styles.policyUnmet]}>
                  {rule.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <AppInput
        label="Confirm New Password"
        placeholder="Repeat new password"
        value={confirmPassword}
        onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirmPassword: '' })); }}
        secureToggle
        error={errors.confirmPassword}
      />

      <AppButton
        title="Update Password"
        onPress={handleSave}
        loading={loading}
        style={styles.btn}
      />

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => {
          setAlert(null);
          if (alert?.title === 'Password Changed') navigation.goBack();
        }}
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    padding: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  policyBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  policyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  policyIcon: { fontSize: 13, marginRight: 8, width: 16 },
  policyLabel: { fontSize: 13 },
  policyMet: { color: Colors.success },
  policyUnmet: { color: Colors.textMuted },
  btn: { marginTop: 8 },
});
