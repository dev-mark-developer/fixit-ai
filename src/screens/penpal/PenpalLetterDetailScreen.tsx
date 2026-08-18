import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    getUser().then(u => setCurrentUserId(u?.id ?? null));
    penpalApi
      .getLetter(letterId)
      .then(res => setLetter(res.data?.data ?? null))
      .catch(() => setLetter(null))
      .finally(() => setLoading(false));
  }, [letterId]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const isInbox = !!letter && letter.receiverId === currentUserId;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        {isInbox && letter && (
          <TouchableOpacity
            hitSlop={8}
            onPress={() =>
              navigation.navigate('PenpalCompose', {
                receiverId: letter.senderId,
                receiverPseudoName: letter.senderPseudoName,
              })
            }
          >
            <Text style={styles.replyText}>Reply</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.penpal} size="large" />
        </View>
      ) : !letter ? (
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Letter not found.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{letter.title}</Text>
          <Text style={styles.meta}>
            From {letter.senderPseudoName} · {formatDate(letter.createdAt)}
          </Text>
          <Text style={styles.body}>{letter.content}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backArrow: { fontSize: 24, color: Colors.text, fontWeight: '600' },
  replyText: { fontSize: 16, fontWeight: '700', color: Colors.penpal },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFoundText: { fontSize: 15, color: Colors.textSecondary },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 34,
    marginBottom: 8,
  },
  meta: { fontSize: 13, color: Colors.textMuted, marginBottom: 24 },
  body: { fontSize: 16, color: Colors.text, lineHeight: 28 },
});
