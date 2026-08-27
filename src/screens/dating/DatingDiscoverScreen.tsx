import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
import Icon from 'react-native-vector-icons/Ionicons';
import type { DatingDrawerParamList, DatingStackParamList } from '../../types/navigation';
import { datingApi, DiscoverUser, InterestCategory } from '../../api/dating';
import AppAlert from '../../components/common/AppAlert';
import CountryPicker from '../../components/common/CountryPicker';
import DatingTopBar from '../../components/dating/DatingTopBar';
import DatingBottomBar from '../../components/dating/DatingBottomBar';
import { Colors } from '../../utils/colors';
import { usePrefetchImages } from '../../utils/imageCache';
import RemoteImage from '../../components/common/RemoteImage';
import { useModuleStatus } from '../../store/ModuleStatusContext';

type Props = CompositeScreenProps<
  DrawerScreenProps<DatingDrawerParamList, 'DatingDiscover'>,
  NativeStackScreenProps<DatingStackParamList>
>;

// Age filter is a single-thumb slider: the range is AGE_MIN → thumb value
const AGE_MIN = 18;
const AGE_MAX = 80;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W - 32;
const CARD_H = SCREEN_H * 0.56;
const SWIPE_THRESHOLD = 120;
const ROTATION_FACTOR = 15;

// ──────────────────────────────────────────────────────────────
// Match overlay — "Congratulations! It's a Match" (Figma)
// ──────────────────────────────────────────────────────────────
interface MatchOverlayProps {
  visible: boolean;
  matchedUser: DiscoverUser | null;
  accent: string;
  onSayHi: () => void;
  onKeepSwiping: () => void;
}

function MatchOverlay({ visible, matchedUser, accent, onSayHi, onKeepSwiping }: MatchOverlayProps) {
  if (!visible || !matchedUser) return null;
  const avatarUri = matchedUser.displayImageUrl ?? matchedUser.profileImageUrl;

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={matchStyles.overlay}>
        {/* Tilted photo cards with heart badges */}
        <View style={matchStyles.photoStage}>
          <View style={[matchStyles.photoCard, matchStyles.photoCardRight]}>
            <View style={[matchStyles.photoFallback, { backgroundColor: `${accent}22` }]}>
              <Text style={[matchStyles.photoInitial, { color: accent }]}>Me</Text>
            </View>
          </View>
          <View style={[matchStyles.photoCard, matchStyles.photoCardLeft]}>
            {avatarUri ? (
              <RemoteImage uri={avatarUri} style={matchStyles.photo} indicatorColor={accent} />
            ) : (
              <View style={[matchStyles.photoFallback, { backgroundColor: `${accent}22` }]}>
                <Text style={[matchStyles.photoInitial, { color: accent }]}>
                  {matchedUser.firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Image
              source={require('../../assets/circularHeart.png')}
              style={[matchStyles.heartBadge, matchStyles.heartBadgeBL]}
              resizeMode="contain"
            />
          </View>
          <Image
            source={require('../../assets/circularHeart.png')}
            style={[matchStyles.heartBadge, matchStyles.heartBadgeTR]}
            resizeMode="contain"
          />
        </View>

        <Text style={[matchStyles.congrats, { color: accent }]}>Congratulations!</Text>
        <Text style={matchStyles.title}>It's a Match</Text>
        <Text style={matchStyles.sub}>
          You and {matchedUser.firstName} liked each other. Start the conversation now.
        </Text>

        <TouchableOpacity
          style={[matchStyles.sayHiBtn, { backgroundColor: accent }]}
          onPress={onSayHi}
          activeOpacity={0.85}
        >
          <Text style={matchStyles.sayHiText}>Say Hello</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[matchStyles.keepSwipingBtn, { borderColor: accent }]}
          onPress={onKeepSwiping}
          activeOpacity={0.75}
        >
          <Text style={[matchStyles.keepSwipingText, { color: accent }]}>Keep Swiping</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const matchStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  photoStage: { width: 260, height: 280, marginBottom: 28 },
  photoCard: {
    position: 'absolute',
    width: 150,
    height: 190,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  photoCardLeft: { left: 0, bottom: 0, transform: [{ rotate: '-8deg' }] },
  photoCardRight: { right: 0, top: 0, transform: [{ rotate: '8deg' }] },
  photo: { width: '100%', height: '100%' },
  photoFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoInitial: { fontSize: 40, fontWeight: '800' },
  heartBadge: {
    width: 62,
    height: 62,
  },
  heartBadgeTR: { position: 'absolute', top: -14, right: 26 },
  heartBadgeBL: { position: 'absolute', bottom: 6, left: -18 },

  congrats: { fontSize: 30, fontWeight: '800', fontStyle: 'italic', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  sub: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: 32,
  },
  sayHiBtn: {
    width: '100%', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12,
  },
  sayHiText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  keepSwipingBtn: {
    width: '100%', borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  keepSwipingText: { fontSize: 15, fontWeight: '600' },
});

// ──────────────────────────────────────────────────────────────
// Simple track slider (no external lib) for the filter sheet
// ──────────────────────────────────────────────────────────────
interface TrackSliderProps {
  min: number;
  max: number;
  value: number;
  accent: string;
  labelLeft: string;
  labelValue: string;
  onChange: (v: number) => void;
}

function TrackSlider({ min, max, value, accent, labelLeft, labelValue, onChange }: TrackSliderProps) {
  const [trackW, setTrackW] = useState(0);
  const ratio = (value - min) / (max - min);

  const setFromX = (x: number) => {
    if (trackW <= 0) return;
    const r = Math.min(1, Math.max(0, x / trackW));
    onChange(Math.round(min + r * (max - min)));
  };

  const pan = Gesture.Pan()
    .onBegin((e) => { 'worklet'; runOnJS(setFromX)(e.x); })
    .onUpdate((e) => { 'worklet'; runOnJS(setFromX)(e.x); });

  return (
    <View style={sliderStyles.wrap}>
      <GestureDetector gesture={pan}>
        <View
          style={sliderStyles.touchArea}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        >
          <View style={sliderStyles.track} />
          <View style={[sliderStyles.fill, { width: `${ratio * 100}%`, backgroundColor: accent }]} />
          <View style={[sliderStyles.thumb, { left: Math.max(0, ratio * trackW - 14), backgroundColor: accent }]} />
        </View>
      </GestureDetector>
      <View style={sliderStyles.labels}>
        <Text style={sliderStyles.labelMin}>{labelLeft}</Text>
        <Text style={[sliderStyles.labelVal, { color: accent, left: `${ratio * 100}%` }]}>
          {labelValue}
        </Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  touchArea: { height: 32, justifyContent: 'center' },
  track: {
    height: 5, borderRadius: 3, backgroundColor: Colors.border,
  },
  fill: {
    position: 'absolute', height: 5, borderRadius: 3, left: 0,
  },
  thumb: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 5, borderColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  labels: { height: 20, position: 'relative' },
  labelMin: { position: 'absolute', left: 0, fontSize: 13, color: Colors.text },
  labelVal: { position: 'absolute', fontSize: 13, fontWeight: '600', marginLeft: -12 },
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

  const imageUri = user.displayImageUrl ?? user.profileImageUrl;

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
          <RemoteImage
            uri={imageUri}
            style={styles.cardImage}
            resizeMode="cover"
            indicatorSize="large"
          />
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

        {/* Name + location overlay — tap to open the full profile */}
        <TouchableOpacity
          style={styles.cardOverlay}
          onPress={() => onInfo(user)}
          activeOpacity={0.85}
        >
          <Text style={styles.cardName}>
            {user.firstName}
            {user.age ? `, ${user.age}` : ''}
          </Text>
          {(user.city || user.country) ? (
            <View style={styles.cardLocationRow}>
              <Icon name="location-outline" size={14} color={Colors.white} />
              <Text style={styles.cardLocation}>
                {[user.city, user.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

// ──────────────────────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────────────────────
export default function DatingDiscoverScreen({ navigation }: Props) {
  const { datingType } = useModuleStatus();
  const isSpiritual = datingType === 'Spiritual';
  const accent = isSpiritual ? Colors.spiritual : Colors.dating;
  const lime = isSpiritual ? Colors.spiritualLime : Colors.datingSecondary;
  const limeLight = isSpiritual ? Colors.spiritualLimeLight : Colors.datingLight;

  const [users, setUsers] = useState<DiscoverUser[]>([]);
  usePrefetchImages(users.map(u => u.displayImageUrl ?? u.profileImageUrl));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  // Match overlay
  const [matchVisible, setMatchVisible] = useState(false);
  const [matchedUser, setMatchedUser] = useState<DiscoverUser | null>(null);
  const [matchId, setMatchId] = useState<number | null>(null);

  // Filter sheet — server-side since the discover API gained filter params
  // (gap #6 resolved)
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterCountry, setFilterCountry] = useState('');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [filterDistance, setFilterDistance] = useState(30);
  const [filterAge, setFilterAge] = useState(26);
  const [filterGender, setFilterGender] = useState<'Male' | 'Female' | null>(null);

  // Advance Filters (interests) — unlocked while the subscription/IAP work is
  // on hold; discover already accepts InterestIds (gap #6).
  const [advanceVisible, setAdvanceVisible] = useState(false);
  const [interestCategories, setInterestCategories] = useState<InterestCategory[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<Set<number>>(new Set());

  const toggleInterest = useCallback((id: number) => {
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Load interest categories the first time Advance Filters is opened
  useEffect(() => {
    if (!advanceVisible || interestCategories.length > 0) return;
    datingApi
      .getInterests(datingType ?? undefined)
      .then((res) => {
        const cats: InterestCategory[] = res.data?.data ?? [];
        setInterestCategories(cats);
        setExpandedCategory(cats[0]?.id ?? null);
      })
      .catch(() => {});
  }, [advanceVisible, interestCategories.length, datingType]);

  // Prevent duplicate swipe calls
  const swipingRef = useRef(false);

  // Whether the current deck came from a filtered query — a refresh on focus
  // has to preserve the user's filters instead of silently resetting them.
  const filtersAppliedRef = useRef(false);
  // Only the newest request may write state; refocusing mid-flight would
  // otherwise let a stale response land on top of a fresh one.
  const requestIdRef = useRef(0);

  // Flips after the first load settles: from then on a refresh has something on
  // screen to leave in place, so it can run without the blocking spinner.
  const hasLoadedRef = useRef(false);

  const loadUsers = useCallback(async (withFilters: boolean, silent = false) => {
    const requestId = ++requestIdRef.current;
    filtersAppliedRef.current = withFilters;
    if (!silent) setLoading(true);
    try {
      const res = await datingApi.discover({
        page: 1,
        pageSize: 10,
        ...(withFilters
          ? {
              country: filterCountry || undefined,
              interestedInGender: filterGender ?? undefined,
              minAge: AGE_MIN,
              maxAge: filterAge,
              distanceKm: filterDistance,
              interestIds: selectedInterests.size
                ? Array.from(selectedInterests)
                : undefined,
            }
          : {}),
      });
      if (requestId !== requestIdRef.current) return;
      setUsers(res.data?.data ?? []);
      setCurrentIndex(0);
    } catch {
      if (requestId !== requestIdRef.current) return;
      // A silent refresh keeps whatever deck is already on screen — interrupting
      // a working screen with an alert the user never asked for is worse noise.
      if (!silent) {
        setAlert({ title: 'Error', message: 'Could not load profiles. Please try again.' });
      }
    } finally {
      if (requestId === requestIdRef.current) {
        hasLoadedRef.current = true;
        if (!silent) setLoading(false);
      }
    }
  }, [filterCountry, filterGender, filterAge, filterDistance, selectedInterests]);

  // `loadUsers` is a new function on every filter change, so the focus effect
  // reads it through a ref — depending on it directly would refetch mid-drag
  // while the filter sheet is still open.
  const loadUsersRef = useRef(loadUsers);
  useEffect(() => { loadUsersRef.current = loadUsers; }, [loadUsers]);

  // Refresh on every focus so returning from a profile, a chat or the drawer
  // shows a fresh deck. Only the first load blocks with a spinner; later ones
  // swap the deck in underneath the user.
  useFocusEffect(
    useCallback(() => {
      loadUsersRef.current(filtersAppliedRef.current, hasLoadedRef.current);
    }, []),
  );

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
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.root}>
        <DatingTopBar />

        {/* Heading + filter */}
        <View style={styles.headingRow}>
          <Text style={styles.heading}>
            Discover & Find{' '}
            <Text style={[styles.headingAccent, { color: accent }]}>
              Your Perfect Match
            </Text>
          </Text>
          <TouchableOpacity onPress={() => setFilterVisible(true)} hitSlop={8}>
            <Icon name="options-outline" size={26} color={lime} />
          </TouchableOpacity>
        </View>

        {/* Card stack */}
        <View style={styles.cardStack}>
          {visibleUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Image
                source={require('../../assets/spiritual.png')}
                style={styles.emptyImage}
                resizeMode="contain"
              />
              <Text style={[styles.emptyScript, { color: lime }]}>That's all for today!</Text>
              <Text style={styles.emptyTitle}>
                Check Back Later For More{' '}
                <Text style={{ color: accent }}>Matches.</Text>
              </Text>
              <Text style={styles.emptySub}>
                New members join every day. Adjust your filters or come back soon
                to meet more people.
              </Text>
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

          {/* Action pill overlapping the card bottom (Figma) */}
          {visibleUsers.length > 0 && (
            <View style={styles.actionPill}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionGhost]}
                onPress={() => handleActionButton('Ignore')}
                activeOpacity={0.8}
              >
                <Icon name="close" size={26} color={lime} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: limeLight }]}
                onPress={() => handleActionButton('SuperLike')}
                activeOpacity={0.8}
              >
                <Icon name="star" size={24} color={lime} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: accent }]}
                onPress={() => handleActionButton('Like')}
                activeOpacity={0.8}
              >
                <Icon name="heart" size={26} color={isSpiritual ? Colors.spiritualLime : Colors.white} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <DatingBottomBar active="DatingDiscover" />

        {/* Filter bottom sheet */}
        <Modal
          visible={filterVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setFilterVisible(false)}
        >
          <View style={styles.sheetOverlay}>
            <TouchableOpacity
              style={styles.sheetDismiss}
              activeOpacity={1}
              onPress={() => setFilterVisible(false)}
            />
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />

              {advanceVisible ? (
                /* ── Advance Filters (Figma pg 29) ───────────────── */
                <ScrollView showsVerticalScrollIndicator={false}>
                  <TouchableOpacity
                    onPress={() => setAdvanceVisible(false)}
                    hitSlop={8}
                    style={styles.advanceBack}
                  >
                    <Icon name="arrow-back" size={22} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.sheetTitle}>Advance Filters</Text>
                  <Text style={styles.fieldLabel}>Choose Interests</Text>

                  {interestCategories.length === 0 ? (
                    <ActivityIndicator color={accent} style={styles.advanceLoader} />
                  ) : (
                    interestCategories.map((cat) => {
                      const open = expandedCategory === cat.id;
                      return (
                        <View key={cat.id}>
                          <TouchableOpacity
                            style={styles.categoryRow}
                            onPress={() => setExpandedCategory(open ? null : cat.id)}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.categoryName, { color: accent }]}>
                              {cat.name}
                            </Text>
                            <Icon
                              name={open ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color={accent}
                            />
                          </TouchableOpacity>
                          {open && (
                            <View style={styles.interestChips}>
                              {cat.interests.map((interest) => {
                                const selected = selectedInterests.has(interest.id);
                                return (
                                  <TouchableOpacity
                                    key={interest.id}
                                    style={[
                                      styles.interestChip,
                                      selected && { backgroundColor: lime, borderColor: lime },
                                    ]}
                                    onPress={() => toggleInterest(interest.id)}
                                    activeOpacity={0.75}
                                  >
                                    <Text
                                      style={[
                                        styles.interestChipText,
                                        { color: selected ? Colors.text : accent },
                                      ]}
                                    >
                                      {interest.name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}

                  <TouchableOpacity
                    style={[styles.applyBtn, { backgroundColor: accent }]}
                    onPress={() => {
                      setAdvanceVisible(false);
                      setFilterVisible(false);
                      loadUsers(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.applyBtnText}>Apply</Text>
                  </TouchableOpacity>
                </ScrollView>
              ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.sheetTitle}>Filter</Text>

                {/* Country */}
                <Text style={styles.fieldLabel}>Country</Text>
                <TouchableOpacity
                  style={styles.selectBox}
                  onPress={() => setCountryPickerVisible(true)}
                >
                  <Text style={filterCountry ? styles.selectText : styles.selectPlaceholder}>
                    {filterCountry || 'Select country'}
                  </Text>
                  <Icon name="chevron-down" size={18} color={Colors.textMuted} />
                </TouchableOpacity>

                {/* Distance */}
                <Text style={styles.fieldLabel}>Distance</Text>
                <TrackSlider
                  min={0}
                  max={100}
                  value={filterDistance}
                  accent={accent}
                  labelLeft="0 km"
                  labelValue={`${filterDistance} km`}
                  onChange={setFilterDistance}
                />

                {/* Age */}
                <Text style={styles.fieldLabel}>Age</Text>
                <TrackSlider
                  min={AGE_MIN}
                  max={AGE_MAX}
                  value={filterAge}
                  accent={accent}
                  labelLeft={`${AGE_MIN}`}
                  labelValue={`${filterAge}`}
                  onChange={setFilterAge}
                />

                {/* Interested In */}
                <Text style={styles.fieldLabel}>Interested In</Text>
                <View style={styles.genderRow}>
                  {(['Male', 'Female'] as const).map((g) => {
                    const selected = filterGender === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.genderPill,
                          selected ? { backgroundColor: accent } : styles.genderPillInactive,
                        ]}
                        onPress={() => setFilterGender(g)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.genderPillText}>{g}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Advance Filters — unlocked while subscription/IAP is on hold */}
                <TouchableOpacity
                  style={[styles.advanceBtn, { backgroundColor: lime, borderColor: lime }]}
                  onPress={() => setAdvanceVisible(true)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={require('../../assets/crownSmall.png')}
                    style={styles.advanceCrown}
                    resizeMode="contain"
                  />
                  <Text style={[styles.advanceBtnText, styles.advanceBtnTextActive]}>
                    Advance Filters
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.applyBtn, { backgroundColor: accent }]}
                  onPress={() => {
                    setFilterVisible(false);
                    loadUsers(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>
              </ScrollView>
              )}
            </View>
          </View>

          <CountryPicker
            visible={countryPickerVisible}
            selected={filterCountry}
            onSelect={(c) => setFilterCountry(c)}
            onClose={() => setCountryPickerVisible(false)}
          />
        </Modal>

        {/* Match modal */}
        <MatchOverlay
          visible={matchVisible}
          matchedUser={matchedUser}
          accent={accent}
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

  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 12,
  },
  heading: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 29,
  },
  headingAccent: { fontWeight: '800' },

  // Card stack
  cardStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 12,
  },
  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: 28,
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
    backgroundColor: Colors.spiritualLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImageInitial: {
    fontSize: 80,
    fontWeight: '700',
    color: Colors.spiritual,
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

  // Card bottom overlay — name + location (Figma)
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 60,
    paddingTop: 40,
  },
  cardName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cardLocation: {
    fontSize: 13,
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  // Action pill
  actionPill: {
    position: 'absolute',
    top: CARD_H - 36,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 9,
  },
  actionBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionGhost: { backgroundColor: Colors.white },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 12,
  },
  emptyImage: { width: 260, height: 240, marginBottom: 8 },
  emptyScript: { fontSize: 24, fontWeight: '800', fontStyle: 'italic', marginBottom: 6 },
  emptyTitle: {
    fontSize: 22, fontWeight: '800', color: Colors.text,
    textAlign: 'center', lineHeight: 30, marginBottom: 10,
  },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },

  // Filter sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
    maxHeight: '78%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 84,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginBottom: 18,
  },
  sheetTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 18 },

  fieldLabel: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 8 },
  selectBox: {
    height: 52, borderRadius: 12, backgroundColor: Colors.surface, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  selectText: { fontSize: 15, color: Colors.text, flex: 1 },
  selectPlaceholder: { fontSize: 15, color: Colors.textMuted, flex: 1 },

  genderRow: { flexDirection: 'row', gap: 12, marginBottom: 16, marginTop: 2 },
  genderPill: {
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 28,
  },
  genderPillInactive: { backgroundColor: '#BDBDBD' },
  genderPillText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  advanceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14,
    paddingVertical: 15, marginBottom: 12,
  },
  advanceCrown: { width: 20, height: 20 },
  advanceBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
  advanceBtnTextActive: { color: Colors.text, fontWeight: '700' },

  // Advance Filters (interests)
  advanceBack: { alignSelf: 'flex-start', paddingBottom: 8 },
  advanceLoader: { marginVertical: 32 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  categoryName: { fontSize: 15, fontWeight: '600' },
  interestChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 12,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  interestChipText: { fontSize: 14, fontWeight: '500' },
  applyBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  applyBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
