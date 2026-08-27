import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import type { DatingStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import RemoteImage from '../../components/common/RemoteImage';
import { datingApi, DatingUserDetail } from '../../api/dating';
import ReportModal from '../../components/common/ReportModal';
import { useModuleStatus } from '../../store/ModuleStatusContext';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingProfileDetail'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HEADER_H = SCREEN_H * 0.48;
const GRID_GAP = 10;
const TILE_W = (SCREEN_W - 40 - GRID_GAP * 2) / 3;

function ageFromDob(dob?: string): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : undefined;
}

export default function DatingProfileDetailScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  // Route params act as instant seed data (header renders immediately); the
  // fetched profile fills or replaces them when it arrives.
  const seed = route.params;

  const { datingType } = useModuleStatus();
  const isSpiritual = datingType === 'Spiritual';
  const accent = isSpiritual ? Colors.spiritual : Colors.dating;
  const limeLight = isSpiritual ? Colors.spiritualLimeLight : Colors.datingLight;

  const [profile, setProfile] = useState<DatingUserDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [reportVisible, setReportVisible] = useState(false);
  const [flagMenuVisible, setFlagMenuVisible] = useState(false);

  useEffect(() => {
    let active = true;
    datingApi.getUser(userId)
      .then((res) => {
        if (!active) return;
        const data = (res.data?.data ?? res.data) as DatingUserDetail | undefined;
        if (data && typeof data === 'object') setProfile(data);
      })
      .catch(() => {}) // seed params keep the screen usable
      .finally(() => active && setProfileLoading(false));
    return () => { active = false; };
  }, [userId]);

  const firstName = profile?.pseudoName || profile?.firstName || seed.firstName;
  const age = profile?.age ?? ageFromDob(profile?.dateOfBirth) ?? seed.age;
  const city = profile?.city ?? seed.city;
  const country = profile?.country ?? seed.country;
  const about = profile?.about ?? seed.about;
  const interests = profile?.interests
    ? profile.interests.map((i) => (typeof i === 'string' ? i : i?.name ?? '')).filter(Boolean)
    : seed.interests;
  const iceBreakerQuestions = profile?.iceBreakerQuestions
    ? profile.iceBreakerQuestions.map((q) => (typeof q === 'string' ? q : q?.question ?? '')).filter(Boolean)
    : seed.iceBreakerQuestions;
  const images = profile?.images
    ? profile.images.map((img) => (typeof img === 'string' ? img : img?.imageUrl ?? '')).filter(Boolean)
    : seed.images;

  const headerUri =
    profile?.displayImageUrl ?? profile?.profileImageUrl ??
    seed.displayImageUrl ?? seed.profileImageUrl ?? images[0];
  const galleryImages = images.filter((img) => img !== headerUri);

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
          {/* Body loading — only when the seed had nothing to show yet */}
          {profileLoading && !about && interests.length === 0 && galleryImages.length === 0 && (
            <View style={styles.bodyLoading}>
              <ActivityIndicator color={accent} size="small" />
            </View>
          )}

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

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
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

  // Translucent scrim behind the glyph — the header can be a dark photo, a pale
  // photo or the tinted initials fallback, and white alone reads on none of them.
  overlayBtn: {
    position: 'absolute', top: 54,
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  backBtn: { left: 20 },
  flagBtn: { right: 20 },

  flagMenu: {
    position: 'absolute', top: 100, right: 20,
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
  bodyLoading: { paddingVertical: 28, alignItems: 'center' },

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
});
