import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalDrawerParamList, PenpalStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { penpalApi, PenpalProfile } from '../../api/penpal';
import AppButton from '../../components/common/AppButton';

type Props = CompositeScreenProps<
  DrawerScreenProps<PenpalDrawerParamList, 'PenpalHome'>,
  NativeStackScreenProps<PenpalStackParamList>
>;

export default function PenpalHomeScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<PenpalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const res = await penpalApi.getProfile();
      setProfile(res.data?.data ?? null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      setLoading(true);
      loadProfile();
    });
    return unsub;
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    navigation.getParent()?.navigate('PenpalEntry');
    return null;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{profile.pseudoName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.pseudoName}>{profile.pseudoName}</Text>
          <Text style={styles.profileMeta}>
            {profile.letterType} · {profile.identityVisibility === 'Yes'
              ? `${profile.firstName} ${profile.lastName}`
              : 'Anonymous'}
          </Text>
          {(profile.city || profile.state) && (
            <Text style={styles.profileLocation}>
              📍 {[profile.city, profile.state].filter(Boolean).join(', ')}
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.sectionTitle}>What would you like to do?</Text>

      <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('PenpalDiscover')}>
        <Text style={styles.actionIcon}>🔍</Text>
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>Discover Penpals</Text>
          <Text style={styles.actionDesc}>Find people to connect with</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('PenpalConnections')}>
        <Text style={styles.actionIcon}>🤝</Text>
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>Connections</Text>
          <Text style={styles.actionDesc}>Manage your penpal connections</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {profile.letterType !== 'Physical' && (
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('PenpalLetters')}>
          <Text style={styles.actionIcon}>📬</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Letters</Text>
            <Text style={styles.actionDesc}>Read and write letters</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: 20 },
  emptyContainer: { justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 16, padding: 16, marginBottom: 28, borderWidth: 1, borderColor: Colors.border,
  },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: Colors.white },
  profileInfo: { flex: 1, marginLeft: 12 },
  pseudoName: { fontSize: 17, fontWeight: '700', color: Colors.text },
  profileMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  profileLocation: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  editBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.primary,
  },
  editBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  actionIcon: { fontSize: 28, marginRight: 14 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  actionDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.textMuted },
});
