import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { parseApiDate } from '../../utils/datetime';
import RemoteImage from '../../components/common/RemoteImage';

type Props = NativeStackScreenProps<DatingStackParamList, 'AssignedMentor'>;

const AVATAR_SIZE = 132;
const MAIL_ICON_SIZE = 20;

/** "22 August 2025", as in the design; a dash when the date is missing. */
function formatDate(value?: string | null): string {
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * The spiritual member's assigned mentor (Figma "Mentor Details"), opened from
 * the Mentor Assigned card on the Spiritual entry screen.
 *
 * `GET /mentor-request` carries the mentor's name and photo but not yet their
 * title, bio or email (gap #35); each of those shows as soon as it arrives.
 */
export default function AssignedMentorScreen({ route, navigation }: Props) {
  const { request } = route.params;
  const name =
    request.assignedMentorDisplayName || request.assignedMentorName || 'Your Mentor';
  const tagline = request.assignedMentorTagline?.trim();
  const bio = request.assignedMentorBio?.trim();
  const email = request.assignedMentorEmail?.trim();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RemoteImage
          uri={request.assignedMentorImageUrl}
          style={styles.avatar}
          resizeMode="cover"
          indicatorColor={Colors.spiritual}
          fallback={
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          }
        />
        <Text style={styles.name}>{name}</Text>
        {!!tagline && <Text style={styles.tagline}>{tagline}</Text>}

        {/* The member's side of the mentorship: when they asked for a mentor,
            and when this one was assigned. */}
        <View style={styles.datesRow}>
          <View style={styles.dateCell}>
            <Text style={styles.dateValue}>{formatDate(request.createdAt)}</Text>
            <Text style={styles.dateLabel}>Registration Date</Text>
          </View>
          <View style={styles.dateDivider} />
          <View style={styles.dateCell}>
            <Text style={styles.dateValue}>{formatDate(request.assignedAt)}</Text>
            <Text style={styles.dateLabel}>Assigned Date</Text>
          </View>
        </View>

        {!!bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              About <Text style={styles.sectionTitleAccent}>{name}</Text>
            </Text>
            <Text style={styles.bio}>{bio}</Text>
          </View>
        )}

        {!!email && (
          <View style={styles.section}>
            <Text style={styles.contactTitle}>Contact Details</Text>
            <View style={styles.contactRow}>
              <View style={styles.mailIcon}>
                <Icon name="mail" size={12} color={Colors.white} />
              </View>
              <Text style={styles.contactLabel}>Email Address:</Text>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openURL(`mailto:${email}`).catch(() => {})}
              activeOpacity={0.7}
              accessibilityRole="link"
            >
              <Text style={styles.contactValue}>{email}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Keeps the footer at the bottom while the sections above are missing */}
        <View style={styles.spacer} />
        <View style={styles.footer}>
          <Text style={styles.footerNote}>Completed your course and</Text>
          <TouchableOpacity
            style={styles.certBtn}
            onPress={() => navigation.navigate('UploadCertificate')}
            activeOpacity={0.85}
          >
            <Image
              source={require('../../assets/document-upload.png')}
              style={styles.certBtnIcon}
              resizeMode="contain"
            />
            <Text style={styles.certBtnText}>Upload Certificate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  headerBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },

  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignSelf: 'center',
    marginTop: 4,
  },
  avatarFallback: {
    backgroundColor: Colors.spiritualLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 48, fontWeight: '700', color: Colors.spiritual },

  name: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.spiritual,
    textAlign: 'center',
    marginTop: 12,
  },
  tagline: { fontSize: 14, color: Colors.text, textAlign: 'center', marginTop: 2 },

  datesRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginTop: 22,
    paddingVertical: 12,
  },
  dateCell: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  dateDivider: { width: 1, backgroundColor: Colors.border, marginVertical: -12 },
  dateValue: { fontSize: 13, fontWeight: '700', color: Colors.text },
  dateLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },

  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '500', color: Colors.text, marginBottom: 6 },
  sectionTitleAccent: { fontWeight: '800', color: Colors.spiritual },
  bio: { fontSize: 14, color: Colors.text, lineHeight: 20 },

  contactTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mailIcon: {
    width: MAIL_ICON_SIZE,
    height: MAIL_ICON_SIZE,
    borderRadius: 5,
    backgroundColor: Colors.spiritualLime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactLabel: { fontSize: 14, color: Colors.text },
  contactValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: MAIL_ICON_SIZE + 8,
    marginTop: 2,
  },

  spacer: { flexGrow: 1, minHeight: 32 },
  footer: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerNote: { fontSize: 13, color: Colors.text, textAlign: 'center', marginBottom: 10 },
  // Same button as the Spiritual entry screen's
  certBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4F53C',
    borderRadius: 14,
    height: 56,
    gap: 10,
  },
  certBtnIcon: { width: 22, height: 22 },
  certBtnText: { fontSize: 16, fontWeight: '700', color: Colors.text },
});
