import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { getUser } from '../../store/auth';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';
import api from '../../api/axios';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ContactUs'>;

const extractError = (err: any): string => {
  const data = err?.response?.data;
  if (!err?.response) return 'Unable to connect to server. Please check your network.';
  if (data?.message) return data.message;
  if (data?.errors) {
    if (Array.isArray(data.errors)) {
      return data.errors.map((e: any) => e.description || e.message || String(e)).join('\n');
    }
    if (typeof data.errors === 'object') {
      return Object.values(data.errors).flat().join('\n');
    }
  }
  if (data?.title) return data.title;
  return `Server error (${err.response?.status}). Please try again.`;
};

export default function ContactUsScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  // Pre-fill name and email from the logged-in user
  useEffect(() => {
    getUser().then((user) => {
      if (user) {
        setName(`${user.firstName} ${user.lastName}`.trim());
        setEmail(user.email);
      }
    });
  }, []);

  const clearError = (field: string) =>
    setErrors((e) => ({ ...e, [field]: '' }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    else if (name.trim().length > 100) e.name = 'Name must be 100 characters or fewer';

    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email.trim())) e.email = 'Enter a valid email address';

    if (!subject.trim()) e.subject = 'Subject is required';
    else if (subject.trim().length > 100) e.subject = 'Subject must be 100 characters or fewer';

    if (!message.trim()) e.message = 'Message is required';
    else if (message.trim().length < 10) e.message = 'Message must be at least 10 characters';
    else if (message.trim().length > 500) e.message = 'Message must be 500 characters or fewer';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/inquiries', {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setAlert({
        title: 'Message Sent!',
        message: "We've received your message and will get back to you as soon as possible. Thank you for reaching out!",
      });
    } catch (err: any) {
      setAlert({ title: 'Submission Failed', message: extractError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <AppInput
        label="Your Name"
        placeholder="John Doe"
        value={name}
        onChangeText={(v) => { setName(v); clearError('name'); }}
        error={errors.name}
        maxLength={100}
        autoCapitalize="words"
      />

      <AppInput
        label="Email Address"
        placeholder="you@example.com"
        value={email}
        onChangeText={(v) => { setEmail(v); clearError('email'); }}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
        maxLength={150}
      />

      <AppInput
        label="Subject"
        placeholder="e.g. Account issue, Feature request..."
        value={subject}
        onChangeText={(v) => { setSubject(v); clearError('subject'); }}
        error={errors.subject}
        maxLength={100}
      />

      <AppInput
        label="Message"
        placeholder="Describe your issue or question in detail..."
        value={message}
        onChangeText={(v) => { setMessage(v); clearError('message'); }}
        error={errors.message}
        multiline
        numberOfLines={5}
        maxLength={500}
        style={styles.messageInput}
      />

      <AppButton
        title="Send Message"
        onPress={handleSubmit}
        loading={loading}
        style={styles.btn}
      />

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => {
          setAlert(null);
          if (alert?.title === 'Message Sent!') navigation.goBack();
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
  messageInput: { height: 120, textAlignVertical: 'top' },
  btn: { marginTop: 8 },
});
