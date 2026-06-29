import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { getUser, AuthUser } from '../../store/auth';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingLobby'>;

export default function DatingLobbyScreen({ navigation }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ title: string; message: string; buttons?: AlertButton[] } | null>(null);

  useEffect(() => {
    getUser().then((u) => { setUser(u); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.dating} size="large" />
      </View>
    );
  }

  const handleNonSpiritual = () => {
    navigation.navigate('NonSpiritualEntry');
  };

  const handleSpiritual = () => {
    // If user already has NonSpiritual active, warn before switching
    navigation.navigate('SpiritualEntry');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Choose Your{' '}
            <Text style={styles.titleHighlight}>Path</Text>
          </Text>
          <Text style={styles.subtitle}>
            Choose your path to find a meaningful connection
          </Text>
        </View>

        {/* Non-Spiritual Dating Card */}
        <TouchableOpacity
          style={[styles.card, styles.datingCard]}
          onPress={handleNonSpiritual}
          activeOpacity={0.88}
        >
          <View style={styles.cardLeft}>
            <Text style={[styles.cardLabel, styles.datingLabel]}>Non-Spiritual{'\n'}Dating</Text>
            <Text style={[styles.cardHint, styles.datingHint]}>Swipe &amp; match</Text>
          </View>
          <View style={styles.cardIllustration}>
            <Text style={styles.illTop}>💕</Text>
            <Text style={styles.illMain}>👫</Text>
            <Text style={styles.illBottomLeft}>🌸</Text>
            <Text style={styles.illBottomRight}>💌</Text>
          </View>
        </TouchableOpacity>

        {/* Spiritual Dating Card */}
        <TouchableOpacity
          style={[styles.card, styles.spiritualCard]}
          onPress={handleSpiritual}
          activeOpacity={0.88}
        >
          <View style={styles.cardLeft}>
            <Text style={[styles.cardLabel, styles.spiritualLabel]}>Spiritual{'\n'}Dating</Text>
            <Text style={[styles.cardHint, styles.spiritualHint]}>Mindful connections</Text>
          </View>
          <View style={styles.cardIllustration}>
            <Text style={styles.illTop}>✨</Text>
            <Text style={styles.illMain}>🧘</Text>
            <Text style={styles.illBottomLeft}>🌙</Text>
            <Text style={styles.illBottomRight}>🕊️</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          You can only be active in one dating type at a time.
        </Text>
      </ScrollView>

      {/* Spiritual Guru — pinned to bottom */}
      <TouchableOpacity
        style={styles.guruRow}
        onPress={() => (navigation.getParent() as any)?.navigate('MentorSetup')}
        activeOpacity={0.7}
      >
        <Text style={styles.guruText}>
          Are you a Spiritual Guru?{' '}
          <Text style={styles.guruLink}>Sign Up</Text>
        </Text>
      </TouchableOpacity>

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        buttons={alert?.buttons}
        onClose={() => setAlert(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingTop: 16, paddingBottom: 40 },

  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 8, lineHeight: 36 },
  titleHighlight: { color: Colors.dating },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },

  card: {
    borderRadius: 20,
    marginBottom: 16,
    height: 148,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingLeft: 24,
  },
  datingCard: { backgroundColor: '#FDEEF1' },
  spiritualCard: { backgroundColor: '#EEEEFF' },

  cardLeft: { flex: 1, justifyContent: 'center' },
  cardLabel: {
    fontSize: 26,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: -0.5,
    marginBottom: 6,
    lineHeight: 32,
  },
  datingLabel: { color: Colors.dating },
  spiritualLabel: { color: Colors.spiritual },
  cardHint: { fontSize: 13, fontWeight: '500' },
  datingHint: { color: Colors.dating },
  spiritualHint: { color: Colors.spiritual },

  cardIllustration: {
    width: 130,
    height: '100%',
    position: 'relative',
  },
  illTop: { position: 'absolute', top: 12, right: 28, fontSize: 22 },
  illMain: { position: 'absolute', top: 36, right: 16, fontSize: 56 },
  illBottomLeft: { position: 'absolute', bottom: 14, right: 52, fontSize: 22 },
  illBottomRight: { position: 'absolute', bottom: 10, right: 14, fontSize: 20 },

  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    paddingHorizontal: 20,
  },

  guruRow: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingBottom: 28,
    backgroundColor: Colors.background,
  },
  guruText: { fontSize: 14, color: Colors.textSecondary },
  guruLink: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
