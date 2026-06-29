import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { datingApi } from '../../api/dating';
import ReportModal from '../../components/common/ReportModal';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingProfileDetail'>;

const { width: SCREEN_W } = Dimensions.get('window');

export default function DatingProfileDetailScreen({ route, navigation }: Props) {
  const {
    userId, firstName, lastName, age, city, country, about,
    displayImageUrl, profileImageUrl, interests, images, iceBreakerQuestions,
  } = route.params;

  const [swiping, setSwiping] = useState<'Like' | 'SuperLike' | 'Ignore' | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);

  // Build image list: displayImage first, then extras, then profileImage fallback
  const allImages: string[] = [];
  if (displayImageUrl) allImages.push(displayImageUrl);
  images.forEach((img) => { if (img !== displayImageUrl) allImages.push(img); });
  if (allImages.length === 0 && profileImageUrl) allImages.push(profileImageUrl);

  const handleAction = async (action: 'Like' | 'SuperLike' | 'Ignore') => {
    if (swiping) return;
    setSwiping(action);
    try {
      const res = await datingApi.swipe(userId, action);
      const result = res.data?.data as { isMatch: boolean; matchId?: number } | undefined;
      if (result?.isMatch) {
        Alert.alert(
          "It's a Match! 💞",
          `You and ${firstName} liked each other!`,
          [{ text: 'Say Hi', onPress: () => navigation.goBack() }, { text: 'Keep Swiping', onPress: () => navigation.goBack() }],
        );
      } else {
        navigation.goBack();
      }
    } catch {
      navigation.goBack();
    } finally {
      setSwiping(null);
    }
  };

  const fullName = `${firstName} ${lastName}${age ? `, ${age}` : ''}`;
  const location = [city, country].filter(Boolean).join(', ');

  return (
    <View style={styles.root}>
      <ReportModal
        visible={reportVisible}
        reportedUserId={userId}
        module="Dating"
        onClose={() => setReportVisible(false)}
      />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Image gallery */}
        <View style={styles.galleryWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              setImgIndex(idx);
            }}
          >
            {allImages.length > 0 ? allImages.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
            )) : (
              <View style={[styles.galleryImage, styles.galleryFallback]}>
                <Text style={styles.galleryInitial}>{firstName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </ScrollView>

          {/* Dots */}
          {allImages.length > 1 && (
            <View style={styles.dots}>
              {allImages.map((_, i) => (
                <View key={i} style={[styles.dot, i === imgIndex && styles.dotActive]} />
              ))}
            </View>
          )}

          {/* Report button */}
          <TouchableOpacity style={styles.reportBtn} onPress={() => setReportVisible(true)}>
            <Text style={styles.reportBtnText}>🚩</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Name & location */}
          <Text style={styles.name}>{fullName}</Text>
          {!!location && <Text style={styles.location}>📍 {location}</Text>}

          {/* About */}
          {!!about && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.aboutText}>{about}</Text>
            </View>
          )}

          {/* Interests */}
          {interests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.chips}>
                {interests.map((interest, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Ice breakers */}
          {iceBreakerQuestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ice Breakers</Text>
              {iceBreakerQuestions.map((q, i) => (
                <View key={i} style={styles.iceCard}>
                  <Text style={styles.iceText}>{q}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionIgnore]}
          onPress={() => handleAction('Ignore')}
          disabled={!!swiping}
          activeOpacity={0.8}
        >
          {swiping === 'Ignore'
            ? <ActivityIndicator color={Colors.error} size="small" />
            : <Text style={styles.actionIgnoreIcon}>✕</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionSuperLike]}
          onPress={() => handleAction('SuperLike')}
          disabled={!!swiping}
          activeOpacity={0.8}
        >
          {swiping === 'SuperLike'
            ? <ActivityIndicator color="#F5A623" size="small" />
            : <Text style={styles.actionSuperLikeIcon}>★</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionLike]}
          onPress={() => handleAction('Like')}
          disabled={!!swiping}
          activeOpacity={0.8}
        >
          {swiping === 'Like'
            ? <ActivityIndicator color={Colors.dating} size="small" />
            : <Text style={styles.actionLikeIcon}>♥</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  galleryWrap: { width: SCREEN_W, height: SCREEN_W * 1.15 },
  galleryImage: { width: SCREEN_W, height: SCREEN_W * 1.15 },
  galleryFallback: {
    backgroundColor: Colors.datingLight, justifyContent: 'center', alignItems: 'center',
  },
  galleryInitial: { fontSize: 80, fontWeight: '700', color: Colors.dating, opacity: 0.6 },

  dots: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    flexDirection: 'row', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: Colors.white, width: 18 },

  reportBtn: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
  },
  reportBtnText: { fontSize: 16 },

  body: { paddingHorizontal: 20, paddingTop: 16 },

  name: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  location: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  aboutText: { fontSize: 15, color: Colors.text, lineHeight: 22 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.datingLight, borderWidth: 1.5, borderColor: Colors.dating,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.dating },

  iceCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  iceText: { fontSize: 14, color: Colors.text, lineHeight: 20 },

  actions: {
    position: 'absolute', bottom: 24, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20,
  },
  actionBtn: { justifyContent: 'center', alignItems: 'center', elevation: 4 },
  actionIgnore: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.error,
  },
  actionIgnoreIcon: { fontSize: 22, color: Colors.error, fontWeight: '700' },
  actionSuperLike: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.white, borderWidth: 2, borderColor: '#F5A623',
  },
  actionSuperLikeIcon: { fontSize: 22, color: '#F5A623' },
  actionLike: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.dating,
  },
  actionLikeIcon: { fontSize: 24, color: Colors.dating },
});
