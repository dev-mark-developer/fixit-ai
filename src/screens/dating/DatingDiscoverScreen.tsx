import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { DatingDrawerParamList, DatingStackParamList } from '../../types/navigation';
import { datingApi, DiscoverUser } from '../../api/dating';
import AppAlert from '../../components/common/AppAlert';
import { Colors } from '../../utils/colors';

type Props = CompositeScreenProps<
  DrawerScreenProps<DatingDrawerParamList, 'DatingDiscover'>,
  NativeStackScreenProps<DatingStackParamList>
>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W - 32;
const CARD_H = SCREEN_H * 0.62;
const SWIPE_THRESHOLD = 120;
const ROTATION_FACTOR = 15;

// ──────────────────────────────────────────────────────────────
// Match overlay
// ──────────────────────────────────────────────────────────────
interface MatchOverlayProps {
  visible: boolean;
  matchedUser: DiscoverUser | null;
  matchId: number | null;
  onSayHi: () => void;
  onKeepSwiping: () => void;
}

function MatchOverlay({ visible, matchedUser, matchId, onSayHi, onKeepSwiping }: MatchOverlayProps) {
  if (!visible || !matchedUser) return null;
  const avatarUri =
    matchedUser.displayImageUrl ?? matchedUser.profileImageUrl ?? undefined;

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={matchStyles.overlay}>
        <Text style={matchStyles.title}>It's a Match!</Text>
        <Text style={matchStyles.sub}>
          You and {matchedUser.firstName} liked each other
        </Text>

        <View style={matchStyles.avatarRow}>
          <View style={matchStyles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={matchStyles.avatar} />
            ) : (
              <View style={[matchStyles.avatar, matchStyles.avatarFallback]}>
                <Text style={matchStyles.avatarInitial}>
                  {matchedUser.firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={matchStyles.heartEmoji}>💞</Text>
          <View style={matchStyles.avatarWrap}>
            <View style={[matchStyles.avatar, matchStyles.avatarFallback]}>
              <Text style={matchStyles.avatarInitial}>Me</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={matchStyles.sayHiBtn} onPress={onSayHi} activeOpacity={0.85}>
          <Text style={matchStyles.sayHiText}>Say Hi</Text>
        </TouchableOpacity>

        <TouchableOpacity style={matchStyles.keepSwipingBtn} onPress={onKeepSwiping} activeOpacity={0.75}>
          <Text style={matchStyles.keepSwipingText}>Keep Swiping</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const matchStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(233,64,87,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: { fontSize: 36, fontWeight: '800', color: Colors.white, marginBottom: 8 },
  sub: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 40, textAlign: 'center' },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 48,
    gap: 12,
  },
  avatarWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: Colors.white },
  heartEmoji: { fontSize: 32 },
  sayHiBtn: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  sayHiText: { fontSize: 17, fontWeight: '700', color: Colors.dating },
  keepSwipingBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  keepSwipingText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});

// ──────────────────────────────────────────────────────────────
// Swipeable card
// ──────────────────────────────────────────────────────────────
interface SwipeCardProps {
  user: DiscoverUser;
  index: number;  // 0 = top, 1 = second, 2 = third
  onSwipe: (user: DiscoverUser, direction: 'left' | 'right' | 'super') => void;
  onInfo: (user: DiscoverUser) => void;
}

function SwipeCard({ user, index, onSwipe, onInfo }: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isTop = index === 0;

  const imageUri = user.displayImageUrl ?? user.profileImageUrl ?? undefined;

  const commitSwipe = useCallback(
    (direction: 'left' | 'right' | 'super') => {
      onSwipe(user, direction);
    },
    [onSwipe, user],
  );

  const pan = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const dir = e.translationX > 0 ? 'right' : 'left';
        const exitX = dir === 'right' ? SCREEN_W * 1.5 : -SCREEN_W * 1.5;
        translateX.value = withTiming(exitX, { duration: 250 }, () => {
          runOnJS(commitSwipe)(dir);
        });
      } else if (e.translationY < -SWIPE_THRESHOLD) {
        translateY.value = withTiming(-SCREEN_H, { duration: 250 }, () => {
          runOnJS(commitSwipe)('super');
        });
      } else {
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    if (!isTop) {
      // Back cards: scale and slight translate based on stack position
      const scale = interpolate(index, [0, 1, 2], [1, 0.96, 0.92]);
      const offsetY = interpolate(index, [0, 1, 2], [0, 14, 28]);
      return { transform: [{ scale }, { translateY: offsetY }] };
    }
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_W / 2, 0, SCREEN_W / 2],
      [-ROTATION_FACTOR, 0, ROTATION_FACTOR],
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  // Like / Ignore label opacity
  const likeOpacity = useAnimatedStyle(() => ({
    opacity: isTop ? interpolate(translateX.value, [20, 80], [0, 1], 'clamp') : 0,
  }));
  const ignoreOpacity = useAnimatedStyle(() => ({
    opacity: isTop ? interpolate(translateX.value, [-80, -20], [1, 0], 'clamp') : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, { zIndex: 10 - index }, animatedStyle]}>
        {/* Photo */}
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]}>
            <Text style={styles.cardImageInitial}>
              {user.firstName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Swipe labels */}
        <Animated.View style={[styles.likeLabel, likeOpacity]}>
          <Text style={styles.likeLabelText}>LIKE</Text>
        </Animated.View>
        <Animated.View style={[styles.ignoreLabel, ignoreOpacity]}>
          <Text style={styles.ignoreLabelText}>NOPE</Text>
        </Animated.View>

        {/* Bottom overlay — entire area is tappable to open profile */}
        <TouchableOpacity
          style={styles.cardOverlay}
          onPress={() => onInfo(user)}
          activeOpacity={0.85}
        >
          <View style={styles.cardInfoRow}>
            <Text style={[styles.cardName, { flex: 1 }]}>
              {user.firstName} {user.lastName}
              {user.age ? `, ${user.age}` : ''}
            </Text>
            <Text style={styles.infoBtnText}>ℹ</Text>
          </View>
          {(user.city || user.country) ? (
            <Text style={styles.cardLocation}>
              {[user.city, user.country].filter(Boolean).join(', ')}
            </Text>
          ) : null}
          {user.interests.length > 0 && (
            <View style={styles.cardChips}>
              {user.interests.slice(0, 4).map((interest, i) => (
                <View key={i} style={styles.cardChip}>
                  <Text style={styles.cardChipText}>{interest}</Text>
                </View>
              ))}
              {user.interests.length > 4 && (
                <View style={styles.cardChip}>
                  <Text style={styles.cardChipText}>+{user.interests.length - 4}</Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

// ──────────────────────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────────────────────
export default function DatingDiscoverScreen({ navigation }: Props) {
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  // Match overlay
  const [matchVisible, setMatchVisible] = useState(false);
  const [matchedUser, setMatchedUser] = useState<DiscoverUser | null>(null);
  const [matchId, setMatchId] = useState<number | null>(null);

  // Prevent duplicate swipe calls
  const swipingRef = useRef(false);

  useEffect(() => {
    datingApi
      .discover({ page: 1, pageSize: 10 })
      .then((res) => {
        const data: DiscoverUser[] = res.data?.data ?? [];
        setUsers(data);
      })
      .catch(() => {
        setAlert({ title: 'Error', message: 'Could not load profiles. Please try again.' });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSwipe = useCallback(
    (user: DiscoverUser, direction: 'left' | 'right' | 'super') => {
      if (swipingRef.current) return;
      swipingRef.current = true;

      // Advance card stack immediately — don't block on API
      setCurrentIndex((prev) => prev + 1);
      swipingRef.current = false;

      const action =
        direction === 'right' ? 'Like' : direction === 'super' ? 'SuperLike' : 'Ignore';

      // Fire API in background; show match overlay when response arrives
      datingApi.swipe(user.userId, action)
        .then((res) => {
          const result = res.data?.data as { isMatch: boolean; matchId?: number } | undefined;
          if (result?.isMatch) {
            setMatchedUser(user);
            setMatchId(result.matchId ?? null);
            setMatchVisible(true);
          }
        })
        .catch(() => {});
    },
    [],
  );

  const handleInfo = useCallback(
    (user: DiscoverUser) => {
      navigation.navigate('DatingProfileDetail', {
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        age: user.age,
        city: user.city,
        country: user.country,
        about: user.about,
        displayImageUrl: user.displayImageUrl,
        profileImageUrl: user.profileImageUrl,
        interests: user.interests,
        images: user.images,
        iceBreakerQuestions: user.iceBreakerQuestions,
      });
    },
    [navigation],
  );

  const handleActionButton = useCallback(
    (action: 'Like' | 'SuperLike' | 'Ignore') => {
      if (currentIndex >= users.length) return;
      const dir =
        action === 'Like' ? 'right' : action === 'Ignore' ? 'left' : 'super';
      handleSwipe(users[currentIndex], dir);
    },
    [currentIndex, handleSwipe, users],
  );

  const visibleUsers = users.slice(currentIndex, currentIndex + 3);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.dating} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.root}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBarBtn}
            onPress={() => navigation.openDrawer()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.topBarIcon}>{'☰'}</Text>
          </TouchableOpacity>

          <Text style={styles.topBarTitle}>Discover</Text>

          <View style={styles.topBarBtn} />
        </View>

        {/* Card stack */}
        <View style={styles.cardStack}>
          {visibleUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌅</Text>
              <Text style={styles.emptyTitle}>Come back tomorrow</Text>
              <Text style={styles.emptySub}>for more matches</Text>
            </View>
          ) : (
            // Render from back to front so front card receives touches
            [...visibleUsers].reverse().map((user, reversedIdx) => {
              const index = visibleUsers.length - 1 - reversedIdx;
              return (
                <SwipeCard
                  key={user.userId}
                  user={user}
                  index={index}
                  onSwipe={handleSwipe}
                  onInfo={handleInfo}
                />
              );
            })
          )}
        </View>

        {/* Action buttons */}
        {visibleUsers.length > 0 && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionIgnore]}
              onPress={() => handleActionButton('Ignore')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIgnoreIcon}>✕</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSuperLike]}
              onPress={() => handleActionButton('SuperLike')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionSuperLikeIcon}>★</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionLike]}
              onPress={() => handleActionButton('Like')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionLikeIcon}>♥</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Match modal */}
        <MatchOverlay
          visible={matchVisible}
          matchedUser={matchedUser}
          matchId={matchId}
          onSayHi={() => {
            setMatchVisible(false);
            if (matchedUser && matchId) {
              navigation.navigate('DatingChatDetail', {
                matchId: matchId,
                matchedUserId: matchedUser.userId,
                matchedUserName: `${matchedUser.firstName} ${matchedUser.lastName}`,
              });
            }
          }}
          onKeepSwiping={() => setMatchVisible(false)}
        />

        <AppAlert
          visible={!!alert}
          title={alert?.title ?? ''}
          message={alert?.message}
          onClose={() => setAlert(null)}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarIcon: { fontSize: 20 },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

  // Card stack
  cardStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  cardImageFallback: {
    backgroundColor: Colors.datingLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImageInitial: {
    fontSize: 80,
    fontWeight: '700',
    color: Colors.dating,
    opacity: 0.6,
  },

  // Swipe labels
  likeLabel: {
    position: 'absolute',
    top: 40,
    left: 20,
    borderWidth: 3,
    borderColor: Colors.success,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: '-15deg' }],
  },
  likeLabelText: { fontSize: 24, fontWeight: '800', color: Colors.success },
  ignoreLabel: {
    position: 'absolute',
    top: 40,
    right: 20,
    borderWidth: 3,
    borderColor: Colors.error,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: '15deg' }],
  },
  ignoreLabelText: { fontSize: 24, fontWeight: '800', color: Colors.error },

  // Card bottom overlay
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 48,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
  },
  cardLocation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 10,
  },
  infoBtnText: { fontSize: 18, color: Colors.white },

  cardChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardChipText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '500',
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 20,
    paddingBottom: 28,
  },
  actionBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  actionIgnore: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.error,
  },
  actionIgnoreIcon: { fontSize: 22, color: Colors.error, fontWeight: '700' },
  actionSuperLike: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: '#F5A623',
  },
  actionSuperLikeIcon: { fontSize: 22, color: '#F5A623' },
  actionLike: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.dating,
  },
  actionLikeIcon: { fontSize: 24, color: Colors.dating },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
});
