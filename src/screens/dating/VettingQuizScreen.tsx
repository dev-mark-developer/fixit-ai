import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  SafeAreaView,
  StyleSheet,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DatingStackParamList } from '../../types/navigation';
import { datingApi, VettingQuestion } from '../../api/dating';
import { mentorApi, ExternalMentor } from '../../api/mentor';
import AppButton from '../../components/common/AppButton';
import { Colors } from '../../utils/colors';
import RemoteImage from '../../components/common/RemoteImage';

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
    await new Promise<void>((r) => setTimeout(r, 2000));
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
        <Image
          source={require('../../assets/load-time.png')}
          style={styles.browserImg}
          resizeMode="contain"
        />

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
        <Image
          source={require('../../assets/hourglass.png')}
          style={styles.hourglassImg}
          resizeMode="contain"
        />

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
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>

          {/* Warning diamond */}
          <Image
            source={require('../../assets/warning.png')}
            style={styles.warningImg}
            resizeMode="contain"
          />

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
              const photo = 'profileImageUrl' in m ? (m as ExternalMentor).profileImageUrl : undefined;
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.mentorGridItem}
                  activeOpacity={isReal ? 0.75 : 1}
                  onPress={() => isReal && 'webPageUrl' in m ? Linking.openURL((m as ExternalMentor).webPageUrl).catch(() => {}) : undefined}
                >
                  {photo ? (
                    <RemoteImage uri={photo} style={styles.mentorAvatarImg} />
                  ) : (
                    <View style={[styles.mentorAvatar, { backgroundColor: bgColors[i % bgColors.length] }]}>
                      <Text style={styles.mentorAvatarText}>{initials || '🧘'}</Text>
                    </View>
                  )}
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
      </SafeAreaView>
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
    <SafeAreaView style={styles.root}>
      {/* Back arrow (steps back through questions, then exits) */}
      <TouchableOpacity
        style={styles.topBackBtn}
        onPress={() => (currentIndex > 0 ? handleBack() : navigation.goBack())}
        hitSlop={8}
      >
        <Text style={styles.topBackIcon}>←</Text>
      </TouchableOpacity>

      {/* Lotus step indicator (Figma) */}
      <View style={styles.stepsRow}>
        {Array.from({ length: total }).map((_, i) => {
          const reached = i <= currentIndex;
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <View
                  style={[
                    styles.stepLine,
                    i <= currentIndex && styles.stepLineDone,
                  ]}
                />
              )}
              <View style={[styles.stepDot, reached && styles.stepDotDone]}>
                {reached && (
                  <Image
                    source={require('../../assets/flower.png')}
                    style={styles.stepLotus}
                    resizeMode="contain"
                  />
                )}
              </View>
            </React.Fragment>
          );
        })}
      </View>

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
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {opt.optionText}
                </Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      <View style={styles.navRow}>
        <AppButton
          title={isLast ? 'Submit Assessment' : 'Next'}
          onPress={isLast ? handleSubmit : handleNext}
          disabled={!canProceed}
          style={styles.nextBtn}
        />
      </View>
    </SafeAreaView>
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
  hourglassImg: { width: 170, height: 170, marginBottom: 28 },
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

  // Back arrow + lotus step indicator
  topBackBtn: { paddingHorizontal: 20, paddingTop: 12, alignSelf: 'flex-start' },
  topBackIcon: { fontSize: 24, color: Colors.text, fontWeight: '700' },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
  },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: Colors.spiritualLime },
  stepLotus: { width: 18, height: 18 },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border },
  stepLineDone: { backgroundColor: Colors.spiritualLime },

  // Quiz
  quizContent: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 20 },
  questionText: { fontSize: 20, fontWeight: '800', color: Colors.text, lineHeight: 29, marginBottom: 26 },

  optionRow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  optionRowSelected: { backgroundColor: Colors.spiritualLime, borderColor: Colors.spiritualLime },
  optionText: { fontSize: 15, color: Colors.spiritual, lineHeight: 22 },
  optionTextSelected: { color: '#4B164C', fontWeight: '600' },

  navRow: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 8 },
  nextBtn: { backgroundColor: Colors.spiritual },

  // Result
  resultContent: { padding: 24, paddingBottom: 40, alignItems: 'center' },

  warningImg: { width: 170, height: 170, marginBottom: 16, marginTop: 8 },

  sorryLabel: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.spiritual,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 14,
  },
  resultDesc: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: 26,
  },

  chooseMentorLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 22,
  },
  mentorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 20,
  },
  mentorGridItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  mentorAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  mentorAvatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
  },
  mentorAvatarText: { fontSize: 22, fontWeight: '700', color: Colors.white },
  mentorAvatarName: { fontSize: 14, color: Colors.text, fontWeight: '600', textAlign: 'center' },

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
  browserImg: { width: 200, height: 190, marginBottom: 32 },

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
