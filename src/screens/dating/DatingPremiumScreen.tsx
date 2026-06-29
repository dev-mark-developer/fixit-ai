import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../utils/colors';

export default function DatingPremiumScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.icon}>⭐</Text>
      <Text style={styles.title}>Go Premium</Text>
      <Text style={styles.sub}>IAP subscription — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  sub: { fontSize: 14, color: Colors.textSecondary },
});
