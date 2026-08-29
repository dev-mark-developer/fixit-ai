import React from 'react';
import { Image, StyleSheet, StyleProp, ImageStyle } from 'react-native';

/**
 * Wheelchair badge pinned to the top-left of an avatar.
 *
 * Driven by `identityVisibility` on the penpal profile — the answer to "Do you
 * identify as a person with a disability?". Only `'Yes'` discloses: `'No'` and
 * `'PreferNotToSay'` render nothing, which is the whole point of the third
 * option (see IDENTITY_OPTIONS in PenpalSetupScreen).
 */
interface Props {
  identityVisibility?: string | null;
  /** Badge diameter. Defaults to 22, sized for the 44pt list avatars. */
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function identifiesAsDisabled(identityVisibility?: string | null): boolean {
  return identityVisibility?.trim().toLowerCase() === 'yes';
}

export default function DisabilityBadge({ identityVisibility, size = 22, style }: Props) {
  if (!identifiesAsDisabled(identityVisibility)) return null;

  return (
    <Image
      source={require('../../assets/disability.png')}
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Identifies as a person with a disability"
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2,
    left: -2,
  },
});
