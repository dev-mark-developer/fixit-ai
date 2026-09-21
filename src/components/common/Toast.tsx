import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../utils/colors';

export interface ToastMessage {
  /** New on every show, so the same text twice still restarts the timer. */
  id: number;
  text: string;
  /** Ionicons name shown before the text. */
  icon?: string;
  tone?: 'default' | 'error';
}

interface Props {
  toast: ToastMessage | null;
  /** Called once it has faded out — clear the message here. */
  onHide: () => void;
  /** Where it sits; the parent positions it. */
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

/**
 * A short, non-blocking message that fades in, stays for a moment and fades
 * out. It never takes touches, so the screen underneath stays usable. Navy,
 * like the toast on the penpal public profile.
 */
export default function Toast({ toast, onHide, style, duration = 2200 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const onHideRef = useRef(onHide);
  useEffect(() => { onHideRef.current = onHide; }, [onHide]);

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true })
        // A newer toast interrupts this fade, and must not be cleared by it.
        .start(({ finished }) => { if (finished) onHideRef.current(); });
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, duration, opacity]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, toast.tone === 'error' && styles.error, style, { opacity }]}
    >
      {!!toast.icon && <Icon name={toast.icon} size={16} color={Colors.white} />}
      <Text style={styles.text} numberOfLines={2}>{toast.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '90%',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.navy,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  error: { backgroundColor: Colors.error },
  text: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: Colors.white },
});
