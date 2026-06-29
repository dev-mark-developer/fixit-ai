import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingDrawerParamList, DatingStackParamList } from '../../types/navigation';
import { datingApi, DatingMatch } from '../../api/dating';
import AppAlert from '../../components/common/AppAlert';
import AppButton from '../../components/common/AppButton';
import { Colors } from '../../utils/colors';

type Props = CompositeScreenProps<
  DrawerScreenProps<DatingDrawerParamList, 'DatingMatches'>,
  NativeStackScreenProps<DatingStackParamList>
>;

type TabKey = 'matches' | 'likes_received' | 'my_likes';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'matches', label: 'My Matches' },
  { key: 'likes_received', label: 'Likes Received' },
  { key: 'my_likes', label: 'My Likes' },
];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function formatTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ──────────────────────────────────────────────────────────────
// Match list item
// ──────────────────────────────────────────────────────────────
interface MatchItemProps {
  match: DatingMatch;
  onPress: () => void;
}

function MatchItem({ match, onPress }: MatchItemProps) {
  const avatarUri = match.otherDisplayImageUrl ?? match.otherProfileImageUrl ?? undefined;
  const displayName = `${match.otherFirstName} ${match.otherLastName}`;
  const timeStr = formatTime(match.lastMessageAt ?? match.matchedAt);

  return (
    <TouchableOpacity style={matchItemStyles.row} onPress={onPress} activeOpacity={0.8}>
      <View style={matchItemStyles.avatarWrap}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={matchItemStyles.avatar} />
        ) : (
          <View style={[matchItemStyles.avatar, matchItemStyles.avatarFallback]}>
            <Text style={matchItemStyles.avatarInitial}>
              {match.otherFirstName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {match.unreadCount > 0 && (
          <View style={matchItemStyles.badge}>
            <Text style={matchItemStyles.badgeText}>
              {match.unreadCount > 9 ? '9+' : match.unreadCount}
            </Text>
          </View>
        )}
      </View>

      <View style={matchItemStyles.textBlock}>
        <View style={matchItemStyles.topRow}>
          <Text style={matchItemStyles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={matchItemStyles.time}>{timeStr}</Text>
        </View>
        <Text
          style={[
            matchItemStyles.lastMessage,
            match.unreadCount > 0 && matchItemStyles.lastMessageUnread,
          ]}
          numberOfLines={1}
        >
          {match.lastMessage ?? 'Matched! Say hello'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const matchItemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    backgroundColor: Colors.datingLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 22, fontWeight: '700', color: Colors.dating },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.dating,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  textBlock: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  time: { fontSize: 12, color: Colors.textMuted },
  lastMessage: { fontSize: 14, color: Colors.textSecondary },
  lastMessageUnread: { color: Colors.text, fontWeight: '600' },
});

// ──────────────────────────────────────────────────────────────
// Tab panels
// ──────────────────────────────────────────────────────────────
interface MatchesTabProps {
  navigation: Props['navigation'];
}

function MatchesTab({ navigation }: MatchesTabProps) {
  const [matches, setMatches] = useState<DatingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await datingApi.getMatches();
      setMatches(res.data?.data ?? []);
    } catch {
      setAlert({ title: 'Error', message: 'Could not load matches. Please try again.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={tabStyles.centered}>
        <ActivityIndicator color={Colors.dating} size="large" />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={matches}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <MatchItem
            match={item}
            onPress={() =>
              navigation.navigate('DatingChatDetail', {
                matchId: item.id,
                matchedUserId: item.otherUserId,
                matchedUserName: `${item.otherFirstName} ${item.otherLastName}`,
              })
            }
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[Colors.dating]}
            tintColor={Colors.dating}
          />
        }
        ListEmptyComponent={
          <View style={tabStyles.emptyState}>
            <Text style={tabStyles.emptyEmoji}>💞</Text>
            <Text style={tabStyles.emptyTitle}>No matches yet</Text>
            <Text style={tabStyles.emptySub}>Keep swiping to find your match!</Text>
          </View>
        }
      />
      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => setAlert(null)}
      />
    </>
  );
}

interface LikesReceivedTabProps {
  navigation: Props['navigation'];
}

function LikesReceivedTab({ navigation }: LikesReceivedTabProps) {
  // Blurred example card + premium CTA
  return (
    <View style={tabStyles.premiumContainer}>
      {/* Example blurred card(s) */}
      <View style={tabStyles.blurredCardStack}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              tabStyles.blurredCard,
              { marginTop: i * 10, opacity: 1 - i * 0.25, zIndex: 3 - i },
            ]}
          >
            <View style={tabStyles.blurredAvatar} />
            <View style={tabStyles.blurredLines}>
              <View style={[tabStyles.blurredLine, { width: '60%' }]} />
              <View style={[tabStyles.blurredLine, { width: '40%', marginTop: 6 }]} />
            </View>
          </View>
        ))}
        {/* Lock overlay */}
        <View style={tabStyles.lockOverlay}>
          <Text style={tabStyles.lockEmoji}>🔒</Text>
        </View>
      </View>

      <Text style={tabStyles.premiumTitle}>See Who Likes You</Text>
      <Text style={tabStyles.premiumSub}>
        Upgrade to Premium to see everyone who has already liked your profile and match instantly.
      </Text>

      <AppButton
        title="Upgrade to Premium"
        onPress={() => navigation.navigate('DatingPremium', { datingType: 'NonSpiritual' })}
        style={tabStyles.premiumBtn}
      />
    </View>
  );
}

function MyLikesTab() {
  return (
    <View style={tabStyles.centered}>
      <Text style={tabStyles.emptyEmoji}>🕐</Text>
      <Text style={tabStyles.emptyTitle}>Coming Soon</Text>
      <Text style={tabStyles.emptySub}>
        You'll be able to see profiles you've liked here.
      </Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Premium tab
  premiumContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  blurredCardStack: {
    width: '100%',
    height: 160,
    marginBottom: 36,
    position: 'relative',
    alignItems: 'center',
  },
  blurredCard: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blurredAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.border,
    marginRight: 14,
  },
  blurredLines: { flex: 1 },
  blurredLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.border,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14,
  },
  lockEmoji: { fontSize: 40 },

  premiumTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  premiumSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  premiumBtn: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: Colors.dating,
  },
});

// ──────────────────────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────────────────────
export default function DatingMatchesScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('matches');

  return (
    <SafeAreaView style={styles.root}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      <View style={styles.tabContent}>
        {activeTab === 'matches' && <MatchesTab navigation={navigation} />}
        {activeTab === 'likes_received' && <LikesReceivedTab navigation={navigation} />}
        {activeTab === 'my_likes' && <MyLikesTab />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    position: 'relative',
  },
  tabItemActive: {},
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.dating,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: Colors.dating,
  },

  tabContent: { flex: 1 },
});
