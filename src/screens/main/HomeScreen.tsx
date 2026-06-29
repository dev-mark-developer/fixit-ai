import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { useAuth } from '../../store/AuthContext';
import { useModuleStatus } from '../../store/ModuleStatusContext';
import api from '../../api/axios';
import { useState } from 'react';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { hasDating, hasPenpal } = useModuleStatus();
  const [unreadCount, setUnreadCount] = useState(0);

  const hasBothModules = hasDating && hasPenpal;
  const hasNoModule = !hasDating && !hasPenpal;

  const fetchUnread = useCallback(() => {
    api.get('/notifications/unread-count')
      .then((res) => setUnreadCount(res.data?.data ?? 0))
      .catch(() => {});
  }, []);

  useFocusEffect(fetchUnread);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Fixit</Text>
        <View style={styles.headerRight}>
          <View style={styles.welcomeWrap}>
            <Text style={styles.welcomeLabel}>Welcome back,</Text>
            <Text style={styles.welcomeName}>{user?.firstName ?? '...'} 👋</Text>
          </View>
          <TouchableOpacity
            style={styles.bellWrap}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : String(unreadCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {hasBothModules ? 'Where To?' : 'What You '}
          {!hasBothModules && <Text style={styles.titleHighlight}>Want To Do?</Text>}
        </Text>
        <Text style={styles.subtitle}>
          {hasBothModules
            ? 'Pick a section to continue your journey.'
            : "Choose how you'd like to connect with others today."}
        </Text>

        {/* Dating Card — always visible */}
        <TouchableOpacity
          style={[styles.card, styles.datingCard]}
          onPress={() => navigation.navigate('Dating')}
          activeOpacity={0.88}
        >
          <View style={styles.cardLeft}>
            <Text style={[styles.cardLabel, styles.datingLabel]}>Dating</Text>
            <Text style={[styles.cardHint, styles.datingHint]}>Find your match</Text>
          </View>
          <View style={styles.cardIllustration}>
            <Text style={styles.illTop}>💕</Text>
            <Text style={styles.illMain}>👫</Text>
            <Text style={styles.illBottomLeft}>🌸</Text>
            <Text style={styles.illBottomRight}>🌷</Text>
          </View>
        </TouchableOpacity>

        {/* Penpal Card — always visible */}
        <TouchableOpacity
          style={[styles.card, styles.penpalCard]}
          onPress={() => navigation.navigate('Penpal')}
          activeOpacity={0.88}
        >
          <View style={styles.cardLeft}>
            <Text style={[styles.cardLabel, styles.penpalLabel]}>Penpal</Text>
            <Text style={[styles.cardHint, styles.penpalHint]}>Write to the world</Text>
          </View>
          <View style={styles.cardIllustration}>
            <Text style={styles.illTop}>✨</Text>
            <Text style={styles.illMain}>✍️</Text>
            <Text style={styles.illBottomLeft}>📬</Text>
            <Text style={styles.illBottomRight}>🌍</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Spiritual Guru — only shown when no module is active */}
      {hasNoModule && (
        <TouchableOpacity
          style={styles.guruRow}
          onPress={() => navigation.navigate('MentorSetup')}
          activeOpacity={0.7}
        >
          <Text style={styles.guruText}>
            Are you a Spiritual Guru?{' '}
            <Text style={styles.guruLink}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    fontStyle: 'italic',
    color: Colors.primary,
    letterSpacing: -1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  welcomeWrap: { alignItems: 'flex-end' },
  welcomeLabel: { fontSize: 12, color: Colors.textSecondary },
  welcomeName: { fontSize: 15, fontWeight: '700', color: Colors.text },

  bellWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellIcon: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: Colors.white },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 34,
    marginBottom: 8,
  },
  titleHighlight: { color: Colors.primary },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 28,
  },

  card: {
    borderRadius: 20,
    marginBottom: 16,
    height: 148,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingLeft: 24,
  },
  datingCard: { backgroundColor: '#FDEEF1' },
  penpalCard: { backgroundColor: '#EEEEFF' },

  cardLeft: { flex: 1, justifyContent: 'center' },
  cardLabel: {
    fontSize: 32,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  datingLabel: { color: Colors.dating },
  penpalLabel: { color: Colors.spiritual },
  cardHint: { fontSize: 13, fontWeight: '500' },
  datingHint: { color: Colors.dating },
  penpalHint: { color: Colors.spiritual },

  cardIllustration: {
    width: 130,
    height: '100%',
    position: 'relative',
  },
  illTop: { position: 'absolute', top: 12, right: 28, fontSize: 22 },
  illMain: { position: 'absolute', top: 36, right: 16, fontSize: 56 },
  illBottomLeft: { position: 'absolute', bottom: 14, right: 52, fontSize: 22 },
  illBottomRight: { position: 'absolute', bottom: 10, right: 14, fontSize: 20 },

  guruRow: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingBottom: 28,
    backgroundColor: Colors.background,
  },
  guruText: { fontSize: 14, color: Colors.text },
  guruLink: { fontSize: 14, fontWeight: '700', color: Colors.primary, textDecorationLine: 'underline' },
});
