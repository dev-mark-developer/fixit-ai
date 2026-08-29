import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Image, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { getUser, AuthUser } from '../../store/auth';
import { useAuth } from '../../store/AuthContext';
import { useModuleStatus } from '../../store/ModuleStatusContext';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingLobby'>;

export default function DatingLobbyScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const { isMentor, datingType } = useModuleStatus();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ title: string; message: string; buttons?: AlertButton[] } | null>(null);

  useEffect(() => {
    getUser().then((u) => { setUser(u); setLoading(false); });
  }, []);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.dating} size="large" />
      </View>
    );
  }

  // A Spiritual account is permanent: the only way to Non-Spiritual is to
  // delete the account and register again.
  const isSpiritual = datingType === 'Spiritual';

  const handleNonSpiritual = () => {
    if (isSpiritual) {
      setAlert({
        title: 'Switching Not Available',
        message:
          'Your account is registered for Spiritual Dating and cannot be switched to Non-Spiritual Dating.\n\nTo use Non-Spiritual Dating you need to delete this account and register again.',
      });
      return;
    }
    navigation.navigate('NonSpiritualEntry');
  };

  const handleSpiritual = () => {
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
          {isSpiritual
            ? 'Spiritual accounts cannot be switched to Non-Spiritual. Switching requires deleting your account and registering again.'
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
