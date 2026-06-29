import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MentorStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { useAuth } from '../../store/AuthContext';
import { mentorApi } from '../../api/mentor';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';

type Props = NativeStackScreenProps<MentorStackParamList, 'MentorProfileSetup'>;

export default function MentorProfileSetupScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(
    user ? `${user.firstName} ${user.lastName}`.trim() : '',
  );
  const [bio, setBio] = useState('');
  const [tagline, setTagline] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const clearError = (key: string) => setErrors((e) => ({ ...e, [key]: '' }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!displayName.trim()) e.displayName = 'Display name is required';
    else if (displayName.trim().length < 2) e.displayName = 'Display name must be at least 2 characters';
    if (!bio.trim()) e.bio = 'Bio is required';
    else if (bio.trim().length < 20) e.bio = 'Bio must be at least 20 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await mentorApi.saveProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        tagline: tagline.trim() || undefined,
      });
      navigation.replace('MentorSubscription');
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Failed to save profile. Please try again.';
      setAlert({ title: 'Error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <KeyboardAwareScrollView contentContainerStyle={styles.container} extraHeight={80}>

        <View style={styles.header}>
          <Text style={styles.headerIcon}>✨</Text>
          <Text style={styles.headerTitle}>Complete Your Profile</Text>
          <Text style={styles.headerSubtitle}>
            Help seekers know who you are and what you offer.
          </Text>
        </View>

        <AppInput
          label="Display Name *"
          placeholder="How would you like to appear to others?"
          value={displayName}
          onChangeText={(v) => { setDisplayName(v); clearError('displayName'); }}
          error={errors.displayName}
          maxLength={100}
          autoCapitalize="words"
        />

        <AppInput
          label="Tagline"
          placeholder="A short phrase that describes your guidance (optional)"
          value={tagline}
          onChangeText={(v) => { setTagline(v); clearError('tagline'); }}
          error={errors.tagline}
          maxLength={150}
        />

        <AppInput
          label="Bio *"
          placeholder="Share your journey, expertise, and how you can help others..."
          value={bio}
          onChangeText={(v) => { setBio(v); clearError('bio'); }}
          error={errors.bio}
          maxLength={1000}
          multiline
          numberOfLines={6}
          style={{ height: 140, textAlignVertical: 'top', paddingTop: 12, flex: 1, fontSize: 15, color: Colors.text }}
        />

        <AppButton
          title="Next: Choose Your Plan"
          onPress={handleNext}
          loading={loading}
          style={styles.btn}
        />

      </KeyboardAwareScrollView>

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => setAlert(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    padding: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 8,
  },
  headerIcon: { fontSize: 40, marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.mentor, marginBottom: 6 },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: { marginTop: 8 },
});
