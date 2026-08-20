import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import type { DatingDrawerParamList, DatingStackParamList } from '../../types/navigation';
import { datingApi, DatingMatch } from '../../api/dating';
import DatingTopBar from '../../components/dating/DatingTopBar';
import DatingBottomBar from '../../components/dating/DatingBottomBar';
import { Colors } from '../../utils/colors';
import RemoteImage from '../../components/common/RemoteImage';
import { useModuleStatus } from '../../store/ModuleStatusContext';
import { chatHub } from '../../services/chatHub';
import { messagePreview, parseChatDate } from '../../utils/chatMedia';
import { getUser } from '../../store/auth';

type Props = CompositeScreenProps<
  DrawerScreenProps<DatingDrawerParamList, 'DatingChats'>,
  NativeStackScreenProps<DatingStackParamList>
>;

function timeAgo(dateStr: string): string {
  const date = parseChatDate(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just Now';
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} Hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} Day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/** Most recent activity first — keeps live hub updates from landing mid-list. */
function recencyOf(match: DatingMatch): number {
  const date = parseChatDate(match.lastMessageAt ?? match.matchedAt);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default function DatingChatsScreen({ navigation }: Props) {
  const { datingType } = useModuleStatus();
  const isSpiritual = datingType === 'Spiritual';
  const accent = isSpiritual ? Colors.spiritual : Colors.dating;
  const lime = isSpiritual ? Colors.spiritualLime : Colors.datingSecondary;

  const [matches, setMatches] = useState<DatingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  // Read inside hub callbacks, which outlive the render that registered them.
  const currentUserId = useRef<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await datingApi.getMatches();
      setMatches(res.data?.data ?? []);
    } catch {
      // silently fail; empty state will show
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    let active = true;
    getUser().then((user) => { if (active) currentUserId.current = user?.id ?? null; });
    return () => { active = false; };
  }, []);

  // Live rows: a new message updates the preview, timestamp and unread badge
  // in place instead of waiting for the next focus refetch.
  useFocusEffect(
    useCallback(() => {
      chatHub.connect().catch(() => {
        // Offline is fine here — the list still renders from REST.
      });

      const unsubscribe = chatHub.onMessage((msg) => {
        setMatches((prev) =>
          prev.map((m) => {
            if (m.id !== msg.matchId) return m;
            const fromPeer = msg.senderId !== currentUserId.current;
            return {
              ...m,
              lastMessage: messagePreview(msg),
              lastMessageAt: msg.sentAt,
              unreadCount: fromPeer ? m.unreadCount + 1 : m.unreadCount,
            };
          }),
        );
      });

      return () => {
        unsubscribe();
        chatHub.disconnect();
      };
    }, []),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? matches.filter((m) =>
          `${m.otherFirstName} ${m.otherLastName}`.toLowerCase().includes(q),
        )
      : matches;
    return [...rows].sort((a, b) => recencyOf(b) - recencyOf(a));
  }, [matches, search]);

  const openChat = (match: DatingMatch) => {
    // Opening the thread marks it read, so clear the badge straight away.
    setMatches((prev) =>
      prev.map((m) => (m.id === match.id ? { ...m, unreadCount: 0 } : m)),
    );
    navigation.navigate('DatingChatDetail', {
      matchId: match.id,
      matchedUserId: match.otherUserId,
      matchedUserName: match.otherFirstName,
    });
  };

  const renderItem = ({ item }: { item: DatingMatch }) => {
    const initials = item.otherFirstName.charAt(0).toUpperCase();
    const imageUri = item.otherDisplayImageUrl ?? item.otherProfileImageUrl;
    const timeLabel = item.lastMessageAt ? timeAgo(item.lastMessageAt) : timeAgo(item.matchedAt);
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openChat(item)}>
        {imageUri ? (
          <RemoteImage uri={imageUri} style={styles.avatar} indicatorColor={accent} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={[styles.avatarInitial, { color: accent }]}>{initials}</Text>
          </View>
        )}

        <View style={styles.rowContent}>
          <Text style={styles.name} numberOfLines={1}>
            {item.otherFirstName} {item.otherLastName}
          </Text>
          {hasUnread ? (
            <Text style={[styles.newMessages, { color: lime }]} numberOfLines={1}>
              {item.unreadCount} new message{item.unreadCount > 1 ? 's' : ''}
            </Text>
          ) : (
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastMessage ?? 'You matched! Say hello'}
            </Text>
          )}
        </View>

        <Text style={styles.time}>{timeLabel}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <DatingTopBar />

      <Text style={styles.heading}>My Chats</Text>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search your chats"
          placeholderTextColor={Colors.textMuted}
        />
        <Icon name="search" size={20} color={accent} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => String(m.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={accent}
              colors={[accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="chatbubbles-outline" size={54} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>
                Start by matching with someone!
              </Text>
            </View>
          }
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyContainer : styles.listContent
          }
        />
      )}

      <DatingBottomBar active="DatingChats" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text, paddingVertical: 0 },

  listContent: { paddingBottom: 120 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 14 },
  avatarFallback: {
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700' },

  rowContent: { flex: 1, marginRight: 8 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  newMessages: { fontSize: 13, fontWeight: '700' },
  preview: { fontSize: 13, color: Colors.textSecondary },
  time: { fontSize: 12, color: Colors.textMuted },

  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 88 },

  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
