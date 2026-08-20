import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { datingApi, MAX_CHAT_ATTACHMENTS } from '../../api/dating';
import type { ChatAttachment, ChatMessage } from '../../api/dating';
import { getUser } from '../../store/auth';
import { Colors } from '../../utils/colors';
import RemoteImage from '../../components/common/RemoteImage';
import { chatHub, ChatConnectionState } from '../../services/chatHub';
import {
  pickFromCamera,
  pickFromLibrary,
  stageVoiceNote,
  unsupportedMessage,
  uploadStagedAttachments,
  StagedAttachment,
} from '../../services/chatAttachments';
import {
  MIN_VOICE_NOTE_MS,
  recordingToUpload,
  voicePlayer,
  voiceRecorder,
} from '../../services/voiceNote';
import {
  formatDayLabel,
  formatMessageTime,
  messageAttachments,
  parseChatDate,
} from '../../utils/chatMedia';
import MessageAttachments from '../../components/chat/MessageAttachments';
import VoiceNoteBubble from '../../components/chat/VoiceNoteBubble';
import AttachmentTray from '../../components/chat/AttachmentTray';
import RecordingBar from '../../components/chat/RecordingBar';
import AttachmentViewer from '../../components/chat/AttachmentViewer';
import ReportModal from '../../components/common/ReportModal';
import { useModuleStatus } from '../../store/ModuleStatusContext';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingChatDetail'>;

const PAGE_SIZE = 50;

type PickSource = 'library' | 'photo' | 'video';

/** Pulls something readable out of an axios error, a hub error, or anything else. */
function errorMessage(err: unknown, fallback: string): string {
  const apiMessage = (err as any)?.response?.data?.message;
  if (typeof apiMessage === 'string' && apiMessage) return apiMessage;
  const message = (err as Error)?.message;
  if (message === 'Not connected to chat.') {
    return 'You are not connected to chat right now. Check your connection and try again.';
  }
  return message || fallback;
}

/** Calendar-day key, so day separators don't need a date library. */
function dayKey(value?: string | null): string {
  const date = parseChatDate(value);
  return Number.isNaN(date.getTime()) ? '' : date.toDateString();
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
  const [uploading, setUploading] = useState(false);
  const [connectionState, setConnectionState] = useState<ChatConnectionState>(chatHub.connectionState);
  const [peerOnline, setPeerOnline] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [inputText, setInputText] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const [matchedAvatar, setMatchedAvatar] = useState<string | null>(null);
  const [openingMoves, setOpeningMoves] = useState<string[]>([]);

  // Composer attachments (local until send)
  const [staged, setStaged] = useState<StagedAttachment[]>([]);

  // Voice capture
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [metering, setMetering] = useState<number | undefined>(undefined);

  // History paging
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Full-screen media viewer
  const [viewer, setViewer] = useState<{ attachments: ChatAttachment[]; index: number } | null>(null);

  const flatListRef = useRef<FlatList>(null);
  // Hub callbacks outlive the render that created them — read ids through refs.
  const currentUserIdRef = useRef<number | null>(null);
  const stagedRef = useRef<StagedAttachment[]>([]);
  /** Attach-sheet choice, held until the sheet has finished dismissing. */
  const pendingPickRef = useRef<PickSource | null>(null);

  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);
  useEffect(() => { stagedRef.current = staged; }, [staged]);

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

  /** Hub first, REST as the fallback so the unread badge clears either way. */
  const markRead = useCallback(async (peerId: number) => {
    try {
      await chatHub.markAsRead(matchId, peerId);
    } catch {
      datingApi.markMessagesRead(matchId).catch(() => {});
    }
  }, [matchId]);

  // Load history + connect SignalR
  useEffect(() => {
    let active = true;

    // Acquired here rather than inside `init` so the cleanup's release is
    // always balanced, even if we unmount before the socket finishes opening.
    // Connection failure is non-fatal — the history still renders.
    const connecting = chatHub.connect().then(() => true).catch(() => false);

    const init = async () => {
      try {
        const user = await getUser();
        if (!active) return;
        setCurrentUserId(user?.id ?? null);
        currentUserIdRef.current = user?.id ?? null;

        const res = await datingApi.getMessages(matchId, { page: 1, pageSize: PAGE_SIZE });
        if (!active) return;
        setMessages(res.data?.data ?? []);
        setPage(1);
        setHasMore((res.data?.totalPages ?? 1) > 1);
      } catch {
        // history failure is non-fatal — the composer still works
      } finally {
        if (active) setLoading(false);
      }

      if (await connecting) {
        if (!active) return;
        await markRead(matchedUserId);
      }
    };

    init();

    return () => {
      active = false;
      // Never leave the mic hot or a note playing behind us.
      voiceRecorder.cancel().catch(() => {});
      voicePlayer.stop().catch(() => {});
      chatHub.disconnect();
    };
  }, [matchId, matchedUserId, markRead]);

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

  // Hub subscriptions — registered once, driven by refs
  useEffect(() => {
    const unsubMessage = chatHub.onMessage((msg) => {
      if (msg.matchId !== matchId) return;
      setMessages((prev) => {
        // The hub echoes to the sender too, so this is the only place a sent
        // message gets appended — never optimistically.
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [msg, ...prev];
      });
      if (msg.senderId !== currentUserIdRef.current) {
        markRead(msg.senderId).catch(() => {});
        // A message proves they're connected, whatever presence last said.
        setPeerOnline(true);
      }
    });

    const unsubRead = chatHub.onRead((readMatchId) => {
      if (readMatchId !== matchId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === currentUserIdRef.current && !m.isRead ? { ...m, isRead: true } : m,
        ),
      );
    });

    const unsubOnline = chatHub.onUserOnline((userId) => {
      if (userId === matchedUserId) setPeerOnline(true);
    });
    const unsubOffline = chatHub.onUserOffline((userId) => {
      if (userId === matchedUserId) setPeerOnline(false);
    });

    const unsubError = chatHub.onError((message) => {
      Alert.alert('Message not sent', message);
    });

    const unsubState = chatHub.onStateChange(setConnectionState);
    setConnectionState(chatHub.connectionState);

    return () => {
      unsubMessage();
      unsubRead();
      unsubOnline();
      unsubOffline();
      unsubError();
      unsubState();
    };
  }, [matchId, matchedUserId, markRead]);

  // ── History paging ────────────────────────────────────────────────────────

  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await datingApi.getMessages(matchId, { page: next, pageSize: PAGE_SIZE });
      const older: ChatMessage[] = res.data?.data ?? [];
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...older.filter((m) => !seen.has(m.id))];
      });
      setPage(next);
      setHasMore(next < (res.data?.totalPages ?? next));
    } catch {
      // keep what we have; the user can pull again
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, matchId]);

  // ── Sending ───────────────────────────────────────────────────────────────

  const sendText = useCallback(async (text: string) => {
    if (!text || sending) return;
    setSending(true);
    try {
      await chatHub.sendMessage(matchId, matchedUserId, text);
    } catch (err) {
      setInputText((current) => current || text);
      Alert.alert('Not sent', errorMessage(err, 'Your message could not be sent.'));
    } finally {
      setSending(false);
    }
  }, [sending, matchId, matchedUserId]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    const files = stagedRef.current;
    if ((!text && files.length === 0) || sending) return;

    if (files.length === 0) {
      setInputText('');
      sendText(text);
      return;
    }

    setSending(true);
    setUploading(true);
    setInputText('');
    try {
      // Two steps by design: REST uploads the bytes, the hub sends the message.
      const uploaded = await uploadStagedAttachments(matchId, files);
      setUploading(false);
      await chatHub.sendMessageWithAttachments(matchId, matchedUserId, text || null, uploaded);
      setStaged([]);
    } catch (err) {
      // Keep the tray intact so the user can just hit send again.
      setInputText((current) => current || text);
      Alert.alert('Not sent', errorMessage(err, 'Your attachments could not be sent.'));
    } finally {
      setUploading(false);
      setSending(false);
    }
  }, [inputText, sending, matchId, matchedUserId, sendText]);

  // ── Attachments ───────────────────────────────────────────────────────────

  const remainingSlots = MAX_CHAT_ATTACHMENTS - staged.length;

  const addStaged = useCallback((picked: StagedAttachment[]) => {
    if (picked.length === 0) return;
    setStaged((prev) => {
      const room = MAX_CHAT_ATTACHMENTS - prev.length;
      if (picked.length > room) {
        Alert.alert(
          'Too many files',
          `A message may carry at most ${MAX_CHAT_ATTACHMENTS} attachments.`,
        );
      }
      return [...prev, ...picked.slice(0, room)];
    });
  }, []);

  const openPicker = useCallback(async (source: PickSource) => {
    if (remainingSlots <= 0) {
      Alert.alert('Too many files', `A message may carry at most ${MAX_CHAT_ATTACHMENTS} attachments.`);
      return;
    }
    try {
      const { accepted, rejected } = source === 'library'
        ? await pickFromLibrary(remainingSlots)
        : await pickFromCamera(source === 'video' ? 'video' : 'photo');
      addStaged(accepted);
      if (rejected.length > 0) {
        Alert.alert('Unsupported file', unsupportedMessage(rejected));
      }
    } catch (err) {
      Alert.alert('Could not attach', errorMessage(err, 'That file could not be attached.'));
    }
  }, [remainingSlots, addStaged]);

  /**
   * Runs the choice the user made in the attach sheet. This is deliberately
   * deferred until the sheet has finished closing: the picker is a native view
   * controller, and on iOS presenting one while a `Modal` is still dismissing
   * silently does nothing — the picker never appears.
   */
  const runPendingPick = useCallback(() => {
    const source = pendingPickRef.current;
    pendingPickRef.current = null;
    if (source) openPicker(source);
  }, [openPicker]);

  const requestPick = useCallback((source: PickSource) => {
    pendingPickRef.current = source;
    setAttachMenuVisible(false);
    if (Platform.OS !== 'ios') {
      // Android presents nothing natively, so there's nothing to wait for.
      runPendingPick();
      return;
    }
    // Safety net in case `onDismiss` doesn't fire — `runPendingPick` clears the
    // ref before acting, so whichever path gets there first wins and the other
    // is a no-op. Without this a missed callback would leave Attach dead.
    setTimeout(runPendingPick, 700);
  }, [runPendingPick]);

  const removeStaged = useCallback((key: string) => {
    setStaged((prev) => prev.filter((s) => s.key !== key));
  }, []);

  // ── Voice notes ───────────────────────────────────────────────────────────

  const stopRecording = useCallback(async () => {
    const result = await voiceRecorder.stop();
    setRecording(false);
    setRecordMs(0);
    setMetering(undefined);
    if (!result) return;
    if (result.durationMs < MIN_VOICE_NOTE_MS) {
      Alert.alert('Too short', 'Hold the mic a little longer to record a voice note.');
      return;
    }
    addStaged([stageVoiceNote(recordingToUpload(result), result.durationMs)]);
  }, [addStaged]);

  const startRecording = useCallback(async () => {
    if (recording || sending) return;
    if (remainingSlots <= 0) {
      Alert.alert('Too many files', `A message may carry at most ${MAX_CHAT_ATTACHMENTS} attachments.`);
      return;
    }

    const granted = await voiceRecorder.ensurePermission();
    if (!granted) {
      Alert.alert(
        'Microphone blocked',
        'Allow microphone access in your device settings to send voice notes.',
      );
      return;
    }

    // Recording while a note plays fights over the audio session.
    await voicePlayer.stop().catch(() => {});

    try {
      setRecording(true);
      setRecordMs(0);
      await voiceRecorder.start(
        ({ positionMs, metering: level }) => {
          setRecordMs(positionMs);
          setMetering(level);
        },
        () => { stopRecording().catch(() => {}); },
      );
    } catch (err) {
      setRecording(false);
      Alert.alert('Cannot record', errorMessage(err, 'The microphone is unavailable.'));
    }
  }, [recording, sending, remainingSlots, stopRecording]);

  const cancelRecording = useCallback(async () => {
    await voiceRecorder.cancel();
    setRecording(false);
    setRecordMs(0);
    setMetering(undefined);
  }, []);

  // ── Rendering ─────────────────────────────────────────────────────────────

  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isMine = item.senderId === currentUserId;
    const files = messageAttachments(item);
    const voiceNote = files.length === 1 && files[0].fileType === 'VoiceNote' ? files[0] : null;
    const media = files.filter((f) => f.fileType !== 'VoiceNote');
    const text = item.content?.trim();

    // The list is inverted, so the *next* index is the older message — a day
    // change there means this item starts a new day and gets the separator.
    const older = messages[index + 1];
    const showDay = !older || dayKey(older.sentAt) !== dayKey(item.sentAt);

    return (
      <View>
        {showDay && <Text style={styles.dayLabel}>{formatDayLabel(item.sentAt)}</Text>}

        <View style={styles.messageBlock}>
          <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
            {!isMine && (
              matchedAvatar ? (
                <RemoteImage uri={matchedAvatar} style={styles.bubbleAvatar} indicatorColor={accent} />
              ) : (
                <View style={[styles.bubbleAvatar, styles.bubbleAvatarFallback]}>
                  <Text style={styles.bubbleAvatarInitial}>
                    {matchedUserName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )
            )}

            <View style={[styles.bubbleStack, isMine ? styles.stackRight : styles.stackLeft]}>
              {voiceNote && (
                <VoiceNoteBubble attachment={voiceNote} isMine={isMine} accent={accent} />
              )}

              {media.length > 0 && (
                <MessageAttachments
                  attachments={media}
                  accent={accent}
                  onPressAttachment={(i) => setViewer({ attachments: media, index: i })}
                />
              )}

              {/* A caption sent alongside files gets its own bubble under them. */}
              {!!text && (
                <View style={[
                  styles.bubble,
                  isMine ? { backgroundColor: accent, borderBottomRightRadius: 4 } : styles.bubbleTheirs,
                ]}>
                  <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                    {text}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.metaRow, isMine ? styles.metaRowRight : styles.metaRowLeft]}>
            <Text style={styles.bubbleTime}>{formatMessageTime(item.sentAt)}</Text>
            {isMine && (
              <Icon
                name={item.isRead ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.isRead ? accent : Colors.textMuted}
              />
            )}
          </View>
        </View>
      </View>
    );
  }, [currentUserId, messages, matchedAvatar, matchedUserName, accent]);

  const statusLabel = useMemo(() => {
    if (connectionState === 'connecting') return { text: 'Connecting…', color: Colors.textMuted };
    if (connectionState === 'reconnecting') return { text: 'Reconnecting…', color: Colors.textMuted };
    if (connectionState === 'disconnected') return { text: 'Offline', color: Colors.textMuted };
    // Presence has no roster: we only learn peer status from a live event.
    if (peerOnline === true) return { text: 'Online', color: accent };
    if (peerOnline === false) return { text: 'Offline', color: Colors.textMuted };
    return null;
  }, [connectionState, peerOnline, accent]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  const showOpeningMove = messages.length === 0;
  const canSend = (!!inputText.trim() || staged.length > 0) && !sending;

  return (
    <SafeAreaView style={styles.root}>
      {/* Custom header: back + avatar + name + status */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        {matchedAvatar ? (
          <RemoteImage uri={matchedAvatar} style={styles.headerAvatar} indicatorColor={accent} />
        ) : (
          <View style={[styles.headerAvatar, styles.bubbleAvatarFallback]}>
            <Text style={styles.headerAvatarInitial}>
              {matchedUserName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.headerName} numberOfLines={1}>{matchedUserName}</Text>
          {!!statusLabel && (
            <Text style={[styles.headerStatus, { color: statusLabel.color }]}>
              {statusLabel.text}
            </Text>
          )}
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

        <AttachmentViewer
          visible={viewer !== null}
          attachments={viewer?.attachments ?? []}
          initialIndex={viewer?.index ?? 0}
          accent={accent}
          onClose={() => setViewer(null)}
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

        {/* Attachment source picker */}
        <Modal
          visible={attachMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAttachMenuVisible(false)}
          // iOS: the picker can only be presented once this sheet is fully gone.
          onDismiss={runPendingPick}
        >
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setAttachMenuVisible(false)}>
            <View style={styles.menuSheet}>
              <Text style={styles.menuTitle}>
                Attach — {remainingSlots} slot{remainingSlots === 1 ? '' : 's'} left
              </Text>
              <TouchableOpacity style={styles.menuItem} onPress={() => requestPick('library')}>
                <Icon name="images-outline" size={18} color={accent} style={styles.menuItemIcon} />
                <Text style={styles.menuItemText}>Photos &amp; Videos</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={() => requestPick('photo')}>
                <Icon name="camera-outline" size={18} color={accent} style={styles.menuItemIcon} />
                <Text style={styles.menuItemText}>Take Photo</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={() => requestPick('video')}>
                <Icon name="videocam-outline" size={18} color={accent} style={styles.menuItemIcon} />
                <Text style={styles.menuItemText}>Record Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, styles.menuCancel]} onPress={() => setAttachMenuVisible(false)}>
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
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore
                ? <ActivityIndicator style={styles.moreSpinner} color={accent} />
                : null
            }
          />
        )}

        <AttachmentTray
          items={staged}
          accent={accent}
          uploading={uploading}
          onRemove={removeStaged}
          onClear={() => setStaged([])}
        />

        {recording ? (
          <RecordingBar
            positionMs={recordMs}
            metering={metering}
            accent={accent}
            onCancel={cancelRecording}
            onStop={stopRecording}
          />
        ) : (
          <View style={styles.inputRow}>
            <TouchableOpacity
              onPress={() => setAttachMenuVisible(true)}
              disabled={sending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Attach a file"
            >
              <Icon name="attach" size={24} color={accent} style={styles.attachIcon} />
            </TouchableOpacity>

            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={staged.length > 0 ? 'Add a caption…' : 'Type something'}
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={1000}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                onPress={startRecording}
                disabled={sending}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Record a voice note"
              >
                <Icon name="mic-outline" size={22} color={accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendBtn}
                disabled={!canSend}
                activeOpacity={0.8}
                onPress={handleSend}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                {sending
                  ? <ActivityIndicator color={accent} size="small" />
                  : <Icon
                      name="paper-plane-outline"
                      size={22}
                      color={canSend ? accent : Colors.textMuted}
                    />}
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  moreSpinner: { marginVertical: 16 },

  messageBlock: { marginVertical: 4 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },

  bubbleStack: { gap: 4, maxWidth: '82%' },
  stackRight: { alignItems: 'flex-end' },
  stackLeft: { alignItems: 'flex-start' },

  bubbleAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 8 },
  bubbleAvatarFallback: {
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleAvatarInitial: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },

  bubble: {
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

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaRowRight: { justifyContent: 'flex-end' },
  metaRowLeft: { justifyContent: 'flex-start', marginLeft: 42 },
  bubbleTime: { fontSize: 12, color: Colors.textMuted },

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
