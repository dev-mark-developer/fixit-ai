import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

const LOGO = require('../../assets/fixit-app-logo.png');
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';
import api from '../../api/axios';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const handleSend = async () => {
    if (!email.trim()) { setError('Email is required'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim() });
      // Handle APIs that return 200 with success: false for unknown email
      if (res.data?.success === false || res.data?.isSuccess === false) {
        setAlert({
          title: 'Email Not Found',
          message: res.data?.message ?? 'No account is registered with this email address.',
        });
        return;
      }
      navigation.navigate('Otp', { email: email.trim(), purpose: 'ForgotPassword' });
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      if (status === 404 || status === 400) {
        setAlert({
          title: 'Email Not Found',
          message: msg ?? 'No account is registered with this email address. Please check and try again.',
        });
      } else if (!err.response) {
        setAlert({ title: 'Connection Error', message: 'Unable to connect to the server. Please check your network.' });
      } else {
        setAlert({ title: 'Error', message: msg ?? 'Something went wrong. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>Enter your email and we'll send you a code to reset your password.</Text>
      </View>

      <AppInput
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={(v) => { setEmail(v); setError(''); }}
        keyboardType="email-address"
        autoCapitalize="none"
        error={error}
        maxLength={100}
      />

      <AppButton title="Send Code" onPress={handleSend} loading={loading} style={styles.btn} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Remember your password? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.footerLink}>Sign In</Text>
        </TouchableOpacity>
      </View>

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
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
  btn: { marginTop: 8, marginBottom: 24 },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
