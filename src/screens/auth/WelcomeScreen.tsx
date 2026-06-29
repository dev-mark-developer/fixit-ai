import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
} from 'react-native';

const LOGO = require('../../assets/fixit-app-logo.png');
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const { width } = Dimensions.get('window');
const ORBIT = Math.min(width * 0.78, 300);
const C = ORBIT / 2;
const OUTER_R = ORBIT * 0.41;
const AVATAR_SIZE = 46;
const CENTER_SIZE = 78;

type AvatarDef = {
  angle: number;
  bg: string;
  pin?: boolean;
  chat?: boolean;
};

const AVATARS: AvatarDef[] = [
  { angle: 90,  bg: '#F4C3A0' },
  { angle: 38,  bg: '#6B4226', pin: true },
  { angle: 340, bg: '#D9937A' },
  { angle: 290, bg: '#F6D9A2' },
  { angle: 245, bg: '#C17F59' },
  { angle: 195, bg: '#A0532B', chat: true },
  { angle: 148, bg: '#E8B08A' },
];

function avatarPos(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    left: C + OUTER_R * Math.cos(rad) - AVATAR_SIZE / 2,
    top: C - OUTER_R * Math.sin(rad) - AVATAR_SIZE / 2,
  };
}

export default function WelcomeScreen({ navigation }: Props) {
  const floatY = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -9, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: fadeIn }]}>
      {/* Logo */}
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />

      {/* Orbital cluster */}
      <Animated.View style={[styles.orbitWrap, { transform: [{ translateY: floatY }] }]}>
        {/* Background rings */}
        <View style={[styles.ring, styles.ringOuter]} />
        <View style={[styles.ring, styles.ringMiddle]} />
        <View style={[styles.ring, styles.ringInner]} />

        {/* Center avatar */}
        <View style={styles.centerAvatar}>
          <View style={styles.centerHead} />
          <View style={styles.centerBody} />
        </View>

        {/* Orbit avatars */}
        {AVATARS.map((av, i) => {
          const pos = avatarPos(av.angle);
          return (
            <View
              key={i}
              style={[
                styles.avatar,
                {
                  left: pos.left,
                  top: pos.top,
                  backgroundColor: av.bg,
                },
              ]}
            >
              <View style={styles.avatarHead} />
              <View style={styles.avatarBody} />
              {av.pin && <Text style={styles.badge}>📍</Text>}
              {av.chat && <Text style={styles.badge}>💬</Text>}
            </View>
          );
        })}
      </Animated.View>

      {/* Tagline */}
      <Text style={styles.tagline}>New Places,{'\n'}Unforgettable Dating.</Text>

      {/* Login button */}
      <TouchableOpacity
        style={styles.loginBtn}
        onPress={() => navigation.navigate('Login')}
        activeOpacity={0.85}
      >
        <Text style={styles.loginIcon}>✉</Text>
        <Text style={styles.loginText}>Login with Email</Text>
      </TouchableOpacity>

      {/* Sign up footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.footerLink}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const ORBIT_OUTER_D = ORBIT * 0.85;
const ORBIT_MIDDLE_D = ORBIT * 0.62;
const ORBIT_INNER_D = ORBIT * 0.40;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 64,
    paddingBottom: 44,
  },

  logo: { width: 140, height: 110, marginBottom: 40 },

  orbitWrap: {
    width: ORBIT,
    height: ORBIT,
    position: 'relative',
  },

  ring: {
    position: 'absolute',
    borderRadius: 9999,
  },
  ringOuter: {
    width: ORBIT_OUTER_D,
    height: ORBIT_OUTER_D,
    top: (ORBIT - ORBIT_OUTER_D) / 2,
    left: (ORBIT - ORBIT_OUTER_D) / 2,
    borderWidth: 1,
    borderColor: 'rgba(232,56,109,0.22)',
  },
  ringMiddle: {
    width: ORBIT_MIDDLE_D,
    height: ORBIT_MIDDLE_D,
    top: (ORBIT - ORBIT_MIDDLE_D) / 2,
    left: (ORBIT - ORBIT_MIDDLE_D) / 2,
    backgroundColor: 'rgba(232,56,109,0.06)',
  },
  ringInner: {
    width: ORBIT_INNER_D,
    height: ORBIT_INNER_D,
    top: (ORBIT - ORBIT_INNER_D) / 2,
    left: (ORBIT - ORBIT_INNER_D) / 2,
    backgroundColor: 'rgba(232,56,109,0.12)',
  },

  centerAvatar: {
    position: 'absolute',
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    top: (ORBIT - CENTER_SIZE) / 2,
    left: (ORBIT - CENTER_SIZE) / 2,
    borderRadius: CENTER_SIZE / 2,
    backgroundColor: '#F9D5BC',
    borderWidth: 3,
    borderColor: Colors.background,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  centerHead: {
    position: 'absolute',
    top: CENTER_SIZE * 0.18,
    width: CENTER_SIZE * 0.38,
    height: CENTER_SIZE * 0.38,
    borderRadius: CENTER_SIZE * 0.19,
    backgroundColor: '#E8A87C',
  },
  centerBody: {
    width: CENTER_SIZE * 0.72,
    height: CENTER_SIZE * 0.42,
    borderRadius: CENTER_SIZE * 0.36,
    backgroundColor: '#E8A87C',
    marginBottom: -2,
  },

  avatar: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2.5,
    borderColor: Colors.background,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  avatarHead: {
    position: 'absolute',
    top: AVATAR_SIZE * 0.18,
    width: AVATAR_SIZE * 0.38,
    height: AVATAR_SIZE * 0.38,
    borderRadius: AVATAR_SIZE * 0.19,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  avatarBody: {
    width: AVATAR_SIZE * 0.72,
    height: AVATAR_SIZE * 0.40,
    borderRadius: AVATAR_SIZE * 0.36,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: -2,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -6,
    fontSize: 14,
  },

  tagline: {
    fontSize: 27,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 36,
    marginTop: 36,
  },

  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 30,
    height: 56,
    width: '100%',
    marginTop: 'auto',
    marginBottom: 0,
    gap: 10,
  },
  loginIcon: {
    fontSize: 18,
    color: Colors.white,
  },
  loginText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});
