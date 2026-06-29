import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image,
} from 'react-native';

const LOGO = require('../../assets/fixit-app-logo.png');
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import AppButton from '../../components/common/AppButton';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';
import api from '../../api/axios';
import { useAuth } from '../../store/AuthContext';
import { getDeviceId, getPlatform } from '../../utils/device';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

const OTP_LENGTH = 6;

export default function OtpScreen({ navigation, route }: Props) {
  const { email, purpose, password } = route.params;
  const { login } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [submitted, setSubmitted] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string; buttons?: AlertButton[] } | null>(null);
  const inputRef = useRef<TextInput>(null);

  const showAlert = (title: string, message: string, buttons?: AlertButton[]) =>
    setAlert({ title, message, buttons });

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
    if (submitted && digits.length === OTP_LENGTH) setSubmitted(false);
  };

  const handleVerify = async () => {
    setSubmitted(true);
    if (otp.length < OTP_LENGTH) {
      showAlert('Incomplete Code', 'Please fill in all 6 digits.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { email, otpCode: otp, purpose });
      if (purpose === 'Registration') {
        if (password) {
          try {
            const deviceId = await getDeviceId();
            const loginRes = await api.post('/auth/login', {
              email, password, deviceId, platform: getPlatform(), deviceName: 'Mobile App',
            });
            const d = loginRes.data?.data;
            if (d?.accessToken) {
              await login(d.accessToken, {
                id: d.userId, firstName: d.firstName, lastName: d.lastName,
                email: d.email, role: d.role,
              }, d.refreshToken);
              return; // AuthContext state change navigates to Home automatically
            }
          } catch {
            // fall through to manual sign-in prompt
          }
        }
        showAlert('Email Verified', 'Your account is ready. You can now sign in.', [
          { text: 'Sign In', style: 'default', onPress: () => navigation.navigate('Login') },
        ]);
      } else {
        navigation.navigate('ResetPassword', { email, otpCode: otp });
      }
    } catch (err: any) {
      showAlert('Invalid Code', err.response?.data?.message ?? 'The code is incorrect or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      if (purpose === 'Registration') {
        await api.post('/auth/register/resend-otp', { email });
      } else {
        await api.post('/auth/forgot-password', { email });
      }
      setCountdown(60);
      setOtp('');
      setSubmitted(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      showAlert('Error', err.response?.data?.message ?? 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>
      </View>

      {/* Hidden input captures all typing */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={otp}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoFocus
        caretHidden
      />

      {/* Visual digit boxes */}
      <TouchableOpacity
        style={styles.otpRow}
        onPress={() => inputRef.current?.focus()}
        activeOpacity={1}
      >
        {Array(OTP_LENGTH).fill(0).map((_, i) => {
          const digit = otp[i] || '';
          const isFocused = i === otp.length && otp.length < OTP_LENGTH;
          const isEmpty = submitted && !digit;
          return (
            <View
              key={i}
              style={[
                styles.otpBox,
                digit ? styles.otpBoxFilled : null,
                isFocused ? styles.otpBoxFocused : null,
                isEmpty ? styles.otpBoxError : null,
              ]}
            >
              <Text style={styles.otpDigit}>{digit}</Text>
            </View>
          );
        })}
      </TouchableOpacity>

      <AppButton title="Verify" onPress={handleVerify} loading={loading} style={styles.btn} />

      <View style={styles.resendRow}>
        <Text style={styles.resendText}>Didn't receive the code? </Text>
        {countdown > 0 ? (
          <Text style={styles.countdown}>Resend in {countdown}s</Text>
        ) : (
          <TouchableOpacity onPress={handleResend} disabled={resending}>
            <Text style={styles.resendLink}>{resending ? 'Sending...' : 'Resend'}</Text>
          </TouchableOpacity>
        )}
      </View>

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
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: 24, paddingTop: 56 },
  back: { marginBottom: 32 },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  header: { marginBottom: 40 },
  logo: { width: 130, height: 100, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  email: { color: Colors.text, fontWeight: '600' },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 36,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  otpBoxFocused: { borderColor: Colors.primary, borderWidth: 2 },
  otpBoxError: { borderColor: Colors.error, backgroundColor: '#FEF2F2' },
  otpDigit: { fontSize: 22, fontWeight: '700', color: Colors.text },
  btn: { marginBottom: 24 },
  resendRow: { flexDirection: 'row', justifyContent: 'center' },
  resendText: { color: Colors.textSecondary, fontSize: 14 },
  resendLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  countdown: { color: Colors.textMuted, fontSize: 14 },
});
