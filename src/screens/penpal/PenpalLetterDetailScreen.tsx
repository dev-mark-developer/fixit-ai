import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { penpalApi, PenpalLetter } from '../../api/penpal';
import { getUser } from '../../store/auth';

type Props = NativeStackScreenProps<PenpalStackParamList, 'PenpalLetterDetail'>;

export default function PenpalLetterDetailScreen({ route, navigation }: Props) {
  const { letterId } = route.params;
  const [letter, setLetter] = useState<PenpalLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    getUser().then((u) => setCurrentUserId(u?.id ?? null));
    penpalApi.getLetter(letterId)
      .then((res) => setLetter(res.data?.data ?? null))
      .catch(() => setLetter(null))
      .finally(() => setLoading(false));
  }, [letterId]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!letter) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>Letter not found.</Text>
      </View>
    );
  }

  const isInbox = letter.receiverId === currentUserId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.letterHeader}>
        <Text style={styles.letterTitle}>{letter.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>From</Text>
          <Text style={styles.metaValue}>{letter.senderPseudoName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>To</Text>
          <Text style={styles.metaValue}>{letter.receiverPseudoName}</Text>
        </View>
        <Text style={styles.date}>{formatDate(letter.createdAt)}</Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.body}>{letter.content}</Text>

      {isInbox && (
        <TouchableOpacity
          style={styles.replyBtn}
          onPress={() =>
            navigation.navigate('PenpalCompose', {
              receiverId: letter.senderId,
              receiverPseudoName: letter.senderPseudoName,
            })
          }
        >
          <Text style={styles.replyBtnText}>✏️  Reply to {letter.senderPseudoName}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  notFoundText: { fontSize: 15, color: Colors.textSecondary },
  letterHeader: {
    backgroundColor: Colors.primaryLight, borderRadius: 16, padding: 18, marginBottom: 24,
    borderWidth: 1, borderColor: Colors.primaryMuted,
  },
  letterTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  metaLabel: { fontSize: 12, color: Colors.textSecondary, width: 36, fontWeight: '600', textTransform: 'uppercase' },
  metaValue: { fontSize: 14, color: Colors.text, fontWeight: '600', marginLeft: 8 },
  date: { fontSize: 12, color: Colors.textMuted, marginTop: 10 },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 24 },
  body: { fontSize: 16, color: Colors.text, lineHeight: 28 },
  replyBtn: {
    marginTop: 36, paddingVertical: 15, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  replyBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
