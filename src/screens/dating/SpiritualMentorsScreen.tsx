import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Linking, Image,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { mentorApi, ExternalMentor } from '../../api/mentor';

type Props = NativeStackScreenProps<DatingStackParamList, 'SpiritualMentors'>;

export default function SpiritualMentorsScreen(_: Props) {
  const [mentors, setMentors] = useState<ExternalMentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mentorApi.getExternalMentors()
      .then((res) => setMentors(res.data?.data ?? []))
      .catch(() => setError('Could not load mentors. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.spiritual} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (mentors.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyText}>No external mentors available right now.</Text>
        <Text style={styles.emptySubText}>Check back soon.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={mentors}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <Text style={styles.headerNote}>
          These are trusted external mentors. Tap "Visit Website" to learn more about their work.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            {item.profileImageUrl ? (
              <Image source={{ uri: item.profileImageUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cardMeta}>
              <Text style={styles.mentorName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.mentorDesc} numberOfLines={3}>{item.description}</Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={styles.visitBtn}
            onPress={() => Linking.openURL(item.webPageUrl)}
            activeOpacity={0.85}
          >
            <Text style={styles.visitBtnText}>🌐 Visit Website</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: 24 },
  errorText: { fontSize: 14, color: Colors.error, textAlign: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.text, textAlign: 'center', marginBottom: 6 },
  emptySubText: { fontSize: 13, color: Colors.textSecondary },

  list: { padding: 20, paddingBottom: 40, backgroundColor: Colors.background },
  headerNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTop: { flexDirection: 'row', gap: 14, marginBottom: 14 },

  avatar: { width: 60, height: 60, borderRadius: 30, flexShrink: 0 },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.spiritualLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: Colors.spiritual },

  cardMeta: { flex: 1 },
  mentorName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  mentorDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  visitBtn: {
    backgroundColor: Colors.spiritual,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  visitBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
