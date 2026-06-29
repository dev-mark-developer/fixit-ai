import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import type { PenpalDrawerParamList, RootStackParamList } from '../types/navigation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../utils/colors';
import { useAuth } from '../store/AuthContext';
import { penpalApi } from '../api/penpal';
import PenpalHomeScreen from '../screens/penpal/PenpalHomeScreen';
import PenpalDiscoverScreen from '../screens/penpal/PenpalDiscoverScreen';
import PenpalConnectionsScreen from '../screens/penpal/PenpalConnectionsScreen';
import PenpalLettersScreen from '../screens/penpal/PenpalLettersScreen';

const Drawer = createDrawerNavigator<PenpalDrawerParamList>();

const MENU_ITEMS: { name: keyof PenpalDrawerParamList; label: string; icon: string }[] = [
  { name: 'PenpalHome', label: 'Home', icon: '🏠' },
  { name: 'PenpalDiscover', label: 'Discover', icon: '🔍' },
  { name: 'PenpalConnections', label: 'Connections', icon: '🤝' },
  { name: 'PenpalLetters', label: 'Letters', icon: '📬' },
];

function PenpalDrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const { logout } = useAuth();
  const activeRoute = state.routeNames[state.index];
  const [isPhysical, setIsPhysical] = useState(false);

  useEffect(() => {
    penpalApi.getProfile()
      .then((res) => {
        const letterType = res.data?.data?.letterType;
        setIsPhysical(letterType === 'Physical');
      })
      .catch(() => {});
  }, []);

  // Two levels up: DrawerNav → PenpalNavigator → Root
  const rootNav = navigation.getParent()?.getParent<NativeStackNavigationProp<RootStackParamList>>();

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
        <Text style={styles.drawerHeaderIcon}>✉️</Text>
        <Text style={styles.drawerHeaderTitle}>Penpal</Text>
      </View>

      {/* Main drawer screens */}
      {MENU_ITEMS.filter((item) => !(isPhysical && item.name === 'PenpalLetters')).map((item) => {
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

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => goToRoot('Dating')}
        activeOpacity={0.7}
      >
        <Text style={styles.menuItemIcon}>💕</Text>
        <Text style={styles.menuItemLabel}>Explore Dating</Text>
      </TouchableOpacity>

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
  headerTintColor: Colors.penpal,
  headerTitleStyle: { color: Colors.text, fontWeight: '700' as const },
  headerShadowVisible: false,
};

export default function PenpalDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <PenpalDrawerContent {...props} />}
      screenOptions={{
        drawerType: 'front',
        drawerStyle: { width: 260, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.border },
        overlayColor: 'rgba(0,0,0,0.4)',
        swipeEdgeWidth: 50,
        ...SHARED_HEADER,
      }}
    >
      <Drawer.Screen name="PenpalHome" component={PenpalHomeScreen} options={{ title: 'Penpal' }} />
      <Drawer.Screen name="PenpalDiscover" component={PenpalDiscoverScreen} options={{ title: 'Discover Penpals' }} />
      <Drawer.Screen name="PenpalConnections" component={PenpalConnectionsScreen} options={{ title: 'Connections' }} />
      <Drawer.Screen name="PenpalLetters" component={PenpalLettersScreen} options={{ title: 'Letters' }} />
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
  drawerHeaderTitle: { fontSize: 20, fontWeight: '800', color: Colors.penpal },

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
    paddingVertical: 14,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  menuItemActive: { backgroundColor: Colors.penpalLight },
  menuItemIcon: { fontSize: 20, marginRight: 14 },
  menuItemLabel: { fontSize: 15, fontWeight: '500', color: Colors.textSecondary },
  menuItemLabelActive: { color: Colors.penpal, fontWeight: '700' },

  logoutItem: { marginTop: 4 },
  logoutLabel: { color: Colors.error },
});
