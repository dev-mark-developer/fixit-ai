import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView, Image,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import type { DatingDrawerParamList, DatingStackParamList, RootStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../utils/colors';
import { useAuth } from '../store/AuthContext';
import { useModuleStatus } from '../store/ModuleStatusContext';
import DatingDiscoverScreen from '../screens/dating/DatingDiscoverScreen';
import DatingMatchesScreen from '../screens/dating/DatingMatchesScreen';
import DatingChatsScreen from '../screens/dating/DatingChatsScreen';
import DatingBlockListScreen from '../screens/dating/DatingBlockListScreen';
import DatingMyProfileScreen from '../screens/dating/DatingMyProfileScreen';

const Drawer = createDrawerNavigator<DatingDrawerParamList>();

const LEGAL_TC = `Welcome to Fixit. By creating an account, you agree to these Terms & Conditions.\n\n1. Eligibility\nYou must be at least 18 years old to use Fixit.\n\n2. Acceptable Use\nYou agree not to use Fixit for any unlawful purpose or in any way that harms other users. Harassment, hate speech, or abusive behaviour will result in immediate account termination.\n\n3. User Content\nYou are responsible for all content you post. Fixit reserves the right to remove content that violates these terms.\n\n4. Privacy\nYour use of Fixit is also governed by our Privacy Policy.\n\n5. Subscriptions\nPaid subscriptions are billed monthly. You may cancel at any time through your device's app store.\n\n6. Account Termination\nFixit reserves the right to suspend or terminate your account for violations of these terms.\n\nFor questions, contact us at support@fixit.com`;

const LEGAL_PRIVACY = `Fixit is committed to protecting your privacy.\n\n1. Information We Collect\n- Account information (name, email, date of birth, gender, location)\n- Profile information (photos, bio, preferences)\n- Usage data (swipes, matches, messages)\n- Device information (device ID, platform, push token)\n\n2. How We Use Your Information\n- To provide and improve our services\n- To match you with other users\n- To send push notifications\n- To ensure safety and security\n\n3. Information Sharing\nWe do not sell your personal information.\n\n4. Your Rights\nYou may request access to, correction of, or deletion of your personal data by contacting support@fixit.com.\n\nContact: support@fixit.com`;

const DATING_TIPS = `Stay Safe While Dating

1. Keep conversations in the app
Get to know the other person inside the app before sharing other contact details.

2. Protect your personal information
Never share financial information, your home address, or other sensitive details with someone you just met.

3. Take your time
There is no rush. Meaningful connections grow at their own pace.

4. Meet in public places
When you decide to meet in person, choose a busy public place and tell a friend where you are going.

5. Report and block
If someone makes you uncomfortable, use the report and block features — our team reviews every report.

6. Be yourself
Authentic profiles make authentic connections. Use recent photos and honest information.

7. Respect others
Treat every member with kindness and respect. Harassment or abusive behaviour leads to account removal.`;

type LegalKey = 'tc' | 'privacy' | 'tips' | null;

function DatingDrawerContent({ navigation }: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const { datingType } = useModuleStatus();
  const insets = useSafeAreaInsets();
  const [legalModal, setLegalModal] = useState<LegalKey>(null);

  const isSpiritual = datingType === 'Spiritual';
  const accent = isSpiritual ? Colors.spiritual : Colors.dating;
  const iconTint = isSpiritual ? Colors.spiritualLime : Colors.datingSecondary;

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : '–';

  // One level up → DatingNavigator stack; two levels up → Root stack
  const parentNav = navigation.getParent<NativeStackNavigationProp<DatingStackParamList>>();
  const rootNav = navigation.getParent()?.getParent<NativeStackNavigationProp<RootStackParamList>>();

  const goDrawer = (name: keyof DatingDrawerParamList) => navigation.navigate(name);
  const goToPremium = () => {
    navigation.closeDrawer();
    parentNav?.navigate('DatingPremium', { datingType: datingType ?? 'NonSpiritual' });
  };
  const goToIceBreakers = () => {
    navigation.closeDrawer();
    parentNav?.navigate('DatingIceBreakerSelection', { datingType: datingType ?? 'NonSpiritual', editMode: true });
  };
  const goToRoot = (screen: keyof RootStackParamList, params?: any) => {
    navigation.closeDrawer();
    rootNav?.navigate(screen as any, params);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const items: { label: string; icon: string; onPress: () => void }[] = [
    { label: 'Home', icon: 'home', onPress: () => goToRoot('Home') },
    { label: 'Penpal', icon: 'create', onPress: () => goToRoot('Penpal') },
    { label: 'My Subscription', icon: 'cash', onPress: goToPremium },
    { label: 'Configure Ice Breaker', icon: 'chatbox-ellipses', onPress: goToIceBreakers },
    { label: 'Block List', icon: 'remove-circle', onPress: () => goDrawer('DatingBlockList') },
    { label: 'Dating Tips and Guidelines', icon: 'alert-circle', onPress: () => setLegalModal('tips') },
    { label: 'Terms & Conditions', icon: 'calendar', onPress: () => setLegalModal('tc') },
    { label: 'Privacy Policy', icon: 'document-text', onPress: () => setLegalModal('privacy') },
    { label: 'Contact Us', icon: 'call', onPress: () => goToRoot('Profile', { screen: 'ContactUs' }) },
    { label: 'FAQs', icon: 'help-circle', onPress: () => goToRoot('Profile', { screen: 'Faqs' }) },
    { label: 'Change Password', icon: 'lock-closed', onPress: () => goToRoot('Profile', { screen: 'ChangePassword' }) },
    { label: 'Notifications', icon: 'notifications', onPress: () => goToRoot('Notifications') },
  ];

  const legalTitle =
    legalModal === 'tc' ? 'Terms & Conditions'
      : legalModal === 'privacy' ? 'Privacy Policy'
        : 'Dating Tips and Guidelines';
  const legalBody =
    legalModal === 'tc' ? LEGAL_TC
      : legalModal === 'privacy' ? LEGAL_PRIVACY
        : DATING_TIPS;

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
          <View style={[styles.avatar, { backgroundColor: accent }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user ? `${user.firstName} ${user.lastName}` : '—'}
            </Text>
            <Text style={[styles.profileEmail, { color: accent }]} numberOfLines={1}>
              {user?.email ?? '—'}
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
              <Icon name={item.icon} size={20} color={iconTint} style={styles.menuIcon} />
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </DrawerContentScrollView>

      {/* Logout */}
      <View style={styles.logoutWrap}>
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: accent }]}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Icon name="log-out-outline" size={18} color={Colors.white} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Legal / tips modal */}
      <Modal visible={legalModal !== null} animationType="slide" onRequestClose={() => setLegalModal(null)}>
        <View style={styles.legalModal}>
          <View style={styles.legalHeader}>
            <Text style={styles.legalTitle}>{legalTitle}</Text>
            <TouchableOpacity onPress={() => setLegalModal(null)} hitSlop={8}>
              <Text style={styles.legalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.legalScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.legalBody}>{legalBody}</Text>
          </ScrollView>
          <TouchableOpacity
            style={[styles.legalDoneBtn, { backgroundColor: accent }]}
            onPress={() => setLegalModal(null)}
          >
            <Text style={styles.legalDoneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

export default function DatingDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DatingDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: { width: 300, backgroundColor: Colors.background },
        overlayColor: 'rgba(0,0,0,0.4)',
        swipeEdgeWidth: 50,
      }}
    >
      <Drawer.Screen name="DatingDiscover" component={DatingDiscoverScreen} />
      <Drawer.Screen name="DatingMatches" component={DatingMatchesScreen} />
      <Drawer.Screen name="DatingChats" component={DatingChatsScreen} />
      <Drawer.Screen name="DatingMyProfile" component={DatingMyProfileScreen} />
      <Drawer.Screen
        name="DatingBlockList"
        component={DatingBlockListScreen}
        options={{
          headerShown: true,
          title: 'Block List',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.dating,
          headerTitleStyle: { color: Colors.text, fontWeight: '700' as const },
          headerShadowVisible: false,
        }}
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
    paddingBottom: 20,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
  avatarText: { fontSize: 19, fontWeight: '700', color: Colors.white },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 17, fontWeight: '800', color: Colors.text },
  profileEmail: { fontSize: 13, marginTop: 2 },

  menu: { paddingHorizontal: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
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
  legalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, flex: 1, marginRight: 12 },
  legalCloseText: { fontSize: 18, color: Colors.text },
  legalScroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  legalBody: { fontSize: 14, color: Colors.text, lineHeight: 22, paddingBottom: 24 },
  legalDoneBtn: {
    margin: 20, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  legalDoneBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
