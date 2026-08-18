import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
  useDrawerStatus,
} from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import type { MentorDrawerParamList, MentorStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../utils/colors';
import RemoteImage from '../components/common/RemoteImage';
import { useAuth } from '../store/AuthContext';
import { usersApi, UserProfile } from '../api/users';
import MentorDashboardScreen from '../screens/mentor/MentorDashboardScreen';

const Drawer = createDrawerNavigator<MentorDrawerParamList>();

const ICON_TINT = '#AEC63B'; // lime accent used for the mentor drawer icons

const LEGAL_TC = `Welcome to Fixit. By creating an account, you agree to these Terms & Conditions.\n\n1. Eligibility\nYou must be at least 18 years old to use Fixit.\n\n2. Acceptable Use\nYou agree not to use Fixit for any unlawful purpose or in any way that harms other users. Harassment, hate speech, or abusive behaviour will result in immediate account termination.\n\n3. User Content\nYou are responsible for all content you post. Fixit reserves the right to remove content that violates these terms.\n\n4. Privacy\nYour use of Fixit is also governed by our Privacy Policy.\n\n5. Subscriptions\nPaid subscriptions are billed monthly. You may cancel at any time through your device's app store.\n\n6. Account Termination\nFixit reserves the right to suspend or terminate your account for violations of these terms.\n\nFor questions, contact us at support@fixit.com`;

const LEGAL_PRIVACY = `Fixit is committed to protecting your privacy.\n\n1. Information We Collect\n- Account information (name, email, date of birth, gender, location)\n- Profile information (photos, bio, preferences)\n- Usage data (swipes, matches, messages)\n- Device information (device ID, platform, push token)\n\n2. How We Use Your Information\n- To provide and improve our services\n- To match you with other users\n- To send push notifications\n- To ensure safety and security\n\n3. Information Sharing\nWe do not sell your personal information.\n\n4. Your Rights\nYou may request access to, correction of, or deletion of your personal data by contacting support@fixit.com.\n\nContact: support@fixit.com`;

function MentorDrawerContent({ navigation }: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [legalModal, setLegalModal] = useState<'tc' | 'privacy' | null>(null);

  // Refetch the profile each time the drawer opens so name/photo edits
  // made on Edit Profile show up immediately.
  const drawerStatus = useDrawerStatus();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    if (drawerStatus !== 'open') return;
    usersApi.getProfile()
      .then(res => setProfile(res.data?.data ?? null))
      .catch(() => {});
  }, [drawerStatus]);

  const firstName = profile?.firstName ?? user?.firstName;
  const lastName = profile?.lastName ?? user?.lastName;
  const avatarUri = profile?.profileImageUrl;

  const initials = firstName && lastName
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    : '–';

  const parentNav = navigation.getParent<NativeStackNavigationProp<MentorStackParamList>>();
  const goToStack = (screen: keyof MentorStackParamList) => {
    navigation.closeDrawer();
    parentNav?.navigate(screen as any);
  };
  const goDrawer = (name: keyof MentorDrawerParamList) => navigation.navigate(name);

  // Mentors are still regular members — let them into the dating module.
  // MainNavigator swaps the tree for mentors, so the dating stack is opened
  // as a screen on the mentor stack rather than a root route.
  const goToDating = () => {
    navigation.closeDrawer();
    parentNav?.navigate('MentorDating' as any);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const items: { label: string; icon: string; onPress: () => void }[] = [
    { label: 'My Seekers', icon: 'home-outline', onPress: () => goDrawer('MentorDashboard') },
    { label: 'Explore Dating', icon: 'heart-outline', onPress: goToDating },
    { label: 'Edit Profile', icon: 'create-outline', onPress: () => goToStack('MentorEditProfile') },
    { label: 'My Subscription', icon: 'ribbon-outline', onPress: () => goToStack('MentorSubscription') },
    { label: 'Terms & Conditions', icon: 'document-text-outline', onPress: () => setLegalModal('tc') },
    { label: 'Privacy Policy', icon: 'lock-closed-outline', onPress: () => setLegalModal('privacy') },
    { label: 'Contact Us', icon: 'call-outline', onPress: () => goToStack('ContactUs') },
    { label: 'FAQs', icon: 'help-circle-outline', onPress: () => goToStack('Faqs') },
    { label: 'Change Password', icon: 'key-outline', onPress: () => goToStack('ChangePassword') },
    { label: 'Notifications', icon: 'notifications-outline', onPress: () => goToStack('Notifications') },
  ];

  return (
    <View style={styles.drawerRoot}>
      <DrawerContentScrollView
        contentContainerStyle={[styles.drawerContent, { paddingTop: insets.top + 8 }]}
      >
        {/* Close arrow */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.closeDrawer()} hitSlop={8}>
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        {/* Profile header */}
        <View style={styles.profileRow}>
          {avatarUri ? (
            <RemoteImage
              uri={avatarUri}
              style={styles.avatarImg}
              indicatorColor={Colors.mentor}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {firstName ? `${firstName} ${lastName}` : '—'}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {profile?.email ?? user?.email ?? '—'}
            </Text>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Icon name={item.icon} size={22} color={ICON_TINT} style={styles.menuIcon} />
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </DrawerContentScrollView>

      {/* Logout */}
      <View style={styles.logoutWrap}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Icon name="log-out-outline" size={18} color={Colors.white} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Legal modal */}
      <Modal visible={legalModal !== null} animationType="slide" onRequestClose={() => setLegalModal(null)}>
        <View style={styles.legalModal}>
          <View style={styles.legalHeader}>
            <Text style={styles.legalTitle}>
              {legalModal === 'tc' ? 'Terms & Conditions' : 'Privacy Policy'}
            </Text>
            <TouchableOpacity onPress={() => setLegalModal(null)} hitSlop={8}>
              <Text style={styles.legalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.legalScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.legalBody}>{legalModal === 'tc' ? LEGAL_TC : LEGAL_PRIVACY}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.legalDoneBtn} onPress={() => setLegalModal(null)}>
            <Text style={styles.legalDoneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const SHARED_HEADER = {
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.mentor,
  headerTitleStyle: { color: Colors.text, fontWeight: '700' as const },
  headerShadowVisible: false,
};

export default function MentorDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <MentorDrawerContent {...props} />}
      screenOptions={{
        drawerType: 'front',
        drawerStyle: { width: 300, backgroundColor: Colors.background },
        overlayColor: 'rgba(0,0,0,0.4)',
        swipeEdgeWidth: 50,
        ...SHARED_HEADER,
      }}
    >
      <Drawer.Screen
        name="MentorDashboard"
        component={MentorDashboardScreen}
        options={{ headerShown: false }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerRoot: { flex: 1, backgroundColor: Colors.background },
  drawerContent: { paddingTop: 8 },

  closeBtn: { paddingHorizontal: 20, paddingVertical: 8 },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.mentor, alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surface },
  avatarText: { fontSize: 19, fontWeight: '700', color: Colors.white },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 17, fontWeight: '800', color: Colors.text },
  profileEmail: { fontSize: 13, color: Colors.mentor, marginTop: 2 },

  menu: { paddingHorizontal: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIcon: { marginRight: 16, width: 24, textAlign: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '500', color: Colors.text },

  logoutWrap: { padding: 20 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.mentor,
    borderRadius: 14,
    paddingVertical: 16,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  legalModal: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  legalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  legalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  legalCloseText: { fontSize: 18, color: Colors.text },
  legalScroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  legalBody: { fontSize: 14, color: Colors.text, lineHeight: 22 },
  legalDoneBtn: {
    margin: 20, backgroundColor: Colors.mentor, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  legalDoneBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
