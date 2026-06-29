import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DatingStackParamList } from '../../types/navigation';
import { datingApi, VettingQuestion } from '../../api/dating';
import { mentorApi, ExternalMentor } from '../../api/mentor';
import AppButton from '../../components/common/AppButton';
import { Colors } from '../../utils/colors';

type Props = NativeStackScreenProps<DatingStackParamList, 'VettingQuiz'>;

type QuizPhase = 'loading' | 'quiz' | 'reviewing' | 'result' | 'mentorRequested';

export default function VettingQuizScreen({ navigation }: Props) {
  const [phase, setPhase] = useState<QuizPhase>('loading');
  const [questions, setQuestions] = useState<VettingQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [mentors, setMentors] = useState<ExternalMentor[]>([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await datingApi.getVettingQuestions();
        const qs: VettingQuestion[] = (res.data?.data ?? []).sort(
          (a: VettingQuestion, b: VettingQuestion) => a.displayOrder - b.displayOrder,
        );
        if (qs.length === 0) {
          setError('No questions available. Please try again later.');
        }
        setQuestions(qs);
        setPhase('quiz');
      } catch {
        setError('Failed to load questions. Please try again.');
        setPhase('quiz');
      }
    })();
  }, []);

  const currentQuestion = questions[currentIndex];
  const total = questions.length;
  const progress = total > 0 ? (currentIndex + 1) / total : 0;
  const selectedOption = currentQuestion ? answers[currentQuestion.id] : undefined;

  const handleSelect = (optionId: number) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
  };

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleSubmit = async () => {
    setPhase('reviewing');
    const payload = Object.entries(answers).map(([qId, oId]) => ({
      questionId: Number(qId),
      selectedOptionId: oId,
    }));
    try {
      await datingApi.submitVetting(payload);
    } catch {
      // proceed to result regardless
    }
    // Fetch mentors for the result screen
    try {
      const res = await mentorApi.getExternalMentors();
      setMentors((res.data?.data ?? []).slice(0, 5));
    } catch {
      // use empty list
    }
    // 2-second "reviewing" delay
    await new Promise((r) => setTimeout(r, 2000));
    setPhase('result');
  };

  const handleRequestMentor = async () => {
    setRequestLoading(true);
    try {
      await mentorApi.submitRequest();
    } catch {
      // proceed to confirmation regardless
    } finally {
      setRequestLoading(false);
      setPhase('mentorRequested');
    }
  };

  // ─── Mentor Requested ─────────────────────────────────
  if (phase === 'mentorRequested') {
    return (
      <View style={styles.confirmedRoot}>
        {/* Illustration */}
        <View style={styles.browserWrap}>
          <View style={styles.browserBar}>
            <View style={styles.browserDot} />
            <View style={styles.browserDot} />
            <View style={styles.browserDot} />
          </View>
          <View style={styles.browserBody}>
            <Text style={styles.browserHourglass}>⏳</Text>
            <View style={styles.dotTopLeft} />
            <View style={styles.dotTopRight} />
            <View style={styles.dotBottomLeft} />
            <View style={styles.dotBottomRight} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.confirmedTitle}>Please Wait!</Text>

        {/* Description */}
        <Text style={styles.confirmedDesc}>
          We have received your request and a mentor will be personally assigned to support
          you on your spiritual journey. They will reach out to you shortly to guide and
          walk alongside you toward deeper alignment.
        </Text>

        {/* Back to Home */}
        <AppButton
          title="Back To Home"
          onPress={() => (navigation.getParent() as any)?.navigate('Home')}
          style={styles.backHomeBtn}
        />
      </View>
    );
  }

  // ─── Loading ───────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.spiritual} />
        <Text style={styles.loadingText}>Loading questions…</Text>
      </View>
    );
  }

  // ─── Reviewing ────────────────────────────────────────
  if (phase === 'reviewing') {
    return (
      <View style={styles.reviewingRoot}>
        {/* Hourglass illustration */}
        <View style={styles.hourglassWrap}>
          <Text style={styles.hourglassEmoji}>⏳</Text>
        </View>

        {/* Please Wait label */}
        <Text style={styles.pleaseWait}>Please Wait!</Text>

        {/* Title */}
        <Text style={styles.reviewingTitle}>
          Aligning{' '}
          <Text style={styles.reviewingTitleHighlight}>Your Profile</Text>
        </Text>

        {/* Description */}
        <Text style={styles.reviewingDesc}>
          We're carefully reviewing your responses to find the most meaningful and
          spiritually aligned connections for you. This will only take a moment.
        </Text>
      </View>
    );
  }

  // ─── Result ───────────────────────────────────────────
  if (phase === 'result') {
    const displayMentors = mentors.length > 0 ? mentors : PLACEHOLDER_MENTORS;
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>

          {/* Warning diamond */}
          <View style={styles.diamondWrap}>
            <View style={styles.diamond}>
              <Text style={styles.diamondText}>!</Text>
            </View>
          </View>

          {/* Sorry label */}
          <Text style={styles.sorryLabel}>Sorry!</Text>

          {/* Title */}
          <Text style={styles.resultTitle}>
            Your Answers Aren't Quite Mirroring Our Current Sanctuary Vibe
          </Text>

          {/* Description */}
          <Text style={styles.resultDesc}>
            Your responses show areas for spiritual growth. We recommend connecting with one
            of our experienced mentors who can guide you on your journey toward alignment.
          </Text>

          {/* Choose a Mentor grid */}
          <Text style={styles.chooseMentorLabel}>Choose a Mentor</Text>
          <View style={styles.mentorGrid}>
            {displayMentors.map((m, i) => {
              const initials = ('name' in m ? m.name : '')
                .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
              const bgColors = ['#C7B8EA', '#E8B4A0', '#A8D8C8', '#F4C3A0', '#B8D4EA'];
              const isReal = mentors.length > 0;
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.mentorGridItem}
                  activeOpacity={isReal ? 0.75 : 1}
                  onPress={() => isReal && 'webPageUrl' in m ? Linking.openURL(m.webPageUrl).catch(() => {}) : undefined}
                >
                  <View style={[styles.mentorAvatar, { backgroundColor: bgColors[i % bgColors.length] }]}>
                    <Text style={styles.mentorAvatarText}>{initials || '🧘'}</Text>
                  </View>
                  <Text style={styles.mentorAvatarName} numberOfLines={1}>
                    {'name' in m ? m.name : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* OR divider */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          {/* Request button */}
          <AppButton
            title="Request a Mentor"
            onPress={handleRequestMentor}
            loading={requestLoading}
            style={styles.spiritualBtn}
          />
          <Text style={styles.assignNote}>We will assign you a mentor</Text>
        </ScrollView>
      </View>
    );
  }

  // ─── Quiz ─────────────────────────────────────────────
  if (error || questions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'No questions available.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLast = currentIndex === total - 1;
  const canProceed = selectedOption !== undefined;

  return (
    <View style={styles.root}>
      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        Question {currentIndex + 1} of {total}
      </Text>

      <ScrollView contentContainerStyle={styles.quizContent}>
        <Text style={styles.questionText}>{currentQuestion.question}</Text>

        {currentQuestion.options
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((opt) => {
            const selected = selectedOption === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
                activeOpacity={0.75}
                onPress={() => handleSelect(opt.id)}
              >
                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {opt.optionText}
                </Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.backBtn, currentIndex === 0 && styles.navBtnHidden]}
          onPress={handleBack}
          disabled={currentIndex === 0}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        {isLast ? (
          <AppButton
            title="Submit"
            onPress={handleSubmit}
            disabled={!canProceed}
            style={styles.nextBtn}
          />
        ) : (
          <AppButton
            title="Next →"
            onPress={handleNext}
            disabled={!canProceed}
            style={styles.nextBtn}
          />
        )}
      </View>
    </View>
  );
}

const PLACEHOLDER_MENTORS = [
  { id: 1, name: 'Jason Taylor' },
  { id: 2, name: 'Aria Vance' },
  { id: 3, name: 'Julian Cross' },
  { id: 4, name: 'Marcus Veda' },
  { id: 5, name: 'Gabriel Voss' },
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: 32 },

  loadingText: { marginTop: 16, fontSize: 15, color: Colors.spiritual },

  reviewingRoot: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  hourglassWrap: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: Colors.spiritualLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  hourglassEmoji: { fontSize: 72 },
  pleaseWait: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F5C518',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  reviewingTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  reviewingTitleHighlight: { color: Colors.spiritual },
  reviewingDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Progress
  progressBarBg: { height: 6, backgroundColor: Colors.spiritualLight, marginHorizontal: 20, marginTop: 16, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: Colors.spiritual, borderRadius: 3 },
  progressLabel: { textAlign: 'right', marginHorizontal: 20, marginTop: 6, fontSize: 12, color: Colors.textMuted },

  // Quiz
  quizContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  questionText: { fontSize: 19, fontWeight: '700', color: Colors.text, lineHeight: 28, marginBottom: 28 },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 12,
    backgroundColor: Colors.background,
  },
  optionRowSelected: { borderColor: Colors.spiritual, backgroundColor: Colors.spiritualLight },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  radioOuterSelected: { borderColor: Colors.spiritual },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.spiritual },
  optionText: { flex: 1, fontSize: 15, color: Colors.text, lineHeight: 22 },
  optionTextSelected: { color: Colors.spiritual, fontWeight: '600' },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 28, paddingTop: 8 },
  backBtn: { paddingVertical: 10, paddingHorizontal: 4 },
  navBtnHidden: { opacity: 0 },
  backBtnText: { fontSize: 15, color: Colors.spiritual, fontWeight: '600' },
  nextBtn: { flex: 1, maxWidth: 200, marginLeft: 16, backgroundColor: Colors.spiritual },

  // Result
  resultContent: { padding: 24, paddingBottom: 40, alignItems: 'center' },

  diamondWrap: { marginBottom: 20, marginTop: 8 },
  diamond: {
    width: 100,
    height: 100,
    backgroundColor: '#F5A623',
    borderRadius: 18,
    transform: [{ rotate: '45deg' }],
    borderWidth: 5,
    borderColor: '#5B3FD9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#5B3FD9',
    transform: [{ rotate: '-45deg' }],
    lineHeight: 56,
  },

  sorryLabel: {
    fontSize: 18,
    fontWeight: '700',
    fontStyle: 'italic',
    color: Colors.spiritual,
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 14,
  },
  resultDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },

  chooseMentorLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  mentorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginBottom: 20,
  },
  mentorGridItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  mentorAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  mentorAvatarText: { fontSize: 20, fontWeight: '700', color: Colors.white },
  mentorAvatarName: { fontSize: 12, color: Colors.text, fontWeight: '500', textAlign: 'center' },

  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    gap: 10,
  },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },

  spiritualBtn: { backgroundColor: Colors.spiritual, width: '100%' },
  requestDoneBanner: { backgroundColor: Colors.spiritualLight, borderRadius: 12, padding: 16, alignItems: 'center', width: '100%' },
  requestDoneText: { fontSize: 15, fontWeight: '600', color: Colors.spiritual },
  assignNote: { fontSize: 12, color: Colors.textMuted, marginTop: 10, textAlign: 'center' },

  errorText: { fontSize: 15, color: Colors.error, textAlign: 'center', marginBottom: 20 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: Colors.spiritualLight },
  retryText: { color: Colors.spiritual, fontWeight: '600' },

  // Mentor Requested (confirmed)
  confirmedRoot: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  browserWrap: {
    width: 200,
    borderRadius: 16,
    backgroundColor: '#F3F0FF',
    overflow: 'hidden',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  browserBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  browserDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.spiritual,
    opacity: 0.5,
  },
  browserBody: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  browserHourglass: { fontSize: 64 },
  dotTopLeft:    { position: 'absolute', top: 14, left: 16,  width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.spiritual, opacity: 0.3 },
  dotTopRight:   { position: 'absolute', top: 14, right: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.spiritual, opacity: 0.3 },
  dotBottomLeft: { position: 'absolute', bottom: 14, left: 16,  width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.spiritual, opacity: 0.3 },
  dotBottomRight:{ position: 'absolute', bottom: 14, right: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.spiritual, opacity: 0.3 },

  confirmedTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmedDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  backHomeBtn: { backgroundColor: Colors.spiritual, width: '100%' },
});
