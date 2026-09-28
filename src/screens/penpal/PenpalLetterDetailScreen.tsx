import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import ReportModal from '../../components/common/ReportModal';
import { extractApiError } from '../../utils/apiError';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { penpalApi, PenpalLetter } from '../../api/penpal';
import { getUser } from '../../store/auth';
import { parseApiDate } from '../../utils/datetime';
import { isBlockedUser } from '../../utils/blockedUsers';

type Props = NativeStackScreenProps<PenpalStackParamList, 'PenpalLetterDetail'>;

export default function PenpalLetterDetailScreen({ route, navigation }: Props) {
  const { letterId } = route.params;
  const [letter, setLetter] = useState<PenpalLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getUser().then(u => setCurrentUserId(u?.id ?? null));
    penpalApi
      .getLetter(letterId)
      .then(res => setLetter(res.data?.data ?? null))
      .catch(() => setLetter(null))
      .finally(() => setLoading(false));
  }, [letterId]);

  const formatDate = (dateStr: string) =>
    parseApiDate(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const isInbox = !!letter && letter.receiverId === currentUserId;
  // No replying to someone the user blocked — the server would still take it.
  const canReply = isInbox && !!letter && !isBlockedUser(letter.senderId);
  // Only the sender can delete a letter — it goes for both people.
  const isMine = !!letter && letter.senderId === currentUserId;

  const handleDelete = () => {
    if (!letter) return;
    Alert.alert('Delete Letter', 'This letter will be deleted for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await penpalApi.deleteLetter(letter.id);
            navigation.goBack();
          } catch (err) {
            setDeleting(false);
            Alert.alert('Error', extractApiError(err));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {canReply && letter && (
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
          {isInbox && (
            <TouchableOpacity
              hitSlop={8}
              onPress={() => setReportVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Report this letter"
            >
              <Icon name="flag-outline" size={22} color={Colors.error} />
            </TouchableOpacity>
          )}
          {isMine &&
            (deleting ? (
              <ActivityIndicator color={Colors.error} size="small" />
            ) : (
              <TouchableOpacity
                hitSlop={8}
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete this letter"
              >
                <Icon name="trash-outline" size={22} color={Colors.error} />
              </TouchableOpacity>
            ))}
        </View>
      </View>

      {letter && (
        <ReportModal
          visible={reportVisible}
          reportedUserId={letter.senderId}
          reportedName={letter.senderPseudoName}
          module="Penpal"
          target={{ type: 'PenpalLetter', id: letter.id }}
          onClose={() => setReportVisible(false)}
        />
      )}

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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
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
