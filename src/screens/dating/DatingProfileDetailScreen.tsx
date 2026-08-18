import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import type { DatingStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import RemoteImage from '../../components/common/RemoteImage';
import { datingApi } from '../../api/dating';
import ReportModal from '../../components/common/ReportModal';
import { useModuleStatus } from '../../store/ModuleStatusContext';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingProfileDetail'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HEADER_H = SCREEN_H * 0.48;
const GRID_GAP = 10;
const TILE_W = (SCREEN_W - 40 - GRID_GAP * 2) / 3;

export default function DatingProfileDetailScreen({ route, navigation }: Props) {
  const {
    userId, firstName, lastName, age, city, country, about,
    displayImageUrl, profileImageUrl, interests, images, iceBreakerQuestions,
  } = route.params;

  const { datingType } = useModuleStatus();
  const isSpiritual = datingType === 'Spiritual';
  const accent = isSpiritual ? Colors.spiritual : Colors.dating;
  const lime = isSpiritual ? Colors.spiritualLime : Colors.datingSecondary;
  const limeLight = isSpiritual ? Colors.spiritualLimeLight : Colors.datingLight;

  const [swiping, setSwiping] = useState<'Like' | 'SuperLike' | 'Ignore' | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [flagMenuVisible, setFlagMenuVisible] = useState(false);

  const headerUri = displayImageUrl ?? profileImageUrl ?? images[0];
  const galleryImages = images.filter((img) => img !== headerUri);

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

  const handleBlock = () => {
    setFlagMenuVisible(false);
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${firstName}? They will no longer be able to see or contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block', style: 'destructive',
          onPress: async () => {
            try {
              await datingApi.block(userId);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Could not block this user. Please try again.');
            }
          },
        },
      ],
    );
  };

  const location = [city, country].filter(Boolean).join(', ');

  return (
    <View style={styles.root}>
      <ReportModal
        visible={reportVisible}
        reportedUserId={userId}
        reportedName={firstName}
        module="Dating"
        onClose={() => setReportVisible(false)}
      />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Full-bleed photo header */}
        <View style={styles.headerWrap}>
          {headerUri ? (
            <RemoteImage
              uri={headerUri}
              style={styles.headerImage}
              resizeMode="cover"
              indicatorSize="large"
              indicatorColor={accent}
            />
          ) : (
            <View style={[styles.headerImage, { backgroundColor: limeLight, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={[styles.headerInitial, { color: accent }]}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Back + flag */}
          <TouchableOpacity
            style={[styles.overlayBtn, styles.backBtn]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <Icon name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.overlayBtn, styles.flagBtn]}
            onPress={() => setFlagMenuVisible((v) => !v)}
            hitSlop={8}
          >
            <Icon name="flag" size={20} color={Colors.white} />
          </TouchableOpacity>

          {/* Block / Report popup (Figma) */}
          {flagMenuVisible && (
            <View style={styles.flagMenu}>
              <TouchableOpacity style={styles.flagMenuItem} onPress={handleBlock}>
                <Icon name="trash" size={16} color={Colors.error} />
                <Text style={styles.flagMenuText}>Block</Text>
              </TouchableOpacity>
              <View style={styles.flagMenuDivider} />
              <TouchableOpacity
                style={styles.flagMenuItem}
                onPress={() => { setFlagMenuVisible(false); setReportVisible(true); }}
              >
                <Icon name="flag" size={16} color={Colors.error} />
                <Text style={styles.flagMenuText}>Report</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Name + location */}
          <View style={styles.nameBlock}>
            <Text style={styles.name}>
              {firstName}{age ? `, ${age}` : ''}
            </Text>
            {!!location && (
              <View style={styles.locationRow}>
                <Icon name="location-outline" size={14} color={Colors.white} />
                <Text style={styles.location}>{location}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.body}>
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
              <Text style={styles.sectionTitle}>Interest</Text>
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
                <View key={i} style={[styles.iceCard, { backgroundColor: limeLight }]}>
                  <Text style={styles.iceText}>{q}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Gallery */}
          {galleryImages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gallery</Text>
              <View style={styles.galleryGrid}>
                {galleryImages.map((uri, i) => (
                  <RemoteImage key={i} uri={uri} style={styles.galleryTile} />
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 110 }} />
        </View>
      </ScrollView>

      {/* Action pill */}
      <View style={styles.actionPill}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: Colors.white }]}
          onPress={() => handleAction('Ignore')}
          disabled={!!swiping}
          activeOpacity={0.8}
        >
          {swiping === 'Ignore'
            ? <ActivityIndicator color={lime} size="small" />
            : <Icon name="close" size={26} color={lime} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: limeLight }]}
          onPress={() => handleAction('SuperLike')}
          disabled={!!swiping}
          activeOpacity={0.8}
        >
          {swiping === 'SuperLike'
            ? <ActivityIndicator color={lime} size="small" />
            : <Icon name="star" size={24} color={lime} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: accent }]}
          onPress={() => handleAction('Like')}
          disabled={!!swiping}
          activeOpacity={0.8}
        >
          {swiping === 'Like'
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Icon name="heart" size={26} color={isSpiritual ? Colors.spiritualLime : Colors.white} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  headerWrap: { width: SCREEN_W, height: HEADER_H },
  headerImage: {
    width: '100%', height: '100%',
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
  },
  headerInitial: { fontSize: 80, fontWeight: '700', opacity: 0.6 },

  overlayBtn: { position: 'absolute', top: 54 },
  backBtn: { left: 20 },
  flagBtn: { right: 20 },

  flagMenu: {
    position: 'absolute', top: 88, right: 20,
    backgroundColor: Colors.white, borderRadius: 10,
    paddingVertical: 4, width: 150,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 8,
  },
  flagMenuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  flagMenuDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 10 },
  flagMenuText: { fontSize: 14, fontWeight: '500', color: Colors.text },

  nameBlock: { position: 'absolute', left: 24, bottom: 26 },
  name: {
    fontSize: 24, fontWeight: '800', color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  location: {
    fontSize: 13, color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },

  body: { paddingHorizontal: 20, paddingTop: 22 },

  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  aboutText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.text },

  iceCard: {
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  iceText: { fontSize: 14, color: Colors.text, lineHeight: 20 },

  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  galleryTile: {
    width: TILE_W, height: TILE_W * 1.25, borderRadius: 12,
    backgroundColor: Colors.surface,
  },

  actionPill: {
    position: 'absolute', bottom: 28, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 44,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14, shadowRadius: 12, elevation: 9,
  },
  actionBtn: {
    width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
  },
});
