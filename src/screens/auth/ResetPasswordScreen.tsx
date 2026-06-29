import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

const LOGO = require('../../assets/fixit-app-logo.png');
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';
import api from '../../api/axios';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter (a–z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number (0–9)', test: (p: string) => /\d/.test(p) },
  { label: 'Special character (!@#...)', test: (p: string) => /[^a-zA-Z\d]/.test(p) },
];

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { email, otpCode } = route.params;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string; buttons?: AlertButton[] } | null>(null);

  const showAlert = (title: string, message: string, buttons?: AlertButton[]) =>
    setAlert({ title, message, buttons });

  const allRulesMet = PASSWORD_RULES.every((r) => r.test(password));

  const validate = () => {
    const e: typeof errors = {};
    if (!password) e.password = 'Password is required';
    else if (!allRulesMet) e.password = 'Password does not meet all requirements';
    if (password !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email, otpCode, newPassword: password, confirmPassword: confirm,
      });
      showAlert('Password Reset', 'Your password has been reset. You can now sign in.', [
        { text: 'Sign In', style: 'default', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err: any) {
      showAlert('Error', err.response?.data?.message ?? 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>Create a strong password for your account.</Text>
        </View>

        <AppInput
          label="New Password"
          placeholder="New password"
          value={password}
          onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })); }}
          secureToggle
          error={errors.password}
          onBlur={() => setPasswordTouched(true)}
        />

        {passwordTouched && (
          <View style={styles.policyBox}>
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
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
          label="Confirm Password"
          placeholder="Repeat new password"
          value={confirm}
          onChangeText={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: '' })); }}
          secureToggle
          error={errors.confirm}
        />

        <AppButton title="Reset Password" onPress={handleReset} loading={loading} style={styles.btn} />

        <AppAlert
          visible={!!alert}
          title={alert?.title ?? ''}
          message={alert?.message}
          buttons={alert?.buttons}
          onClose={() => setAlert(null)}
        />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: 24, paddingTop: 80, justifyContent: 'center' },
  header: { marginBottom: 40 },
  logo: { width: 130, height: 100, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textSecondary },
  policyBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginTop: -8,
    marginBottom: 16,
    gap: 6,
  },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  policyIcon: { fontSize: 13, fontWeight: '700', width: 16 },
  policyLabel: { fontSize: 12 },
  policyMet: { color: Colors.success },
  policyUnmet: { color: Colors.textMuted },
  btn: { marginTop: 8, marginBottom: 16 },
});
