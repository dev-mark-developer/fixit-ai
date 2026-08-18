import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import type { DatingDrawerParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { useModuleStatus } from '../../store/ModuleStatusContext';

type TabRoute = keyof Pick<
  DatingDrawerParamList,
  'DatingDiscover' | 'DatingMatches' | 'DatingChats' | 'DatingMyProfile'
>;

const TABS: { route: TabRoute; icon: string; iconActive: string }[] = [
  { route: 'DatingDiscover', icon: 'home-outline', iconActive: 'home' },
  { route: 'DatingMatches', icon: 'heart-outline', iconActive: 'heart' },
  { route: 'DatingChats', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
  { route: 'DatingMyProfile', icon: 'person-outline', iconActive: 'person' },
];

/**
 * Floating bottom tab bar (Figma): white pill with Home / Likes / Chats /
 * Profile. The active tab sits in a filled accent circle. Rendered inside
 * each main dating screen; navigates between the existing drawer routes.
 */
export default function DatingBottomBar({ active }: { active: TabRoute }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { datingType } = useModuleStatus();
  const accent = datingType === 'Spiritual' ? Colors.spiritual : Colors.dating;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive = tab.route === active;
          return (
            <TouchableOpacity
              key={tab.route}
              style={[styles.tab, isActive && { backgroundColor: accent }]}
              onPress={() => !isActive && navigation.navigate(tab.route)}
              activeOpacity={0.8}
            >
              <Icon
                name={isActive ? tab.iconActive : tab.icon}
                size={24}
                color={isActive ? Colors.white : `${accent}99`}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 36,
    paddingHorizontal: 22,
    paddingVertical: 10,
    width: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  tab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
