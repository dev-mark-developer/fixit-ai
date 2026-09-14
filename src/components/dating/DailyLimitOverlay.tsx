import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../utils/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 32;

interface Props {
  accent: string;
  /** The card's height — the deck sizes cards to fit, so a fixed one overhangs on short screens. */
  height: number;
  /**
   * Premium accounts have their own daily allowance. Offering them the upgrade
   * they already have would be wrong, so they get a way back to the deck.
   */
  isPremium: boolean;
  onSubscribe: () => void;
  onDismiss: () => void;
}

/**
 * Covers the swipe card once the day's likes are used up. The card stays
 * underneath, dimmed rather than blurred — a real blur would mean pulling in a
 * native blur module for one screen. Pass and super like stay usable from the
 * action pill, which sits above this.
 */
export default function DailyLimitOverlay({
  accent, height, isPremium, onSubscribe, onDismiss,
}: Props) {
  return (
    <View style={[styles.card, { height }]} pointerEvents="box-none">
      <View style={styles.scrim} />
      <View style={styles.content}>
        <Text style={styles.title}>You Have Reached{'\n'}Your Daily Limit!</Text>
        <Text style={styles.subtitle}>
          {isPremium
            ? "You've used all of today's likes.\nCome back tomorrow for more."
            : 'Try Premium subscription for\nunlimited swaps and filters'}
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: accent }]}
          onPress={isPremium ? onDismiss : onSubscribe}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>
            {isPremium ? 'Keep Browsing' : 'Subscribe To Premium'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_W,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
    // Above the cards (zIndex up to 10, elevation 8) and below the action pill
    // (20 / 9). Without it the overlay drew underneath the top card.
    zIndex: 15,
    elevation: 8.5,
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
