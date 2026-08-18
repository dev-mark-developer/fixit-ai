import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Image, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { useAuth } from '../../store/AuthContext';
import { useModuleStatus } from '../../store/ModuleStatusContext';
import api from '../../api/axios';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const { hasDating, hasPenpal, isMentor } = useModuleStatus();
  const [unreadCount, setUnreadCount] = useState(0);

  const hasBothModules = hasDating && hasPenpal;
  // Hidden once a module is active, and for users who are already gurus
  const hasNoModule = !hasDating && !hasPenpal && !isMentor;

  const fetchUnread = useCallback(() => {
    api.get('/notifications/unread-count')
      .then((res) => setUnreadCount(res.data?.data ?? 0))
      .catch(() => {});
  }, []);

  useFocusEffect(fetchUnread);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.7}
        >
          <Icon name="notifications-outline" size={24} color={Colors.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : String(unreadCount)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Icon name="log-out-outline" size={26} color={Colors.primary} />
        </TouchableOpacity>
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

        {/* Dating Card */}
        <TouchableOpacity
          style={[styles.card, styles.datingCard]}
          onPress={() => navigation.navigate('Dating')}
          activeOpacity={0.9}
        >
          <Text style={[styles.cardLabel, styles.datingLabel]}>Dating</Text>
          <Image
            source={require('../../assets/dating.png')}
            style={styles.cardImage}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Penpal Card */}
        <TouchableOpacity
          style={[styles.card, styles.penpalCard]}
          onPress={() => navigation.navigate('Penpal')}
          activeOpacity={0.9}
        >
          <Text style={[styles.cardLabel, styles.penpalLabel]}>Penpal</Text>
          <Image
            source={require('../../assets/penpal.png')}
            style={styles.cardImage}
            resizeMode="contain"
          />
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
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
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

  cardLabel: {
    flex: 1,
    fontSize: 34,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  datingLabel: { color: Colors.dating },
  penpalLabel: { color: Colors.spiritual },

  cardImage: { width: 160, height: '100%' },

  guruRow: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingBottom: 28,
    backgroundColor: Colors.background,
  },
  guruText: { fontSize: 14, color: Colors.text },
  guruLink: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
