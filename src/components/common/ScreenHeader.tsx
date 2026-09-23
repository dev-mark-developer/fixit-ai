import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../utils/colors';

interface Props {
  title: string;
  /** Defaults to popping the current screen. */
  onBack?: () => void;
}

/**
 * Back arrow + centred title, drawn by the screen itself. Used in place of the
 * native stack header, whose iOS back button is labelled with whatever route
 * sits beneath — often an untitled navigator such as "MentorMain". Handles the
 * top safe-area inset, so the screen's root can be a plain View.
 */
export default function ScreenHeader({ title, onBack }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const goBack = onBack ?? (() => { if (navigation.canGoBack()) navigation.goBack(); });

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={goBack} hitSlop={8}>
        <Icon name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {/* Balances the back arrow so the title stays centred */}
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: Colors.background,
  },
  title: {
    flex: 1,
    marginHorizontal: 12,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  spacer: { width: 24 },
});
