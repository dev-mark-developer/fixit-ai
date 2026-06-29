import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  routeName: string;
}

export default function ScreenDebugBadge({ routeName }: Props) {
  if (!__DEV__ || !routeName) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.pill}>
        <Text style={styles.label}>screen </Text>
        <Text style={styles.name}>{routeName}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 2,
  },
  label: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'monospace',
  },
  name: {
    fontSize: 11,
    color: '#7DF9AA',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});
