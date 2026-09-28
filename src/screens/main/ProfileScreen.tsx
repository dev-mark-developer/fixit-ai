import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { getUser, AuthUser } from '../../store/auth';
import { useAuth } from '../../store/AuthContext';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';
import LegalPageModal from '../../components/common/LegalPageModal';
import type { ContentPageSlug } from '../../api/content';
import { confirmDeleteAccount } from '../../utils/deleteAccount';

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
  const [legalModal, setLegalModal] = useState<ContentPageSlug | null>(null);
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
    {
      icon: '🗑️',
      label: 'Delete Account',
      onPress: () => confirmDeleteAccount(logout),
      destructive: true,
    },
  ];

  const supportItems: MenuItem[] = [
    { icon: '❓', label: 'FAQs', onPress: () => navigation.navigate('Faqs') },
    { icon: '📧', label: 'Contact Us', onPress: () => navigation.navigate('ContactUs') },
    { icon: '📄', label: 'Terms & Conditions', onPress: () => setLegalModal('terms-and-conditions') },
    { icon: '🛡️', label: 'User Guidelines', onPress: () => setLegalModal('user-guidelines') },
    { icon: '🔒', label: 'Privacy Policy', onPress: () => setLegalModal('privacy-policy') },
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
              <Text style={[styles.menuLabel, item.destructive && styles.menuLabelDestructive]}>
                {item.label}
              </Text>
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

      <LegalPageModal slug={legalModal} onClose={() => setLegalModal(null)} />
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
  menuLabelDestructive: { color: Colors.error },
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
});
