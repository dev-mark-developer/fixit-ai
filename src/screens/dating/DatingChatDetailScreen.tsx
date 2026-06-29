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
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DatingStackParamList } from '../../types/navigation';
import { datingApi, ChatMessage } from '../../api/dating';
import { getUser } from '../../store/auth';
import { Colors } from '../../utils/colors';
import { chatHub } from '../../services/chatHub';
import ReportModal from '../../components/common/ReportModal';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingChatDetail'>;

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DatingChatDetailScreen({ route, navigation }: Props) {
  const { matchId, matchedUserId, matchedUserName } = route.params;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [inputText, setInputText] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
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

  useEffect(() => {
    navigation.setOptions({
      title: matchedUserName,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginRight: 8 }}
        >
          <Text style={{ fontSize: 22, color: Colors.dating }}>⋯</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, matchedUserName, handleUnmatch]);

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

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    setSending(true);
    try {
      await chatHub.sendMessage(matchId, matchedUserId, text);
    } catch {
      // Optimistically re-add the text if send fails
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, matchId, matchedUserId]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.senderId === currentUserId;
    return (
      <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {item.content ? (
            <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
              {item.content}
            </Text>
          ) : item.fileUrl ? (
            <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
              [Attachment]
            </Text>
          ) : null}
          <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
            {formatTime(item.sentAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.dating} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <ReportModal
        visible={reportVisible}
        reportedUserId={matchedUserId}
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
              <Text style={styles.menuItemIcon}>🚩</Text>
              <Text style={styles.menuItemText}>Report User</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMenuVisible(false); handleUnmatch(); }}
            >
              <Text style={styles.menuItemIcon}>💔</Text>
              <Text style={[styles.menuItemText, { color: Colors.error }]}>Unmatch</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuCancel]} onPress={() => setMenuVisible(false)}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Connection status indicator */}
      {!connected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Connecting…</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No messages yet. Be the first to say hello!</Text>
          </View>
        }
      />

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message…"
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.8}
          onPress={handleSend}
        >
          {sending
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={styles.sendIcon}>➤</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  offlineBanner: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C',
    alignItems: 'center',
  },
  offlineText: { fontSize: 12, color: '#856404' },

  listContent: { paddingHorizontal: 16, paddingVertical: 12 },

  bubbleRow: { marginVertical: 3, flexDirection: 'row' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: Colors.white },
  bubbleTextTheirs: { color: Colors.text },

  bubbleTime: { fontSize: 10, marginTop: 4 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  bubbleTimeTheirs: { color: Colors.textMuted, textAlign: 'left' },

  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: Colors.surface,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 11 : 8,
    paddingBottom: 10,
    fontSize: 15,
    color: Colors.text,
    marginRight: 10,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: Colors.white, fontSize: 16 },

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
  menuItemIcon: { fontSize: 20, marginRight: 14 },
  menuItemText: { fontSize: 16, fontWeight: '500', color: Colors.text },
  menuCancel: {
    marginTop: 8, borderTopWidth: 8, borderTopColor: Colors.background,
    justifyContent: 'center',
  },
  menuCancelText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginLeft: 0 },
});
