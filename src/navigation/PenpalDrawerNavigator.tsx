import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
  useDrawerStatus,
} from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import type { PenpalDrawerParamList } from '../types/navigation';
import { Colors } from '../utils/colors';
import RemoteImage from '../components/common/RemoteImage';
import { usersApi } from '../api/users';
import { useAuth } from '../store/AuthContext';
// import PenpalHomeScreen from '../screens/penpal/PenpalHomeScreen';
import PenpalConnectionsScreen from '../screens/penpal/PenpalConnectionsScreen';
import PenpalLettersScreen from '../screens/penpal/PenpalLettersScreen';

const Drawer = createDrawerNavigator<PenpalDrawerParamList>();

const LEGAL_TC = `Welcome to Fixit. By creating an account, you agree to these Terms & Conditions.\n\n1. Eligibility\nYou must be at least 18 years old to use Fixit.\n\n2. Acceptable Use\nYou agree not to use Fixit for any unlawful purpose or in any way that harms other users. Harassment, hate speech, or abusive behaviour will result in immediate account termination.\n\n3. User Content\nYou are responsible for all content you post. Fixit reserves the right to remove content that violates these terms.\n\n4. Privacy\nYour use of Fixit is also governed by our Privacy Policy.\n\n5. Subscriptions\nPaid subscriptions are billed monthly. You may cancel at any time through your device's app store.\n\n6. Account Termination\nFixit reserves the right to suspend or terminate your account for violations of these terms.\n\nFor questions, contact us at support@fixit.com`;

const LEGAL_PRIVACY = `Fixit is committed to protecting your privacy.\n\n1. Information We Collect\n- Account information (name, email, date of birth, gender, location)\n- Profile information (photos, bio, preferences)\n- Usage data (swipes, matches, messages)\n- Device information (device ID, platform, push token)\n\n2. How We Use Your Information\n- To provide and improve our services\n- To match you with other users\n- To send push notifications\n- To ensure safety and security\n\n3. Information Sharing\nWe do not sell your personal information.\n\n4. Your Rights\nYou may request access to, correction of, or deletion of your personal data by contacting support@fixit.com.\n\nContact: support@fixit.com`;

function PenpalDrawerContent({ navigation }: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [legalModal, setLegalModal] = useState<'tc' | 'privacy' | null>(null);

  // Profile image: fetched when the drawer opens, tap the avatar to upload
  const drawerStatus = useDrawerStatus();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (drawerStatus !== 'open') return;
    usersApi.getProfile()
      .then(res => setAvatarUrl(res.data?.data?.profileImageUrl ?? null))
      .catch(() => {});
  }, [drawerStatus]);

  const handleAvatarUpload = () => {
    launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      // Rendered as a small circle everywhere — no reason to ship the
      // camera's full-resolution original over the wire.
      maxWidth: 512,
      maxHeight: 512,
    }, async response => {
      const asset = response.assets?.[0];
      if (!asset?.uri) return;
      setUploadingAvatar(true);
      try {
        const res = await usersApi.uploadProfileImage(asset.uri, asset.type ?? 'image/jpeg');
        const returned = res.data?.data;
        const newUrl =
          typeof returned === 'string' ? returned : returned?.profileImageUrl;
        // Cache-bust in case the backend reuses the same file path
        setAvatarUrl(
          newUrl ? `${newUrl}${newUrl.includes('?') ? '&' : '?'}t=${Date.now()}` : asset.uri,
        );
      } catch {
        Alert.alert('Upload Failed', 'Could not upload the image. Please try again.');
      } finally {
        setUploadingAvatar(false);
      }
    });
  };

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : '–';

  // Two levels up: DrawerNav → PenpalNavigator → Root
  const rootNav = navigation.getParent()?.getParent();

  const goDrawer = (name: keyof PenpalDrawerParamList) => {
    navigation.navigate(name);
  };

  const goProfile = (screen: 'Faqs' | 'ContactUs' | 'ChangePassword') => {
    navigation.closeDrawer();
    (rootNav as any)?.navigate('Profile', { screen });
  };

  const goRoot = (screen: 'Dating' | 'Notifications' | 'Profile') => {
    navigation.closeDrawer();
    (rootNav as any)?.navigate(screen);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const items: { label: string; icon: any; onPress: () => void }[] = [
    // { label: 'Home', icon: require('../assets/home.png'), onPress: () => goDrawer('PenpalHome') },
    {
      label: 'Penpal Group',
      icon: require('../assets/letter.png'),
      onPress: () => goDrawer('PenpalConnections'),
    },
    {
      label: 'Terms & Conditions',
      icon: require('../assets/terms.png'),
      onPress: () => setLegalModal('tc'),
    },
    {
      label: 'Privacy Policy',
      icon: require('../assets/privacy.png'),
      onPress: () => setLegalModal('privacy'),
    },
    {
      label: 'Contact Us',
      icon: require('../assets/contactus.png'),
      onPress: () => goProfile('ContactUs'),
    },
    {
      label: 'FAQs',
      icon: require('../assets/faqs.png'),
      onPress: () => goProfile('Faqs'),
    },
    {
      label: 'Change Password',
      icon: require('../assets/changePassword.png'),
      onPress: () => goProfile('ChangePassword'),
    },
  ];

  const moreItems: { label: string; icon: any; onPress: () => void }[] = [
    { label: 'Explore Dating', icon: require('../assets/exploreDating.png'), onPress: () => goRoot('Dating') },
    // { label: 'Notifications', icon: '🔔', onPress: () => goRoot('Notifications') },
    // { label: 'Profile & Settings', icon: '👤', onPress: () => goRoot('Profile') },
  ];

  return (
    <View style={styles.drawerRoot}>
      <DrawerContentScrollView
        contentContainerStyle={[
          styles.drawerContent,
          { paddingTop: insets.top + 8 },
        ]}
      >
        {/* Close arrow */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.closeDrawer()}
          hitSlop={8}
        >
          <Text style={styles.closeArrow}>←</Text>
        </TouchableOpacity>

        {/* Profile header — tap the avatar to change the photo */}
        <View style={styles.profileRow}>
          <TouchableOpacity
            onPress={handleAvatarUpload}
            activeOpacity={0.8}
            disabled={uploadingAvatar}
          >
            {avatarUrl ? (
              <RemoteImage
                uri={avatarUrl}
                style={styles.avatarImg}
                indicatorColor={Colors.penpal}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            {uploadingAvatar && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={Colors.white} size="small" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Icon name="camera" size={11} color={Colors.white} />
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user ? `${user.firstName} ${user.lastName}` : '—'}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
          </View>
        </View>

        {/* Menu items */}
        <View style={styles.menu}>
          {items.map(item => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Image
                source={item.icon}
                style={styles.menuIconImg}
                resizeMode="contain"
              />
              <Text style={styles.menuItemLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Explore other modules / app areas */}
        <Text style={styles.sectionLabel}>More</Text>
        <View style={styles.menu}>
          {moreItems.map(item => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Image
                source={item.icon}
                style={styles.menuIconImg}
                resizeMode="contain"
              />
              <Text style={styles.menuItemLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </DrawerContentScrollView>

      {/* Logout */}
      <View style={styles.logoutWrap}>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Text style={styles.logoutIcon}>⏻</Text>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Legal modal */}
      <Modal
        visible={legalModal !== null}
        animationType="slide"
        onRequestClose={() => setLegalModal(null)}
      >
        <View style={styles.legalModal}>
          <View style={styles.legalHeader}>
            <Text style={styles.legalTitle}>
              {legalModal === 'tc' ? 'Terms & Conditions' : 'Privacy Policy'}
            </Text>
            <TouchableOpacity onPress={() => setLegalModal(null)} hitSlop={8}>
              <Text style={styles.legalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.legalScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.legalBody}>
              {legalModal === 'tc' ? LEGAL_TC : LEGAL_PRIVACY}
            </Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.legalDoneBtn}
            onPress={() => setLegalModal(null)}
          >
            <Text style={styles.legalDoneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const SHARED_HEADER = {
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.penpal,
  headerTitleStyle: { color: Colors.text, fontWeight: '700' as const },
  headerShadowVisible: false,
};

export default function PenpalDrawerNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="PenpalConnections"
      drawerContent={props => <PenpalDrawerContent {...props} />}
      screenOptions={{
        drawerType: 'front',
        drawerStyle: { width: 300, backgroundColor: Colors.background },
        overlayColor: 'rgba(0,0,0,0.4)',
        swipeEdgeWidth: 50,
        ...SHARED_HEADER,
      }}
    >
      {/* Home screen disabled — Penpal Group (Connections) is the landing screen.
      <Drawer.Screen
        name="PenpalHome"
        component={PenpalHomeScreen}
        options={{ title: 'Penpal' }}
      />
      */}
      <Drawer.Screen
        name="PenpalConnections"
        component={PenpalConnectionsScreen}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="PenpalLetters"
        component={PenpalLettersScreen}
        options={{ title: 'Letters' }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerRoot: { flex: 1, backgroundColor: Colors.background },
  drawerContent: { paddingTop: 8 },

  closeBtn: { paddingHorizontal: 20, paddingVertical: 8 },
  closeArrow: { fontSize: 24, color: Colors.text, fontWeight: '600' },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.penpal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surface },
  avatarOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.penpal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  avatarText: { fontSize: 19, fontWeight: '700', color: Colors.white },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 17, fontWeight: '800', color: Colors.text },
  profileEmail: { fontSize: 13, color: Colors.penpal, marginTop: 2 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 4,
  },
  menu: { paddingHorizontal: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemIcon: {
    fontSize: 19,
    marginRight: 16,
    width: 24,
    textAlign: 'center',
  },
  menuIconImg: { width: 24, height: 24, marginRight: 16 },
  menuItemLabel: { fontSize: 15, fontWeight: '500', color: Colors.text },

  logoutWrap: { padding: 20 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.penpal,
    borderRadius: 14,
    paddingVertical: 16,
  },
  logoutIcon: { fontSize: 16, color: Colors.white },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  // Legal modal
  legalModal: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  legalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  legalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  legalCloseText: { fontSize: 18, color: Colors.text },
  legalScroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  legalBody: { fontSize: 14, color: Colors.text, lineHeight: 22 },
  legalDoneBtn: {
    margin: 20,
    backgroundColor: Colors.penpal,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  legalDoneBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
