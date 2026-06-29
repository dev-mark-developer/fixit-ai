import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { datingApi, DatingProfile } from '../../api/dating';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';

type Props = NativeStackScreenProps<DatingStackParamList, 'NonSpiritualEntry'>;

const GENDER_OPTIONS = ['Male', 'Female', 'Any'];

const extractError = (err: any): string => {
  const data = err?.response?.data;
  if (!err?.response) return 'Unable to connect to server. Check your network.';
  if (data?.message) return data.message;
  if (data?.title) return data.title;
  return `Error (${err.response?.status}). Please try again.`;
};

export default function NonSpiritualEntryScreen({ navigation }: Props) {
  const [phase, setPhase] = useState<'loading' | 'welcome' | 'setup'>('loading');
  const [interestedIn, setInterestedIn] = useState('Any');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await datingApi.getProfile();
        const profile: DatingProfile | null = res.data?.data ?? null;

        if (!profile) {
          setPhase('setup');
          return;
        }

        // Profile exists — go to DatingMain (interests already set or user can set them from discover)
        navigation.replace('DatingMain');
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setPhase('setup');
        } else {
          setPhase('welcome');
        }
      }
    })();
  }, [navigation]);

  const handleCreateProfile = async () => {
    setSaving(true);
    try {
      await datingApi.saveProfile({
        datingType: 'NonSpiritual',
        interestedInGender: interestedIn,
      });
      // After creating profile, go to interest selection
      navigation.replace('DatingInterestSelection', { datingType: 'NonSpiritual' });
    } catch (err: any) {
      setAlert({ title: 'Error', message: extractError(err) });
    } finally {
      setSaving(false);
    }
  };

  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.dating} />
      </View>
    );
  }

  // Welcome screen (fallback / error loading profile)
  if (phase === 'welcome') {
    return (
      <View style={styles.center}>
        <Text style={styles.heroIcon}>❤️</Text>
        <Text style={styles.heroTitle}>Non-Spiritual Dating</Text>
        <Text style={styles.heroSub}>
          Meet people who share your interests and values.
        </Text>
        <AppButton
          title="Get Started"
          onPress={() => setPhase('setup')}
          style={styles.primaryBtn}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>❤️</Text>
        <Text style={styles.heroTitle}>Set Up Your Profile</Text>
        <Text style={styles.heroSub}>
          Tell us a little about who you're looking for. You can update this anytime.
        </Text>
      </View>

      {/* Interested In */}
      <Text style={styles.label}>I'm interested in</Text>
      <View style={styles.genderRow}>
        {GENDER_OPTIONS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.genderBtn, interestedIn === g && styles.genderBtnActive]}
            onPress={() => setInterestedIn(g)}
            activeOpacity={0.75}
          >
            <Text style={[styles.genderBtnText, interestedIn === g && styles.genderBtnTextActive]}>
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Features */}
      <View style={styles.featuresCard}>
        {[
          { icon: '💫', text: '10 free swipes per day' },
          { icon: '⭐', text: '1 super like per day' },
          { icon: '💞', text: 'Real-time matching & chat' },
          { icon: '🔒', text: 'Block & report controls' },
        ].map((f) => (
          <View key={f.text} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      <AppButton
        title="Create Profile & Explore"
        onPress={handleCreateProfile}
        loading={saving}
        style={styles.primaryBtn}
      />

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => setAlert(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: 32 },
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: 24, paddingBottom: 40 },

  hero: { alignItems: 'center', marginBottom: 32 },
  heroIcon: { fontSize: 56, marginBottom: 14 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: Colors.dating, marginBottom: 10, textAlign: 'center' },
  heroSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },

  label: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  genderBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  genderBtnActive: { borderColor: Colors.dating, backgroundColor: Colors.datingLight },
  genderBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  genderBtnTextActive: { color: Colors.dating },

  featuresCard: {
    backgroundColor: Colors.datingLight,
    borderRadius: 14,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  featureIcon: { fontSize: 18, marginRight: 12 },
  featureText: { fontSize: 14, color: Colors.text, fontWeight: '500' },

  primaryBtn: { backgroundColor: Colors.dating },
});
