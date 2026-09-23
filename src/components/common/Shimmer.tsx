import React, { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../utils/colors';

/**
 * The band's softness: one view per stop, opacity ramping up to the middle and
 * back down. The app has no gradient library, and a handful of translucent
 * slices reads as one soft sweep at this size — cheaper than pulling in a
 * native module for a placeholder.
 */
const SWEEP_STOPS = [0.05, 0.14, 0.3, 0.55, 0.3, 0.14, 0.05];

/** How much of the block the band covers at any moment. */
const BAND_RATIO = 0.7;

interface Props {
  /** The block's shape — size, radius, margins. Its background is `color`. */
  style?: StyleProp<ViewStyle>;
  /** The resting colour the highlight sweeps over. */
  color?: string;
  /** Milliseconds for one pass. */
  duration?: number;
  /** Drawn inside the block, under the sweep — bars standing in for text, say. */
  children?: React.ReactNode;
}

/**
 * A placeholder block with a highlight sweeping across it, for content that
 * hasn't arrived yet. Give it the size and shape of the real thing, so nothing
 * on screen moves when the content lands.
 *
 * The sweep stops for anyone who has asked the system to reduce motion; the
 * block still holds its place, it just sits still.
 */
export default function Shimmer({
  style,
  color = Colors.border,
  duration = 1150,
  children,
}: Props) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const band = width * BAND_RATIO;
  const animate = width > 0 && !reduceMotion;

  useEffect(() => {
    if (!animate) return;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    // Without this the loop keeps running on the UI thread after the real
    // content has replaced the placeholder.
    return () => cancelAnimation(progress);
  }, [animate, duration, progress]);

  // Starts off the left edge and finishes off the right one, so the block is
  // clean at both ends of a pass rather than the band parking on it.
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: -band + progress.value * (width + band) }],
  }));

  return (
    <View
      style={[styles.block, style, { backgroundColor: color }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        setWidth((prev) => (Math.abs(prev - w) < 1 ? prev : w));
      }}
    >
      {children}
      {animate && (
        <Animated.View style={[styles.band, { width: band }, sweep]} pointerEvents="none">
          {SWEEP_STOPS.map((opacity, i) => (
            <View key={i} style={[styles.stop, { opacity }]} />
          ))}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row' },
  stop: { flex: 1, backgroundColor: Colors.white },
});
