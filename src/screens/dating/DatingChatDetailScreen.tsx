import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { DatingStackParamList } from '../../types/navigation';
import { datingApi, ChatMessage } from '../../api/dating';
import { getUser } from '../../store/auth';
import { Colors } from '../../utils/colors';
import RemoteImage from '../../components/common/RemoteImage';
import { chatHub } from '../../services/chatHub';
import ReportModal from '../../components/common/ReportModal';
import { useModuleStatus } from '../../store/ModuleStatusContext';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingChatDetail'>;

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just Now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DatingChatDetailScreen({ route, navigation }: Props) {
  const { matchId, matchedUserId, matchedUserName } = route.params;
  const { datingType } = useModuleStatus();
  const isSpiritual = datingType === 'Spiritual';
  const accent = isSpiritual ? Colors.spiritual : Colors.dating;
  const limeLight = isSpiritual ? Colors.spiritualLimeLight : Colors.datingLight;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [inputText, setInputText] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [matchedAvatar, setMatchedAvatar] = useState<string | null>(null);
  const [openingMoves, setOpeningMoves] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const handleUnmatch = useCallback(() => {
    Alert.alert(
      'Unmatch',
      `Are you sure you want to unmatch with ${matchedUserName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch', style: 'destructive',
          onPress: async () => {
            try {
              await datingApi.unmatch(matchId);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Could not unmatch. Please try again.');
            }
          },
        },
      ],
    );
  }, [matchId, matchedUserName, navigation]);

  // Load history + connect SignalR
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const user = await getUser();
        if (!active) return;
        setCurrentUserId(user?.id ?? null);

        const res = await datingApi.getMessages(matchId, { page: 1, pageSize: 50 });
        if (!active) return;
        setMessages(res.data?.data ?? []);

        await chatHub.connect();
        if (!active) return;
        setConnected(true);

        await chatHub.markAsRead(matchId, matchedUserId);
      } catch {
        // connection failure is non-fatal; history still shows
      } finally {
        if (active) setLoading(false);
      }
    };

    init();

    return () => {
      active = false;
      chatHub.disconnect();
      setConnected(false);
    };
  }, [matchId, matchedUserId]);

  // Header avatar — reuse the matches list (already-available endpoint)
  useEffect(() => {
    let active = true;
    datingApi.getMatches()
      .then((res) => {
        if (!active) return;
        const match = (res.data?.data ?? []).find((m: any) => m.id === matchId);
        if (match) {
          setMatchedAvatar(match.otherDisplayImageUrl ?? match.otherProfileImageUrl ?? null);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [matchId]);

  // "Opening Move" suggestions for an empty conversation — the user's own
  // selected ice-breaker questions (existing profile + icebreaker endpoints)
  useEffect(() => {
    let active = true;
    Promise.all([datingApi.getProfile(), datingApi.getIceBreakers()])
      .then(([profileRes, questionsRes]) => {
        if (!active) return;
        const ids: number[] = profileRes.data?.data?.iceBreakerQuestionIds ?? [];
        const all: { id: number; question: string }[] = questionsRes.data?.data ?? [];
        setOpeningMoves(
          all.filter((q) => ids.includes(q.id)).map((q) => q.question),
        );
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Subscribe to incoming messages
  useEffect(() => {
    const unsub = chatHub.onMessage((msg) => {
      if (msg.matchId !== matchId) return;
      setMessages((prev) => {
        // avoid duplicates (server echoes to sender too)
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [msg, ...prev];
      });
      // Mark as read when the other person sends
      if (msg.senderId !== currentUserId) {
        chatHub.markAsRead(matchId, msg.senderId).catch(() => {});
      }
    });
    return unsub;
  }, [matchId, currentUserId]);

  const sendText = useCallback(async (text: string) => {
    if (!text || sending) return;
    setSending(true);
    try {
      await chatHub.sendMessage(matchId, matchedUserId, text);
    } catch {
      // Optimistically restore the text if send fails
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [sending, matchId, matchedUserId]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    sendText(text);
  }, [inputText, sendText]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.senderId === currentUserId;
    const isImage = !!item.fileUrl && item.messageType?.toLowerCase() === 'image';

    return (
      <View style={styles.messageBlock}>
        <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
          {!isMine && (
            matchedAvatar ? (
              <RemoteImage uri={matchedAvatar} style={styles.bubbleAvatar} />
            ) : (
              <View style={[styles.bubbleAvatar, styles.bubbleAvatarFallback]}>
                <Text style={styles.bubbleAvatarInitial}>
                  {matchedUserName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )
          )}
          {isImage ? (
            <RemoteImage
              uri={item.fileUrl}
              style={styles.imageBubble}
              resizeMode="cover"
              indicatorColor={accent}
            />
          ) : (
            <View style={[
              styles.bubble,
              isMine ? { backgroundColor: accent, borderBottomRightRadius: 4 } : styles.bubbleTheirs,
            ]}>
              <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                {item.content ?? (item.fileUrl ? '[Attachment]' : '')}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeRight : styles.bubbleTimeLeft]}>
          {formatTimeAgo(item.sentAt)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  const showOpeningMove = messages.length === 0;

  return (
    <SafeAreaView style={styles.root}>
      {/* Custom header: back + avatar + name + status */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        {matchedAvatar ? (
          <RemoteImage uri={matchedAvatar} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.bubbleAvatarFallback]}>
            <Text style={styles.headerAvatarInitial}>
              {matchedUserName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.headerName} numberOfLines={1}>{matchedUserName}</Text>
          {connected && <Text style={[styles.headerStatus, { color: accent }]}>Online</Text>}
        </View>
        <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={8}>
          <Icon name="ellipsis-vertical" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.headerDivider} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ReportModal
          visible={reportVisible}
          reportedUserId={matchedUserId}
          reportedName={matchedUserName}
          module="Dating"
          onClose={() => setReportVisible(false)}
        />

        {/* Action sheet menu */}
        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
        >
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
            <View style={styles.menuSheet}>
              <Text style={styles.menuTitle}>{matchedUserName}</Text>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setMenuVisible(false); setReportVisible(true); }}
              >
                <Icon name="flag" size={18} color={Colors.error} style={styles.menuItemIcon} />
                <Text style={styles.menuItemText}>Report User</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setMenuVisible(false); handleUnmatch(); }}
              >
                <Icon name="heart-dislike" size={18} color={Colors.error} style={styles.menuItemIcon} />
                <Text style={[styles.menuItemText, { color: Colors.error }]}>Unmatch</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, styles.menuCancel]} onPress={() => setMenuVisible(false)}>
                <Text style={styles.menuCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {showOpeningMove ? (
          <View style={styles.flex}>
            {/* Opening Move card (Figma) */}
            <View style={[styles.openingCard, { backgroundColor: limeLight }]}>
              <Text style={styles.openingTitle}>
                Message {matchedUserName} first, or see if they reply to your Opening Move
              </Text>
              <Text style={styles.openingSub}>Your Opening move</Text>
              {(openingMoves.length > 0 ? openingMoves : DEFAULT_OPENING_MOVES).map((q, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.openingOption}
                  onPress={() => sendText(q)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.openingOptionText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.listContent}
            ListFooterComponent={<Text style={styles.dayLabel}>Today</Text>}
          />
        )}

        {/* Input row */}
        <View style={styles.inputRow}>
          <Icon name="attach" size={24} color={accent} style={styles.attachIcon} />
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type something"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={1000}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <Icon name="mic-outline" size={22} color={accent} />
            <TouchableOpacity
              style={styles.sendBtn}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.8}
              onPress={handleSend}
            >
              {sending
                ? <ActivityIndicator color={accent} size="small" />
                : <Icon name="paper-plane-outline" size={22} color={accent} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const DEFAULT_OPENING_MOVES = [
  "What's the most interesting place you've ever been?",
  "What's your hidden talent?",
  "What's something fun you've done recently?",
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  headerAvatar: { width: 42, height: 42, borderRadius: 21 },
  headerAvatarInitial: { fontSize: 17, fontWeight: '700', color: Colors.textSecondary },
  headerText: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '700', color: Colors.text },
  headerStatus: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  headerDivider: { height: 1, backgroundColor: Colors.border },

  dayLabel: {
    textAlign: 'center', fontSize: 14, fontWeight: '600',
    color: Colors.text, paddingVertical: 14,
  },

  listContent: { paddingHorizontal: 16, paddingVertical: 12 },

  messageBlock: { marginVertical: 4 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },

  bubbleAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 8 },
  bubbleAvatarFallback: {
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleAvatarInitial: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },

  bubble: {
    maxWidth: '75%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleTheirs: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: Colors.white },
  bubbleTextTheirs: { color: Colors.text },

  imageBubble: { width: 210, height: 210, borderRadius: 14 },

  bubbleTime: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  bubbleTimeRight: { textAlign: 'right' },
  bubbleTimeLeft: { textAlign: 'left', marginLeft: 42 },

  // Opening move (empty conversation)
  openingCard: {
    margin: 16,
    borderRadius: 18,
    padding: 18,
  },
  openingTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, lineHeight: 23, marginBottom: 10 },
  openingSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  openingOption: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  openingOptionText: { fontSize: 14, color: Colors.text, textAlign: 'center' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    gap: 8,
  },
  attachIcon: { marginBottom: 14 },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 8,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 32,
    maxHeight: 110,
    fontSize: 15,
    color: Colors.text,
    paddingTop: Platform.OS === 'ios' ? 6 : 4,
    paddingBottom: 6,
  },
  sendBtn: { paddingBottom: 2 },

  menuOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingTop: 8,
  },
  menuTitle: {
    textAlign: 'center', fontSize: 13, fontWeight: '600',
    color: Colors.textMuted, paddingVertical: 12,
  },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16,
  },
  menuItemIcon: { marginRight: 14 },
  menuItemText: { fontSize: 16, fontWeight: '500', color: Colors.text },
  menuCancel: {
    marginTop: 8, borderTopWidth: 8, borderTopColor: Colors.background,
    justifyContent: 'center',
  },
  menuCancelText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
});
