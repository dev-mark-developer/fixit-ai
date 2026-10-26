import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Image, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { useAuth } from '../../store/AuthContext';
import { useModuleStatus, DatingType } from '../../store/ModuleStatusContext';
import SwitchDatingTypeModal from '../../components/dating/SwitchDatingTypeModal';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingLobby'>;

export default function DatingLobbyScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const { isMentor, hasDating, datingType } = useModuleStatus();
  const [switchTarget, setSwitchTarget] = useState<DatingType | null>(null);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  // Crossing between the two types — either direction — is a re-registration:
  // the account is deleted and the user signs up fresh (SwitchDatingTypeModal
  // owns that warning and the delete flow).
  const isSpiritual = datingType === 'Spiritual';

  const handleNonSpiritual = () => {
    if (isSpiritual) {
      setSwitchTarget('NonSpiritual');
      return;
    }
    // Already set up as Non-Spiritual — this card just means "stay where I am",
    // so skip the entry/setup screen and go back into the module.
    if (hasDating) {
      navigation.navigate('DatingMain');
      return;
    }
    navigation.navigate('NonSpiritualEntry');
  };

  const handleSpiritual = () => {
    // An existing Non-Spiritual profile is no longer carried across.
    if (hasDating && !isSpiritual) {
      setSwitchTarget('Spiritual');
      return;
    }
    navigation.navigate('SpiritualEntry');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Icon name="log-out-outline" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          Choose Your{' '}
          <Text style={styles.titleHighlight}>Path</Text>
        </Text>
        <Text style={styles.subtitle}>
          Choose your path to find a meaningful connection
        </Text>

        {/* Non-Spiritual Dating Card */}
        <TouchableOpacity
          style={[styles.card, styles.datingCard, isSpiritual && styles.cardLocked]}
          onPress={handleNonSpiritual}
          activeOpacity={0.9}
        >
          <Text style={[styles.cardLabel, styles.datingLabel]}>Non-Spiritual{'\n'}Dating</Text>
          {isSpiritual && (
            <Icon name="lock-closed" size={18} color={Colors.dating} style={styles.cardLock} />
          )}
          <Image
            source={require('../../assets/nonSpiritual.png')}
            style={styles.cardImage}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Spiritual Dating Card */}
        <TouchableOpacity
          style={[styles.card, styles.spiritualCard]}
          onPress={handleSpiritual}
          activeOpacity={0.9}
        >
          <Text style={[styles.cardLabel, styles.spiritualLabel]}>Spiritual{'\n'}Dating</Text>
          <Image
            source={require('../../assets/spiritual.png')}
            style={styles.cardImage}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          {hasDating
            ? 'Switching between dating types requires deleting your account and registering again — your data and subscription do not carry over.'
            : 'You can only be active in one dating type at a time.'}
        </Text>
      </ScrollView>

      {/* Spiritual Guru — pinned to bottom; hidden once the user is a guru */}
      {!isMentor && (
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
      )}

      <SwitchDatingTypeModal target={switchTarget} onClose={() => setSwitchTarget(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 8, lineHeight: 34 },
  titleHighlight: { color: Colors.dating },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 28 },

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
  cardLocked: { opacity: 0.55 },
  cardLock: { marginRight: 8 },
  spiritualCard: { backgroundColor: '#EEEEFF' },

  cardLabel: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  datingLabel: { color: Colors.dating },
  spiritualLabel: { color: Colors.spiritual },

  cardImage: { width: 160, height: '100%' },

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
