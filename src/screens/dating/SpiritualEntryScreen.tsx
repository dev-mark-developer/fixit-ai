import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { datingApi, SpiritualRequest } from '../../api/dating';
import { mentorApi, MentorRequest } from '../../api/mentor';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';

type Props = NativeStackScreenProps<DatingStackParamList, 'SpiritualEntry'>;

type Phase = 'info' | 'loading' | 'gateway' | 'pending' | 'approved';

export default function SpiritualEntryScreen({ navigation }: Props) {
  const [phase, setPhase] = useState<Phase>('info');
  const [request, setRequest] = useState<SpiritualRequest | null>(null);
  const [resolvedPhase, setResolvedPhase] = useState<Phase | null>(null);
  const [starting, setStarting] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  // Mentor request state (gateway phase)
  const [mentorRequest, setMentorRequest] = useState<MentorRequest | null>(null);
  const [requestingMentor, setRequestingMentor] = useState(false);

  // Preload spiritual status + mentor request in background while user reads the info screen
  useEffect(() => {
    (async () => {
      try {
        const res = await datingApi.getSpiritualRequest();
        const req: SpiritualRequest | null = res.data?.data ?? null;
        if (!req) { setResolvedPhase('gateway'); return; }
        const s = req.status?.toLowerCase();
        if (s === 'approved') { setRequest(req); setResolvedPhase('approved'); }
        else if (s === 'pending') { setRequest(req); setResolvedPhase('pending'); }
        else { setResolvedPhase('gateway'); }
      } catch {
        setResolvedPhase('gateway');
      }
    })();

    mentorApi.getMyRequest()
      .then((res) => setMentorRequest(res.data?.data ?? null))
      .catch(() => {});
  }, []);

  const handleRequestMentor = async () => {
    setRequestingMentor(true);
    try {
      const res = await mentorApi.submitRequest();
      setMentorRequest(res.data?.data ?? { id: 0, userId: 0, status: 'Pending', createdAt: new Date().toISOString() });
    } catch {
      setAlert({ title: 'Error', message: 'Could not submit your mentor request. Please try again.' });
    } finally {
      setRequestingMentor(false);
    }
  };

  const handleStartSpiritual = async () => {
    setStarting(true);
    try {
      // Check if dating profile already exists
      const res = await datingApi.getProfile();
      const existing = res.data?.data ?? null;
      if (existing) {
        navigation.navigate('DatingMain');
        return;
      }
    } catch (err: any) {
      if (err?.response?.status !== 404) {
        setAlert({ title: 'Error', message: 'Could not connect to server. Please try again.' });
        setStarting(false);
        return;
      }
    }
    // No profile yet — create it then go to interest selection
    try {
      await datingApi.saveProfile({ datingType: 'Spiritual', interestedInGender: 'Any' });
      navigation.navigate('DatingInterestSelection', { datingType: 'Spiritual' });
    } catch {
      setAlert({ title: 'Error', message: 'Could not create your profile. Please try again.' });
    } finally {
      setStarting(false);
    }
  };

  const handleProceed = () => {
    if (resolvedPhase) {
      setPhase(resolvedPhase);
    } else {
      // Still loading — show spinner and transition once ready
      setPhase('loading');
    }
  };

  // When background load finishes while we're on loading screen, advance
  useEffect(() => {
    if (phase === 'loading' && resolvedPhase) {
      setPhase(resolvedPhase);
    }
  }, [resolvedPhase, phase]);

  // ── Info (static informative screen) ─────────────────
  if (phase === 'info') {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.infoContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text style={styles.infoTitle}>
            Purpose of{' '}
            <Text style={styles.infoTitleHighlight}>Spiritual Dating</Text>
          </Text>

          {/* Intro */}
          <Text style={styles.introText}>
            Our spiritual dating section is a gated sanctuary designed for members who value
            resonance, growth, and deep soul-connection.
          </Text>

          {/* Block 1 — icon LEFT */}
          <View style={styles.infoBlock}>
            <View style={styles.infoIconWrap}>
              <Text style={styles.infoBlockIcon}>🙏</Text>
            </View>
            <Text style={styles.infoBlockText}>
              We believe authentic connection begins within. Before matching, every member
              completes a brief spiritual values assessment to ensure genuine alignment.
            </Text>
          </View>
          <Text style={styles.infoBullet}>
            • Only members who complete vetting or provide credentials gain access.
          </Text>

          {/* Highlight 1 — yellow */}
          <View style={[styles.highlightBlock, styles.highlightYellow]}>
            <Text style={styles.highlightText}>
              Your spiritual journey matters. We've created a space where every interaction
              is intentional, respectful, and rooted in shared values.
            </Text>
          </View>

          {/* Block 2 — icon RIGHT */}
          <View style={[styles.infoBlock, styles.infoBlockReverse]}>
            <View style={styles.infoIconWrap}>
              <Text style={styles.infoBlockIcon}>💝</Text>
            </View>
            <Text style={[styles.infoBlockText, styles.infoBlockText]}>
              Our community is built on trust and mindfulness. Profiles are reviewed to
              maintain a high-quality, authentic spiritual environment.
            </Text>
          </View>
          <Text style={styles.infoBullet}>
            • No casual browsing — every member here is serious about meaningful connection.
          </Text>

          {/* Highlight 2 — purple */}
          <View style={[styles.highlightBlock, styles.highlightPurple]}>
            <Text style={[styles.highlightText, styles.highlightTextLight]}>
              Soul-level compatibility goes beyond surface interests. Our matching considers
              spiritual beliefs, practices, and life values.
            </Text>
          </View>

          {/* Block 3 — icon LEFT */}
          <View style={styles.infoBlock}>
            <View style={styles.infoIconWrap}>
              <Text style={styles.infoBlockIcon}>🌿</Text>
            </View>
            <Text style={styles.infoBlockText}>
              When you're ready, verify through a short quiz or by uploading a spiritual
              credential or certificate for manual review.
            </Text>
          </View>
          <Text style={styles.infoBullet}>
            • All submissions are reviewed by our team within 1–3 business days.
          </Text>

          {/* Block 4 — icon RIGHT */}
          <View style={[styles.infoBlock, styles.infoBlockReverse]}>
            <View style={styles.infoIconWrap}>
              <Text style={styles.infoBlockIcon}>🕊️</Text>
            </View>
            <Text style={[styles.infoBlockText, styles.infoBlockText]}>
              Once approved, you'll gain full access to the spiritual dating community
              and be able to connect with like-minded souls.
            </Text>
          </View>
          <Text style={styles.infoBullet}>
            • Approved members enjoy a mindful, vetted space for meaningful relationships.
          </Text>
        </ScrollView>

        {/* Proceed button pinned to bottom */}
        <View style={styles.infoFooter}>
          <AppButton
            title="Let's Proceed"
            onPress={handleProceed}
            loading={phase === 'loading'}
            style={styles.proceedBtn}
          />
        </View>
      </View>
    );
  }

  // ── Loading ───────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.spiritual} />
      </View>
    );
  }

  // ── Approved → go directly to Dating ─────────────────
  if (phase === 'approved') {
    return (
      <>
        <ScrollView contentContainerStyle={styles.centeredContent}>
          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: '#D1FAE5' }]}>
              <Text style={styles.iconEmoji}>✅</Text>
            </View>
            <Text style={styles.cardTitle}>You're Approved!</Text>
            <Text style={styles.cardSub}>
              Your spiritual credentials have been verified. Start connecting with like-minded souls.
            </Text>
            {request?.reviewedAt && (
              <Text style={styles.cardMeta}>
                Approved on {new Date(request.reviewedAt).toLocaleDateString()}
              </Text>
            )}
            <AppButton
              title="Start Spiritual Dating"
              onPress={handleStartSpiritual}
              loading={starting}
              style={styles.spiritualBtn}
            />
          </View>
        </ScrollView>
        <AppAlert
          visible={!!alert}
          title={alert?.title ?? ''}
          message={alert?.message}
          onClose={() => setAlert(null)}
        />
      </>
    );
  }

  // ── Pending ───────────────────────────────────────────
  if (phase === 'pending') {
    return (
      <ScrollView contentContainerStyle={styles.centeredContent}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.spiritualLight }]}>
            <Text style={styles.iconEmoji}>🔍</Text>
          </View>
          <Text style={styles.cardTitle}>Under Review</Text>
          <Text style={styles.cardSub}>
            Your application is being reviewed by our team. This usually takes 1–3 business days.
          </Text>
          {request?.createdAt && (
            <Text style={styles.cardMeta}>
              Submitted on {new Date(request.createdAt).toLocaleDateString()}
            </Text>
          )}
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Pending Review</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  // ── Gateway — choose entry path ───────────────────────
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.gatewayContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Illustration */}
        <View style={styles.illustration}>
          <Text style={styles.illLeafLeft}>🌿</Text>
          <Text style={styles.illLeafRight}>🌿</Text>
          <Text style={styles.illClipboard}>📋</Text>
          <Text style={styles.illPencil}>✏️</Text>
          <Text style={styles.illPerson}>🧘‍♀️</Text>
        </View>

        {/* Title */}
        <Text style={styles.gatewayTitle}>
          The Path to{' '}
          <Text style={styles.gatewayTitleHighlight}>Alignment</Text>
        </Text>

        {/* Descriptions */}
        <Text style={styles.gatewayDesc}>
          To ensure a space of high intentionality and authentic connection, every member
          undergoes a manual vetting process.
        </Text>
        <Text style={styles.gatewayDescSub}>
          Your responses help us understand your current frequency and readiness for a
          soulful partnership.
        </Text>
        <Text style={styles.gatewayDescSub}>
          This is a space for those seeking more than just a match — they are seeking
          a mirror.
        </Text>

        {/* Mentor guidance section */}
        <View style={styles.mentorSection}>
          <View style={styles.mentorSectionHeader}>
            <View style={styles.mentorDivider} />
            <Text style={styles.mentorSectionLabel}>Need guidance first?</Text>
            <View style={styles.mentorDivider} />
          </View>
          <Text style={styles.mentorSectionSub}>
            Not ready for vetting? Connect with a mentor to prepare your spiritual journey.
          </Text>

          {/* Browse External Mentors */}
          <TouchableOpacity
            style={styles.mentorCard}
            onPress={() => navigation.navigate('SpiritualMentors')}
            activeOpacity={0.85}
          >
            <View style={styles.mentorCardIcon}>
              <Text style={styles.mentorCardEmoji}>🌐</Text>
            </View>
            <View style={styles.mentorCardBody}>
              <Text style={styles.mentorCardTitle}>Browse External Mentors</Text>
              <Text style={styles.mentorCardDesc}>
                Explore our curated list of trusted spiritual mentors and their resources.
              </Text>
            </View>
            <Text style={styles.mentorCardChevron}>›</Text>
          </TouchableOpacity>

          {/* Request a Personal Mentor */}
          {!mentorRequest ? (
            <TouchableOpacity
              style={[styles.mentorCard, styles.mentorCardRequest]}
              onPress={handleRequestMentor}
              activeOpacity={0.85}
              disabled={requestingMentor}
            >
              <View style={[styles.mentorCardIcon, { backgroundColor: Colors.spiritualLight }]}>
                <Text style={styles.mentorCardEmoji}>🙏</Text>
              </View>
              <View style={styles.mentorCardBody}>
                <Text style={styles.mentorCardTitle}>Request a Personal Mentor</Text>
                <Text style={styles.mentorCardDesc}>
                  Ask to be matched with an in-app spiritual mentor for 1-on-1 guidance.
                </Text>
              </View>
              {requestingMentor
                ? <ActivityIndicator size="small" color={Colors.spiritual} />
                : <Text style={styles.mentorCardChevron}>›</Text>}
            </TouchableOpacity>
          ) : (
            <View style={[styles.mentorCard, styles.mentorCardStatus]}>
              <View style={[styles.mentorCardIcon, { backgroundColor: Colors.spiritualLight }]}>
                <Text style={styles.mentorCardEmoji}>
                  {mentorRequest.status?.toLowerCase() === 'assigned' ? '✅' : '⏳'}
                </Text>
              </View>
              <View style={styles.mentorCardBody}>
                {mentorRequest.status?.toLowerCase() === 'assigned' ? (
                  <>
                    <Text style={styles.mentorCardTitle}>Mentor Assigned</Text>
                    <Text style={styles.mentorCardDesc}>
                      {mentorRequest.assignedMentorDisplayName ?? mentorRequest.assignedMentorName ?? 'Your mentor'} is ready to guide you.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.mentorCardTitle}>Request Submitted</Text>
                    <Text style={styles.mentorCardDesc}>
                      Our team is matching you with a suitable mentor. This usually takes 1–2 days.
                    </Text>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Actions pinned to bottom */}
      <View style={styles.gatewayFooter}>
        <AppButton
          title="Begin My Vetting"
          onPress={() => navigation.navigate('VettingQuiz')}
          style={styles.vettingBtn}
        />
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.orLine} />
        </View>
        <TouchableOpacity
          style={styles.certBtn}
          onPress={() => navigation.navigate('UploadCertificate')}
          activeOpacity={0.85}
        >
          <Text style={styles.certBtnIcon}>📄</Text>
          <Text style={styles.certBtnText}>Upload Certificate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  centeredContent: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: Colors.background },

  // ── Gateway ───────────────────────────────────────────
  gatewayContent: { padding: 24, paddingBottom: 16 },

  illustration: {
    height: 200,
    backgroundColor: Colors.spiritualLight,
    borderRadius: 24,
    marginBottom: 28,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  illLeafLeft:  { position: 'absolute', bottom: 10, left: 12,  fontSize: 48, opacity: 0.5 },
  illLeafRight: { position: 'absolute', top: 10,   right: 12,  fontSize: 40, opacity: 0.5 },
  illClipboard: { position: 'absolute', top: 20,   right: 60,  fontSize: 72 },
  illPencil:    { position: 'absolute', top: 10,   right: 30,  fontSize: 52 },
  illPerson:    { position: 'absolute', bottom: 8, left: 40,   fontSize: 80 },

  gatewayTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  gatewayTitleHighlight: { color: Colors.spiritual },

  gatewayDesc: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 14,
  },
  gatewayDescSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
    fontStyle: 'italic',
  },

  // ── Mentor guidance section (gateway phase) ──────────
  mentorSection: { marginTop: 28, paddingBottom: 8 },
  mentorSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  mentorDivider: { flex: 1, height: 1, backgroundColor: Colors.border },
  mentorSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  mentorSectionSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    fontStyle: 'italic',
  },

  mentorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  mentorCardRequest: { borderColor: Colors.spiritualLight },
  mentorCardStatus: { borderColor: Colors.spiritualLight, opacity: 0.95 },

  mentorCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  mentorCardEmoji: { fontSize: 22 },
  mentorCardBody: { flex: 1 },
  mentorCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  mentorCardDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  mentorCardChevron: { fontSize: 22, color: Colors.textMuted, fontWeight: '300' },

  gatewayFooter: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: Colors.background,
    gap: 0,
  },
  vettingBtn: { backgroundColor: Colors.spiritual, marginBottom: 0 },

  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },

  certBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4F53C',
    borderRadius: 14,
    height: 56,
    gap: 10,
  },
  certBtnIcon: { fontSize: 20 },
  certBtnText: { fontSize: 16, fontWeight: '700', color: Colors.text },

  // Card (approved/pending states)
  card: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconEmoji: { fontSize: 36 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 12, textAlign: 'center' },
  cardSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  cardMeta: { fontSize: 12, color: Colors.textMuted, marginBottom: 20 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.spiritualLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.spiritual, marginRight: 8 },
  statusText: { fontSize: 13, fontWeight: '600', color: Colors.spiritual },

  spiritualBtn: { backgroundColor: Colors.spiritual, width: '100%', marginTop: 4 },

  // ── Info screen ───────────────────────────────────────
  root: { flex: 1, backgroundColor: Colors.background },
  infoContent: { padding: 24, paddingBottom: 16 },

  infoTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 34,
    marginBottom: 14,
  },
  infoTitleHighlight: { color: Colors.spiritual, fontStyle: 'italic' },

  introText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },

  infoBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 14,
  },
  infoBlockReverse: { flexDirection: 'row-reverse' },
  infoIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: Colors.spiritualLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoBlockIcon: { fontSize: 30 },
  infoBlockText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
    paddingTop: 4,
    textAlign: 'justify',
  },
  infoBullet: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
    paddingLeft: 4,
    textAlign: 'justify',
  },

  highlightBlock: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  highlightYellow: { backgroundColor: '#F0F7A1' },
  highlightPurple: { backgroundColor: Colors.spiritual },
  highlightText: {
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 22,
  },
  highlightTextLight: { color: Colors.white },

  infoFooter: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: Colors.background,
  },
  proceedBtn: { backgroundColor: Colors.spiritual },
});
