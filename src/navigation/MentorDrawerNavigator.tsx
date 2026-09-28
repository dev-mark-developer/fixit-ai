import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
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
import LegalPageModal from '../components/common/LegalPageModal';
import type { ContentPageSlug } from '../api/content';
import { useAuth } from '../store/AuthContext';
import { usersApi, UserProfile } from '../api/users';
import { confirmDeleteAccount } from '../utils/deleteAccount';
import MentorDashboardScreen from '../screens/mentor/MentorDashboardScreen';

const Drawer = createDrawerNavigator<MentorDrawerParamList>();

const ICON_TINT = '#AEC63B'; // lime accent used for the mentor drawer icons

function MentorDrawerContent({ navigation }: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [legalModal, setLegalModal] = useState<ContentPageSlug | null>(null);

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

  // Mentors are still regular members — let them into the penpal module.
  // MainNavigator swaps the tree for mentors, so the penpal stack is opened as
  // a screen on the mentor stack rather than a root route.
  const goToPenpal = () => {
    navigation.closeDrawer();
    parentNav?.navigate('MentorPenpal');
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const items: { label: string; icon: string; onPress: () => void }[] = [
    { label: 'My Seekers', icon: 'home-outline', onPress: () => goDrawer('MentorDashboard') },
    { label: 'Penpal Group', icon: 'mail-outline', onPress: goToPenpal },
    { label: 'Edit Profile', icon: 'create-outline', onPress: () => goToStack('MentorEditProfile') },
    { label: 'My Subscription', icon: 'ribbon-outline', onPress: () => goToStack('MentorSubscription') },
    { label: 'Terms & Conditions', icon: 'document-text-outline', onPress: () => setLegalModal('terms-and-conditions') },
    { label: 'User Guidelines', icon: 'shield-checkmark-outline', onPress: () => setLegalModal('user-guidelines') },
    { label: 'Privacy Policy', icon: 'lock-closed-outline', onPress: () => setLegalModal('privacy-policy') },
    { label: 'Contact Us', icon: 'call-outline', onPress: () => goToStack('ContactUs') },
    { label: 'FAQs', icon: 'help-circle-outline', onPress: () => goToStack('Faqs') },
    { label: 'Change Password', icon: 'key-outline', onPress: () => goToStack('ChangePassword') },
    { label: 'Notifications', icon: 'notifications-outline', onPress: () => goToStack('Notifications') },
    { label: 'Delete Account', icon: 'trash-outline', onPress: () => confirmDeleteAccount(logout) },
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

      {/* Terms, User Guidelines, Privacy Policy — from the admin panel */}
      <LegalPageModal slug={legalModal} onClose={() => setLegalModal(null)} accent={Colors.mentor} />
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

});
