import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

const LOGO = require('../../assets/fixit-app-logo.png');
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { getDeviceId, getPlatform, getPushToken } from '../../utils/device';
import { useAuth } from '../../store/AuthContext';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';
import api from '../../api/axios';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(
    null,
  );

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const [deviceId, pushToken] = await Promise.all([
        getDeviceId(),
        getPushToken(),
      ]);
      const res = await api.post('/auth/login', {
        email: email.trim(),
        password,
        deviceId,
        platform: getPlatform(),
        deviceName: 'Mobile App',
        pushToken,
      });
      const data = res.data?.data;
      await login(
        data.accessToken,
        {
          id: data.userId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          role: data.role,
        },
        data.refreshToken,
      );
    } catch (err: any) {
      const msg =
        err.response?.data?.message ??
        (!err.response
          ? 'Unable to connect to server. Please check your network.'
          : 'Please check your credentials and try again.');
      setAlert({ title: 'Login Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={styles.container}
      extraHeight={80}
    >
      <View style={styles.header}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Welcome back!</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>
      </View>

      <AppInput
        label="Email Address"
        placeholder="Enter your email address"
        value={email}
        onChangeText={v => {
          setEmail(v);
          setErrors(e => ({ ...e, email: '' }));
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.email}
        maxLength={100}
      />
      <AppInput
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={v => {
          setPassword(v);
          setErrors(e => ({ ...e, password: '' }));
        }}
        secureToggle
        error={errors.password}
      />

      <TouchableOpacity
        onPress={() => navigation.navigate('ForgotPassword')}
        style={styles.forgotWrap}
      >
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </TouchableOpacity>

      <AppButton
        title="Login"
        onPress={handleLogin}
        loading={loading}
        style={styles.btn}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.footerLink}>Sign Up</Text>
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
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  header: { marginBottom: 40 },
  logo: { width: 130, height: 100, marginBottom: 24 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: { fontSize: 15, color: Colors.textSecondary },
  forgotWrap: { alignSelf: 'flex-end', marginBottom: 24, marginTop: -8 },
  forgotText: { color: Colors.primary, fontSize: 14, fontWeight: '500' },
  btn: { marginBottom: 24 },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
