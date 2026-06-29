import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { Colors } from '../../utils/colors';
import { useAuth } from '../../store/AuthContext';
import { useModuleStatus } from '../../store/ModuleStatusContext';
import { saveSession } from '../../store/auth';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';
import api from '../../api/axios';

const BENEFITS = [
  { icon: '👥', title: 'Guide Others', desc: 'Be matched with seekers who need your wisdom and guidance.' },
  { icon: '🌿', title: 'Make an Impact', desc: 'Help others grow spiritually and personally through your journey.' },
  { icon: '🎓', title: 'Mentor Dashboard', desc: 'Manage your assigned users and track their progress.' },
  { icon: '🔔', title: 'Stay Notified', desc: 'Get notified when new seekers are assigned to you.' },
];

export default function MentorSetupScreen() {
  const { user } = useAuth();
  const { refresh } = useModuleStatus();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const handleBecomeMentor = async () => {
    setLoading(true);
    try {
      const res = await api.post('/users/upgrade-to-mentor');
      const { accessToken } = res.data?.data ?? {};
      if (!accessToken) throw new Error('Invalid server response.');
      await saveSession(accessToken, { ...user!, role: 'Mentor' });
      // refresh() detects isMentor=true → MainNavigator renders MentorNavigator
      await refresh();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? (!err.response
        ? 'Unable to connect to server.'
        : 'Could not complete the upgrade. Please try again.');
      setAlert({ title: 'Error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🎓</Text>
          <Text style={styles.heroTitle}>Become a Spiritual Guru</Text>
          <Text style={styles.heroSubtitle}>
            Share your wisdom. Guide others on their journey. Make a difference.
          </Text>
        </View>

        <View style={styles.benefitsCard}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>{b.icon}</Text>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <AppButton
          title="Start My Guru Journey"
          onPress={handleBecomeMentor}
          loading={loading}
          style={styles.btn}
        />

        <Text style={styles.disclaimer}>
          By continuing, you agree to take on the responsibility of guiding seekers
          assigned to you with care and integrity.
        </Text>
      </ScrollView>

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
    padding: 24,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  heroIcon: { fontSize: 64, marginBottom: 16 },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.mentor,
    marginBottom: 10,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  benefitsCard: {
    backgroundColor: Colors.mentorLight,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 28,
    gap: 16,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start' },
  benefitIcon: { fontSize: 24, marginRight: 14, marginTop: 1 },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  benefitDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  btn: { marginBottom: 16 },
  disclaimer: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
});
