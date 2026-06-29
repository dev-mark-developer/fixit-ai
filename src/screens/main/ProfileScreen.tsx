import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { getUser, AuthUser } from '../../store/auth';
import { useAuth } from '../../store/AuthContext';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export default function ProfileScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [legalModal, setLegalModal] = useState<'tc' | 'privacy' | null>(null);
  const [alert, setAlert] = useState<{ title: string; message: string; buttons?: AlertButton[] } | null>(null);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : '??';

  const roleBadge = user?.role === 'Mentor' ? '🌟 Spiritual Guru' : '👤 Member';

  const handleLogout = () => {
    setAlert({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    });
  };

  const accountItems: MenuItem[] = [
    {
      icon: '🔔',
      label: 'Notifications',
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      icon: '🔑',
      label: 'Change Password',
      onPress: () => navigation.navigate('ChangePassword'),
    },
  ];

  const supportItems: MenuItem[] = [
    { icon: '❓', label: 'FAQs', onPress: () => navigation.navigate('Faqs') },
    { icon: '📧', label: 'Contact Us', onPress: () => navigation.navigate('ContactUs') },
    { icon: '📄', label: 'Terms & Conditions', onPress: () => setLegalModal('tc') },
    { icon: '🔒', label: 'Privacy Policy', onPress: () => setLegalModal('privacy') },
  ];

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Avatar + Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.fullName}>
            {user ? `${user.firstName} ${user.lastName}` : '—'}
          </Text>
          <Text style={styles.email}>{user?.email ?? '—'}</Text>
          <View style={styles.roleBadgeWrap}>
            <Text style={styles.roleBadge}>{roleBadge}</Text>
          </View>
        </View>

        {/* Account Section */}
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.menuCard}>
          {accountItems.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuRow, idx < accountItems.length - 1 && styles.menuRowBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Support Section */}
        <Text style={styles.sectionHeader}>Support</Text>
        <View style={styles.menuCard}>
          {supportItems.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuRow, idx < supportItems.length - 1 && styles.menuRowBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Fixit v1.0.0</Text>
      </ScrollView>

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        buttons={alert?.buttons}
        onClose={() => setAlert(null)}
      />

      <Modal visible={legalModal !== null} animationType="slide" onRequestClose={() => setLegalModal(null)}>
        <View style={styles.legalModal}>
          <View style={styles.legalHeader}>
            <Text style={styles.legalTitle}>
              {legalModal === 'tc' ? 'Terms & Conditions' : 'Privacy Policy'}
            </Text>
            <TouchableOpacity onPress={() => setLegalModal(null)} style={styles.legalClose}>
              <Text style={styles.legalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.legalScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.legalBody}>
              {legalModal === 'tc'
                ? `Welcome to Fixit. By creating an account, you agree to these Terms & Conditions.\n\n1. Eligibility\nYou must be at least 18 years old to use Fixit.\n\n2. Acceptable Use\nYou agree not to use Fixit for any unlawful purpose or in any way that harms other users. Harassment, hate speech, or abusive behaviour will result in immediate account termination.\n\n3. User Content\nYou are responsible for all content you post. Fixit reserves the right to remove content that violates these terms.\n\n4. Privacy\nYour use of Fixit is also governed by our Privacy Policy.\n\n5. Subscriptions\nPaid subscriptions are billed monthly. You may cancel at any time through your device's app store.\n\n6. Account Termination\nFixit reserves the right to suspend or terminate your account for violations of these terms.\n\nFor questions, contact us at support@fixit.com`
                : `Fixit is committed to protecting your privacy.\n\n1. Information We Collect\n- Account information (name, email, date of birth, gender, location)\n- Profile information (photos, bio, preferences)\n- Usage data (swipes, matches, messages)\n- Device information (device ID, platform, push token)\n\n2. How We Use Your Information\n- To provide and improve our services\n- To match you with other users\n- To send push notifications\n- To ensure safety and security\n\n3. Information Sharing\nWe do not sell your personal information.\n\n4. Your Rights\nYou may request access to, correction of, or deletion of your personal data by contacting support@fixit.com.\n\nContact: support@fixit.com`}
            </Text>
          </ScrollView>
          <TouchableOpacity style={styles.legalDoneBtn} onPress={() => setLegalModal(null)}>
            <Text style={styles.legalDoneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },

  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: Colors.navy,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: Colors.white },
  fullName: { fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 10 },
  roleBadgeWrap: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleBadge: { fontSize: 13, color: Colors.white, fontWeight: '600' },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 20,
  },

  menuCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '500' },
  menuChevron: { fontSize: 20, color: Colors.textMuted },

  logoutBtn: {
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.error },

  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 20,
  },

  legalModal: { flex: 1, backgroundColor: Colors.background },
  legalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  legalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  legalClose: { padding: 4 },
  legalCloseText: { fontSize: 18, color: Colors.textSecondary },
  legalScroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  legalBody: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, paddingBottom: 24 },
  legalDoneBtn: {
    margin: 20, backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  legalDoneBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
