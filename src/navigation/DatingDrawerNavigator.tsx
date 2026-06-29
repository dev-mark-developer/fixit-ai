import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import type { DatingDrawerParamList, DatingStackParamList, RootStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../utils/colors';
import { useAuth } from '../store/AuthContext';
import { useModuleStatus } from '../store/ModuleStatusContext';
import DatingDiscoverScreen from '../screens/dating/DatingDiscoverScreen';
import DatingMatchesScreen from '../screens/dating/DatingMatchesScreen';
import DatingChatsScreen from '../screens/dating/DatingChatsScreen';
import DatingBlockListScreen from '../screens/dating/DatingBlockListScreen';

const Drawer = createDrawerNavigator<DatingDrawerParamList>();

const MENU_ITEMS: { name: keyof DatingDrawerParamList; label: string; icon: string }[] = [
  { name: 'DatingDiscover', label: 'Discover', icon: '💫' },
  { name: 'DatingMatches', label: 'My Matches', icon: '💞' },
  { name: 'DatingChats', label: 'Chats', icon: '💬' },
  { name: 'DatingBlockList', label: 'Block List', icon: '🚫' },
];

function DatingDrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const { logout } = useAuth();
  const { datingType } = useModuleStatus();
  const activeRoute = state.routeNames[state.index];

  // One level up → DatingNavigator stack; two levels up → Root stack
  const parentNav = navigation.getParent<NativeStackNavigationProp<DatingStackParamList>>();
  const rootNav = navigation.getParent()?.getParent<NativeStackNavigationProp<RootStackParamList>>();

  const goToPremium = () => {
    navigation.closeDrawer();
    parentNav?.navigate('DatingPremium', { datingType: datingType ?? 'NonSpiritual' });
  };

  const goToIceBreakers = () => {
    navigation.closeDrawer();
    parentNav?.navigate('DatingIceBreakerSelection', { datingType: datingType ?? 'NonSpiritual', editMode: true });
  };

  const goToRoot = (screen: keyof RootStackParamList) => {
    navigation.closeDrawer();
    rootNav?.navigate(screen as any);
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
        <Text style={styles.drawerHeaderIcon}>❤️</Text>
        <Text style={styles.drawerHeaderTitle}>Dating</Text>
      </View>

      {/* Main drawer screens */}
      {MENU_ITEMS.map((item) => {
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

      <TouchableOpacity style={styles.menuItem} onPress={goToIceBreakers} activeOpacity={0.7}>
        <Text style={styles.menuItemIcon}>❄️</Text>
        <Text style={styles.menuItemLabel}>Ice Breakers</Text>
      </TouchableOpacity>

      {/* Premium */}
      <View style={styles.divider} />
      <TouchableOpacity
        style={styles.premiumBtn}
        onPress={goToPremium}
        activeOpacity={0.8}
      >
        <Text style={styles.premiumBtnText}>👑 Go Premium</Text>
      </TouchableOpacity>

      {/* Account section */}
      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>Account</Text>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => goToRoot('Notifications')}
        activeOpacity={0.7}
      >
        <Text style={styles.menuItemIcon}>🔔</Text>
        <Text style={styles.menuItemLabel}>Notifications</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => goToRoot('Profile')}
        activeOpacity={0.7}
      >
        <Text style={styles.menuItemIcon}>👤</Text>
        <Text style={styles.menuItemLabel}>Profile & Settings</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

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

const SHARED_SCREEN_HEADER = {
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.dating,
  headerTitleStyle: { color: Colors.text, fontWeight: '700' as const },
  headerShadowVisible: false,
};

export default function DatingDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DatingDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: { width: 260, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.border },
        overlayColor: 'rgba(0,0,0,0.4)',
        swipeEdgeWidth: 50,
      }}
    >
      <Drawer.Screen name="DatingDiscover" component={DatingDiscoverScreen} />
      <Drawer.Screen
        name="DatingMatches"
        component={DatingMatchesScreen}
        options={{ headerShown: true, title: 'My Matches', ...SHARED_SCREEN_HEADER }}
      />
      <Drawer.Screen
        name="DatingChats"
        component={DatingChatsScreen}
        options={{ headerShown: true, title: 'Chats', ...SHARED_SCREEN_HEADER }}
      />
      <Drawer.Screen
        name="DatingBlockList"
        component={DatingBlockListScreen}
        options={{ headerShown: true, title: 'Block List', ...SHARED_SCREEN_HEADER }}
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
  drawerHeaderTitle: { fontSize: 20, fontWeight: '800', color: Colors.dating },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 20, marginVertical: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 28,
    paddingBottom: 4,
    paddingTop: 2,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  menuItemActive: { backgroundColor: Colors.datingLight },
  menuItemIcon: { fontSize: 20, marginRight: 14 },
  menuItemLabel: { fontSize: 15, fontWeight: '500', color: Colors.textSecondary },
  menuItemLabelActive: { color: Colors.dating, fontWeight: '700' },

  premiumBtn: {
    marginHorizontal: 16,
    backgroundColor: Colors.dating,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  premiumBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  logoutItem: { marginTop: 2 },
  logoutLabel: { color: Colors.error },
});
