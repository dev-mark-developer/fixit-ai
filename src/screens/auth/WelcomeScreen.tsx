import React, { useEffect, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';

const LOGO = require('../../assets/fixit-app-logo.png');
const INTRO = require('../../assets/intro.png');

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const { width } = Dimensions.get('window');
const ILLUSTRATION = Math.min(width * 0.88, 360);

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

      {/* Circular people illustration (Figma) */}
      <Animated.Image
        source={INTRO}
        style={[styles.illustration, { transform: [{ translateY: floatY }] }]}
        resizeMode="contain"
      />

      {/* Tagline */}
      <Text style={styles.tagline}>New Places,{'\n'}Unforgettable Dating.</Text>

      {/* Login button */}
      <TouchableOpacity
        style={styles.loginBtn}
        onPress={() => navigation.navigate('Login')}
        activeOpacity={0.85}
      >
        <View style={styles.loginIconCircle}>
          <Icon name="mail" size={18} color={Colors.primary} />
        </View>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 64,
    paddingBottom: 44,
  },

  logo: { width: 140, height: 110, marginBottom: 24 },

  illustration: {
    width: ILLUSTRATION,
    height: ILLUSTRATION,
  },

  tagline: {
    fontSize: 27,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 36,
    marginTop: 24,
  },

  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 58,
    width: '100%',
    marginTop: 28,
    gap: 12,
  },
  loginIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 'auto',
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
