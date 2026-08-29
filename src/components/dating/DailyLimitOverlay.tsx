import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../utils/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W - 32;
const CARD_H = SCREEN_H * 0.56;

interface Props {
  accent: string;
  onSubscribe: () => void;
}

/**
 * Covers the swipe card once the free daily swipes are used up. The card stays
 * underneath, dimmed rather than blurred — a real blur would mean pulling in a
 * native blur module for one screen.
 */
export default function DailyLimitOverlay({ accent, onSubscribe }: Props) {
  return (
    <View style={styles.card} pointerEvents="box-none">
      <View style={styles.scrim} />
      <View style={styles.content}>
        <Text style={styles.title}>You Have Reached{'\n'}Your Daily Limit!</Text>
        <Text style={styles.subtitle}>
          Try Premium subscription for{'\n'}unlimited swaps and filters
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: accent }]}
          onPress={onSubscribe}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Subscribe To Premium</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  scrim: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  content: { paddingHorizontal: 28, alignItems: 'center' },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  btn: {
    alignSelf: 'stretch',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
