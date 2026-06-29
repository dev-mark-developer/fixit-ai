import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingDrawerParamList, DatingStackParamList } from '../../types/navigation';
import { datingApi, DatingMatch } from '../../api/dating';
import { Colors } from '../../utils/colors';

type Props = CompositeScreenProps<
  DrawerScreenProps<DatingDrawerParamList, 'DatingChats'>,
  NativeStackScreenProps<DatingStackParamList>
>;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function DatingChatsScreen({ navigation }: Props) {
  const [matches, setMatches] = useState<DatingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const openChat = (match: DatingMatch) => {
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

    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openChat(item)}>
        <View style={styles.avatarWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
          {item.unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>
              {item.otherFirstName} {item.otherLastName}
            </Text>
            <Text style={styles.time}>{timeLabel}</Text>
          </View>
          <Text
            style={[styles.preview, item.unreadCount > 0 && styles.previewUnread]}
            numberOfLines={1}
          >
            {item.lastMessage ?? 'You matched! Say hello 👋'}
          </Text>
        </View>
      </TouchableOpacity>
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
    <View style={styles.root}>
      <FlatList
        data={matches}
        keyExtractor={(m) => String(m.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Colors.dating}
            colors={[Colors.dating]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Conversations</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySub}>
              Start by matching with someone!
            </Text>
          </View>
        }
        contentContainerStyle={matches.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: Colors.text },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.datingLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 22, fontWeight: '700', color: Colors.dating },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.dating,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: Colors.white },

  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 8 },
  time: { fontSize: 12, color: Colors.textMuted },
  preview: { fontSize: 14, color: Colors.textSecondary },
  previewUnread: { color: Colors.text, fontWeight: '600' },

  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 90 },

  emptyContainer: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
