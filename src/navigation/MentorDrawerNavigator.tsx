import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import type { MentorDrawerParamList, MentorStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../utils/colors';
import { useAuth } from '../store/AuthContext';
import MentorDashboardScreen from '../screens/mentor/MentorDashboardScreen';

const Drawer = createDrawerNavigator<MentorDrawerParamList>();

// Items that navigate within the drawer
const DRAWER_SCREENS: { name: keyof MentorDrawerParamList; label: string; icon: string }[] = [
  { name: 'MentorDashboard', label: 'My Seekers', icon: '👥' },
];

// Items that push screens onto the parent MentorNavigator stack
type StackItem = { label: string; icon: string; screen: keyof MentorStackParamList };
const ACCOUNT_ITEMS: StackItem[] = [
  { label: 'Edit Profile', icon: '✏️', screen: 'MentorEditProfile' },
  { label: 'Subscription', icon: '👑', screen: 'MentorSubscription' },
  { label: 'Change Password', icon: '🔒', screen: 'ChangePassword' },
  { label: 'Notifications', icon: '🔔', screen: 'Notifications' },
];
const APP_ITEMS: StackItem[] = [
  { label: 'FAQs', icon: '❓', screen: 'Faqs' },
  { label: 'Contact Us', icon: '💬', screen: 'ContactUs' },
];

function MentorDrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const { logout } = useAuth();
  const activeRoute = state.routeNames[state.index];

  // Navigate to a screen in the parent MentorNavigator stack
  const parentNav = navigation.getParent<NativeStackNavigationProp<MentorStackParamList>>();
  const goToStack = (screen: keyof MentorStackParamList) => {
    navigation.closeDrawer();
    parentNav?.navigate(screen as any);
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logout },
      ],
    );
  };

  return (
    <DrawerContentScrollView style={styles.drawerRoot} contentContainerStyle={styles.drawerContent}>
      {/* Header */}
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerHeaderIcon}>🎓</Text>
        <Text style={styles.drawerHeaderTitle}>Spiritual Guru</Text>
      </View>

      {/* Main drawer screen items */}
      {DRAWER_SCREENS.map((item) => {
        const active = activeRoute === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            style={[styles.menuItem, active && styles.menuItemActive]}
            onPress={() => navigation.navigate(item.name)}
            activeOpacity={0.7}
          >
            <Text style={styles.menuItemIcon}>{item.icon}</Text>
            <Text style={[styles.menuItemLabel, active && styles.menuItemLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Account section */}
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionLabel}>Account</Text>
      {ACCOUNT_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.label}
          style={styles.menuItem}
          onPress={() => goToStack(item.screen)}
          activeOpacity={0.7}
        >
          <Text style={styles.menuItemIcon}>{item.icon}</Text>
          <Text style={styles.menuItemLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}

      {/* App section */}
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionLabel}>App</Text>
      {APP_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.label}
          style={styles.menuItem}
          onPress={() => goToStack(item.screen)}
          activeOpacity={0.7}
        >
          <Text style={styles.menuItemIcon}>{item.icon}</Text>
          <Text style={styles.menuItemLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}

      {/* Logout */}
      <View style={styles.sectionDivider} />
      <TouchableOpacity
        style={[styles.menuItem, styles.logoutItem]}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Text style={styles.menuItemIcon}>🚪</Text>
        <Text style={[styles.menuItemLabel, styles.logoutLabel]}>Log Out</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
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
        drawerStyle: { width: 270, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.border },
        overlayColor: 'rgba(0,0,0,0.4)',
        swipeEdgeWidth: 50,
        ...SHARED_HEADER,
      }}
    >
      <Drawer.Screen
        name="MentorDashboard"
        component={MentorDashboardScreen}
        options={{ title: 'My Seekers' }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerRoot: { flex: 1, backgroundColor: Colors.surface },
  drawerContent: { paddingTop: 20, paddingBottom: 32 },

  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  drawerHeaderIcon: { fontSize: 26, marginRight: 10 },
  drawerHeaderTitle: { fontSize: 20, fontWeight: '800', color: Colors.mentor },

  sectionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 28,
    paddingBottom: 4,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  menuItemActive: { backgroundColor: Colors.mentorLight },
  menuItemIcon: { fontSize: 20, marginRight: 14 },
  menuItemLabel: { fontSize: 15, fontWeight: '500', color: Colors.textSecondary },
  menuItemLabelActive: { color: Colors.mentor, fontWeight: '700' },

  logoutItem: { marginTop: 4 },
  logoutLabel: { color: Colors.error },
});
