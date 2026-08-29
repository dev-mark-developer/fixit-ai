import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import type { DatingDrawerParamList, DatingStackParamList } from '../../types/navigation';
import { datingApi, DatingLike, DatingMatch } from '../../api/dating';
import AppAlert from '../../components/common/AppAlert';
import ReportModal from '../../components/common/ReportModal';
import DatingTopBar from '../../components/dating/DatingTopBar';
import DatingBottomBar from '../../components/dating/DatingBottomBar';
import { Colors } from '../../utils/colors';
import { useSubscription } from '../../store/SubscriptionContext';
import { usePrefetchImages } from '../../utils/imageCache';
import RemoteImage from '../../components/common/RemoteImage';
import { useModuleStatus } from '../../store/ModuleStatusContext';

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

// The likes endpoints aren't typed in Swagger — read the common field spellings
const likeUserId = (l: DatingLike) => l.userId ?? l.otherUserId;
const likeName = (l: DatingLike) =>
  l.pseudoName ||
  [l.firstName ?? l.otherFirstName, l.lastName ?? l.otherLastName]
    .filter(Boolean)
    .join(' ') ||
  'Someone';
const likeImage = (l: DatingLike) =>
  l.displayImageUrl ?? l.profileImageUrl ?? l.otherDisplayImageUrl ?? l.otherProfileImageUrl;

const GRID_GAP = 14;
const CARD_W = (Dimensions.get('window').width - 40 - GRID_GAP) / 2;
const CARD_H = CARD_W * 1.35;

// ──────────────────────────────────────────────────────────────
// Photo-grid match card (Figma): flag top-left, chat top-right,
// name + location bottom-left
// ──────────────────────────────────────────────────────────────
interface MatchCardProps {
  match: DatingMatch;
  accent: string;
  onOpenProfile: () => void;
  onChat: () => void;
  onReport: () => void;
}

function MatchCard({ match, accent, onOpenProfile, onChat, onReport }: MatchCardProps) {
  const imageUri = match.otherDisplayImageUrl ?? match.otherProfileImageUrl;

  return (
    // The card body opens the profile; chat has its own button top-right.
    <TouchableOpacity style={cardStyles.card} onPress={onOpenProfile} activeOpacity={0.85}>
      <RemoteImage
        uri={imageUri}
        style={cardStyles.photo}
        resizeMode="cover"
        indicatorColor={accent}
        fallback={
          <View style={[cardStyles.photo, cardStyles.photoFallback]}>
            <Text style={cardStyles.photoInitial}>
              {match.otherFirstName.charAt(0).toUpperCase()}
            </Text>
          </View>
        }
      />

      {/* Flag (report) — top-left */}
      <TouchableOpacity
        style={[cardStyles.iconBtn, cardStyles.iconBtnTL]}
        onPress={onReport}
        hitSlop={6}
      >
        <Icon name="flag" size={16} color={accent} />
      </TouchableOpacity>

      {/* Chat — top-right */}
      <TouchableOpacity
        style={[cardStyles.iconBtn, cardStyles.iconBtnTR]}
        onPress={onChat}
        hitSlop={6}
      >
        <Icon name="chatbox" size={16} color={accent} />
        {match.unreadCount > 0 && <View style={cardStyles.unreadDot} />}
      </TouchableOpacity>

      {/* Name + location */}
      <View style={cardStyles.nameBlock}>
        <Text style={cardStyles.name} numberOfLines={1}>
          {match.otherFirstName} {match.otherLastName}
        </Text>
        <View style={cardStyles.locationRow}>
          <Icon name="location-outline" size={12} color={Colors.white} />
          <Text style={cardStyles.location} numberOfLines={1}>
            Matched {new Date(match.matchedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    marginBottom: GRID_GAP,
  },
  photo: { width: '100%', height: '100%', position: 'absolute' },
  photoFallback: {
    backgroundColor: Colors.spiritualLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoInitial: { fontSize: 44, fontWeight: '700', color: Colors.spiritual, opacity: 0.6 },

  iconBtn: {
    position: 'absolute',
    top: 10,
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnTL: { left: 10 },
  iconBtnTR: { right: 10 },
  unreadDot: {
    position: 'absolute', top: -3, right: -3,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.error,
    borderWidth: 1.5, borderColor: Colors.white,
  },

  nameBlock: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  location: {
    fontSize: 11,
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});

// ──────────────────────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────────────────────
export default function DatingMatchesScreen({ navigation }: Props) {
  const { datingType } = useModuleStatus();
  const accent = datingType === 'Spiritual' ? Colors.spiritual : Colors.dating;
  const { isPremium } = useSubscription();

  const [activeTab, setActiveTab] = useState<TabKey>('matches');
  const [matches, setMatches] = useState<DatingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [reportUserId, setReportUserId] = useState<number | null>(null);
  const [reportName, setReportName] = useState('');

  // Likes tabs (gap #7)
  const [likesReceived, setLikesReceived] = useState<DatingLike[]>([]);
  const [likesSent, setLikesSent] = useState<DatingLike[]>([]);
  usePrefetchImages([
    ...matches.map(m => m.otherDisplayImageUrl ?? m.otherProfileImageUrl),
    ...likesReceived.map(likeImage),
    ...likesSent.map(likeImage),
  ]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesLocked, setLikesLocked] = useState(false);

  // Only the newest request per list may write state, and each list blocks with
  // its spinner only until it has loaded once — after that refreshes are silent.
  const matchesReqRef = useRef(0);
  const matchesLoadedRef = useRef(false);
  const likesReqRef = useRef(0);
  const likesLoadedRef = useRef<Partial<Record<TabKey, boolean>>>({});

  const load = useCallback(async (isRefresh = false, silent = false) => {
    const reqId = ++matchesReqRef.current;
    if (!silent) { if (isRefresh) setRefreshing(true); else setLoading(true); }
    try {
      const res = await datingApi.getMatches();
      if (reqId !== matchesReqRef.current) return;
      setMatches(res.data?.data ?? []);
    } catch {
      if (reqId !== matchesReqRef.current) return;
      // A silent refresh leaves the list it already has alone rather than
      // interrupting a working screen with an alert nobody asked for.
      if (!silent) {
        setAlert({ title: 'Error', message: 'Could not load matches. Please try again.' });
      }
    } finally {
      if (reqId === matchesReqRef.current) {
        matchesLoadedRef.current = true;
        if (!silent) { setLoading(false); setRefreshing(false); }
      }
    }
  }, []);

  const loadLikes = useCallback(async (tab: 'likes_received' | 'my_likes', silent = false) => {
    const reqId = ++likesReqRef.current;
    if (!silent) setLikesLoading(true);
    try {
      const res = tab === 'likes_received'
        ? await datingApi.getLikesReceived()
        : await datingApi.getLikesSent();
      if (reqId !== likesReqRef.current) return;
      const rows: DatingLike[] = res.data?.data ?? [];
      if (tab === 'likes_received') {
        setLikesLocked(false);
        setLikesReceived(rows);
      } else {
        setLikesSent(rows);
      }
    } catch (err: any) {
      if (reqId !== likesReqRef.current) return;
      // 402/403 → premium required, show the locked preview instead. That one
      // applies even on a silent pass: losing premium changes what may be shown.
      const status = err?.response?.status;
      if (tab === 'likes_received' && (status === 402 || status === 403)) {
        setLikesLocked(true);
      } else if (!silent) {
        if (tab === 'likes_received') setLikesReceived([]); else setLikesSent([]);
      }
    } finally {
      if (reqId === likesReqRef.current) {
        likesLoadedRef.current[tab] = true;
        if (!silent) setLikesLoading(false);
      }
    }
  }, []);

  const refreshActiveTab = useCallback((tab: TabKey) => {
    if (tab === 'matches') load(false, matchesLoadedRef.current);
    else loadLikes(tab, !!likesLoadedRef.current[tab]);
  }, [load, loadLikes]);

  // Refetch whenever a tab is selected — My Matches included, which previously
  // loaded once on mount and then went stale for the rest of the session.
  useEffect(() => {
    refreshActiveTab(activeTab);
  }, [activeTab, refreshActiveTab]);

  // ...and on every focus, so returning from a chat or a profile is up to date.
  // The tab effect already covers mount, so the first focus is skipped to keep
  // the two from firing the same request twice.
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  const didMountRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didMountRef.current) { didMountRef.current = true; return; }
      refreshActiveTab(activeTabRef.current);
    }, [refreshActiveTab]),
  );

  // Entitlement stays the backend's call — the 402/403 in `loadLikes` is what
  // locks this tab. This only reacts to the moment premium is bought, so the
  // locked preview gives way to the real list without a manual refresh.
  const wasPremiumRef = useRef(isPremium);
  useEffect(() => {
    const justSubscribed = isPremium && !wasPremiumRef.current;
    wasPremiumRef.current = isPremium;
    if (!justSubscribed) return;
    likesLoadedRef.current.likes_received = false;
    setLikesLocked(false);
    if (activeTabRef.current === 'likes_received') loadLikes('likes_received');
  }, [isPremium, loadLikes]);

  const openChat = (match: DatingMatch) => {
    navigation.navigate('DatingChatDetail', {
      matchId: match.id,
      matchedUserId: match.otherUserId,
      matchedUserName: `${match.otherFirstName} ${match.otherLastName}`,
    });
  };

  const goPremium = () =>
    navigation.navigate('DatingPremium', { datingType: datingType ?? 'NonSpiritual' });

  // Match rows carry only summary fields; the detail screen fetches the rest
  // from `GET /dating/user/{userId}`, so these params are just the instant paint.
  const openMatchProfile = (match: DatingMatch) => {
    navigation.navigate('DatingProfileDetail', {
      userId: match.otherUserId,
      firstName: match.otherPseudoName || match.otherFirstName,
      lastName: match.otherPseudoName ? '' : match.otherLastName,
      age: match.otherAge,
      displayImageUrl: match.otherDisplayImageUrl,
      profileImageUrl: match.otherProfileImageUrl,
      interests: [],
      images: [],
      iceBreakerQuestions: [],
    });
  };

  // Same for the likes rows — summary fields only, detail screen fills the rest.
  const openLikeProfile = (like: DatingLike) => {
    const userId = likeUserId(like);
    if (!userId) return;
    navigation.navigate('DatingProfileDetail', {
      userId,
      firstName: like.pseudoName || like.firstName || like.otherFirstName || '',
      lastName: like.pseudoName ? '' : (like.lastName ?? like.otherLastName ?? ''),
      age: like.age,
      city: like.city,
      country: like.country,
      displayImageUrl: like.displayImageUrl ?? undefined,
      profileImageUrl: like.profileImageUrl ?? undefined,
      interests: [],
      images: [],
      iceBreakerQuestions: [],
    });
  };

  // ── Tab bodies ────────────────────────────────────────
  const renderMatches = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={accent} size="large" />
        </View>
      );
    }
    return (
      <FlatList
        data={matches}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            accent={accent}
            onOpenProfile={() => openMatchProfile(item)}
            onChat={() => openChat(item)}
            onReport={() => {
              setReportUserId(item.otherUserId);
              setReportName(item.otherFirstName);
            }}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[accent]}
            tintColor={accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/noActiveUser.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>You have No Matches</Text>
            <Text style={styles.emptySub}>
              Keep discovering — when you and someone else like each other,
              they will show up here.
            </Text>
          </View>
        }
      />
    );
  };

  // Likes Received — endpoint exists (gap #7 resolved). Premium-gated: a 402/403
  // from the API means the user isn't subscribed, so show the locked preview.
  const renderLikesReceived = () => {
    if (likesLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={accent} size="large" />
        </View>
      );
    }
    if (likesLocked) {
      return (
        <View style={styles.lockedWrap}>
          <View style={styles.gridRow}>
            {[0, 1].map((i) => (
              <View key={i} style={styles.lockedCard}>
                <Icon name="lock-closed" size={40} color={Colors.white} />
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.premiumBtn, { backgroundColor: accent }]}
            onPress={goPremium}
            activeOpacity={0.85}
          >
            <Text style={styles.premiumBtnText}>Get a Premium Access</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return renderLikeGrid(likesReceived, 'No Likes Received', 'People who like your profile will show up here.');
  };

  // My Likes — endpoint exists (gap #7 resolved)
  const renderMyLikes = () => {
    if (likesLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={accent} size="large" />
        </View>
      );
    }
    return renderLikeGrid(likesSent, 'No Likes Yet', 'Profiles you have liked will show up here.');
  };

  const renderLikeGrid = (data: DatingLike[], emptyTitle: string, emptySub: string) => (
    <FlatList
      data={data}
      keyExtractor={(item, i) => String(likeUserId(item) ?? item.id ?? i)}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.gridContent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const initialsFallback = (
          <View style={[cardStyles.photo, cardStyles.photoFallback]}>
            <Text style={cardStyles.photoInitial}>
              {likeName(item).charAt(0).toUpperCase()}
            </Text>
          </View>
        );
        return (
          <TouchableOpacity
            style={cardStyles.card}
            activeOpacity={0.85}
            onPress={() => openLikeProfile(item)}
          >
            <RemoteImage
              uri={likeImage(item)}
              style={cardStyles.photo}
              resizeMode="cover"
              indicatorColor={accent}
              fallback={initialsFallback}
            />
            <View style={cardStyles.nameBlock}>
              <Text style={cardStyles.name} numberOfLines={1}>
                {likeName(item)}
                {item.age ? `, ${item.age}` : ''}
              </Text>
              {!!(item.city || item.country) && (
                <View style={cardStyles.locationRow}>
                  <Icon name="location-outline" size={12} color={Colors.white} />
                  <Text style={cardStyles.location} numberOfLines={1}>
                    {[item.city, item.country].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Image
            source={require('../../assets/noActiveUser.png')}
            style={styles.emptyImage}
            resizeMode="contain"
          />
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptySub}>{emptySub}</Text>
        </View>
      }
    />
  );

  return (
    <SafeAreaView style={styles.root}>
      <DatingTopBar />

      <Text style={styles.heading}>My Matches</Text>

      {/* Pill tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabPill,
                isActive ? { backgroundColor: accent } : styles.tabPillInactive,
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, !isActive && styles.tabLabelInactive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.body}>
        {activeTab === 'matches' && renderMatches()}
        {activeTab === 'likes_received' && renderLikesReceived()}
        {activeTab === 'my_likes' && renderMyLikes()}
      </View>

      <DatingBottomBar active="DatingMatches" />

      <ReportModal
        visible={reportUserId !== null}
        reportedUserId={reportUserId ?? 0}
        reportedName={reportName}
        module="Dating"
        onClose={() => setReportUserId(null)}
      />

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => setAlert(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },

  tabRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  tabPillInactive: { backgroundColor: '#BDBDBD' },
  tabLabel: { fontSize: 14, fontWeight: '700', color: Colors.white },
  tabLabelInactive: { color: Colors.white },

  body: { flex: 1 },

  gridRow: { justifyContent: 'space-between', paddingHorizontal: 20 },
  gridContent: { paddingBottom: 120 },

  emptyState: { alignItems: 'center', paddingHorizontal: 36, paddingTop: 30 },
  emptyImage: { width: 180, height: 160, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 10, textAlign: 'center' },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },

  lockedWrap: { paddingTop: 4 },
  lockedCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    backgroundColor: '#1F1B24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumBtn: {
    marginHorizontal: 20,
    marginTop: 22,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  premiumBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
