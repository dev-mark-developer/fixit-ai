import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDuration } from '../../utils/chatMedia';
import { MAX_VOICE_NOTE_MS } from '../../services/voiceNote';
import { Colors } from '../../utils/colors';

const METER_BARS = 22;

interface Props {
  positionMs: number;
  /** Raw dB from the recorder — roughly -60 (silence) to 0 (loud). */
  metering?: number;
  accent: string;
  onCancel: () => void;
  onStop: () => void;
}

/**
 * Replaces the composer while a voice note is being captured: elapsed time,
 * a live level meter, and the two ways out — discard or keep.
 */
export default function RecordingBar({ positionMs, metering, accent, onCancel, onStop }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // -60dB..0dB → 0..1. The meter is decorative, so clamping is enough.
  const level = metering === undefined ? 0.35 : Math.max(0, Math.min(1, (metering + 60) / 60));
  const remaining = MAX_VOICE_NOTE_MS - positionMs;
  const nearLimit = remaining <= 30000;

  return (
    <View style={styles.root}>
      <TouchableOpacity
        onPress={onCancel}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Discard recording"
        style={styles.iconBtn}
      >
        <Icon name="trash-outline" size={22} color={Colors.error} />
      </TouchableOpacity>

      <View style={styles.body}>
        <Animated.View style={[styles.dot, { opacity: pulse }]} />
        <Text style={styles.timer}>{formatDuration(positionMs)}</Text>

        <View style={styles.meter}>
          {Array.from({ length: METER_BARS }).map((_, i) => {
            // Bars nearer the middle react more, so the meter reads as a voice.
            const weight = 1 - Math.abs(i - METER_BARS / 2) / (METER_BARS / 2);
            const height = 4 + level * weight * 20;
            return <View key={i} style={[styles.bar, { height, backgroundColor: accent }]} />;
          })}
        </View>

        {nearLimit && (
          <Text style={styles.remaining}>{formatDuration(Math.max(0, remaining))} left</Text>
        )}
      </View>

      <TouchableOpacity
        onPress={onStop}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Stop recording"
        style={[styles.stopBtn, { backgroundColor: accent }]}
      >
        <Icon name="checkmark" size={20} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: Colors.background,
  },
  iconBtn: { padding: 4 },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.error },
  timer: { fontSize: 13, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'], minWidth: 38 },
  meter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  bar: { width: 2.5, borderRadius: 1.5 },
  remaining: { fontSize: 11, color: Colors.error, fontWeight: '600' },
  stopBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
