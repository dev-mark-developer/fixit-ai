import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingStackParamList } from '../../types/navigation';
import { datingApi, InterestCategory } from '../../api/dating';
import AppAlert from '../../components/common/AppAlert';
import AppButton from '../../components/common/AppButton';
import { Colors } from '../../utils/colors';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingInterestSelection'>;

const MAX_INTERESTS = 5;

// Decorative emoji for known interest names (Figma shows one per chip).
// Unknown interests simply render without an emoji.
const INTEREST_EMOJI: Record<string, string> = {
  meditation: '🧘', manifestation: '✨', 'tarot & oracle': '🔮', astrology: '🪐',
  yoga: '🧘', breathwork: '🌬️', 'energy healing': '🙌', 'shadow work': '📖',
  'forest bathing': '🌲', 'conscious living': '🌱', 'radical honesty': '🤍',
  'inner peace': '🌀', transformation: '🔥', balance: '⚖️', integrity: '💎',
  'higher purpose': '🌟', gratitude: '🙏', 'sacred union': '💍',
  'divine friendship': '🕊️', 'twin flame search': '❤️‍🔥', 'spiritual growth': '🌿',
  'creative flow': '🎨', 'deep soul-talk': '💬',
  nature: '🌿', language: '🗣️', writing: '✍️', fashion: '👗', travel: '🏝️',
  people: '🙂', music: '🎵', movies: '🎬', sports: '⚽', cooking: '🍳',
  art: '🎨', reading: '📚', gaming: '🎮', photography: '📷', fitness: '💪',
};

const emojiFor = (name: string) => INTEREST_EMOJI[name.toLowerCase()] ?? '';

export default function DatingInterestSelectionScreen({ navigation, route }: Props) {
  const { datingType } = route.params;
  const isSpiritual = datingType === 'Spiritual';
  const accentColor = isSpiritual ? Colors.spiritual : Colors.dating;
  const lime = isSpiritual ? Colors.spiritualLime : Colors.datingSecondary;

  const [categories, setCategories] = useState<InterestCategory[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    datingApi
      .getInterests(datingType)
      .then((res) => {
        const data: InterestCategory[] = res.data?.data ?? [];
        setCategories(data);
      })
      .catch(() => {
        setAlert({ title: 'Error', message: 'Could not load interests. Please try again.' });
      })
      .finally(() => setLoading(false));
  }, [datingType]);

  const toggleInterest = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_INTERESTS) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleContinue = async () => {
    if (selected.size === 0) {
      setAlert({ title: 'Select Interests', message: 'Please select at least one interest to continue.' });
      return;
    }
    setSaving(true);
    try {
      await datingApi.setInterests(Array.from(selected));
      navigation.navigate('DatingIceBreakerSelection', { datingType });
    } catch {
      setAlert({ title: 'Error', message: 'Could not save your interests. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={accentColor} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Plain back arrow header (Figma) */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() && navigation.goBack()}
          hitSlop={8}
        >
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Header — "Discover Your Resonance" (Figma) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Discover{' '}
          <Text style={{ color: accentColor }}>Your Resonance</Text>
        </Text>
      </View>

      {/* Chip list */}
      <FlatList
        data={categories}
        keyExtractor={(cat) => String(cat.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: category }) => (
          <View style={styles.categoryBlock}>
            <Text style={styles.categoryName}>{category.name}</Text>
            <View style={styles.chipsRow}>
              {category.interests.map((interest) => {
                const isSelected = selected.has(interest.id);
                const atLimit = selected.size >= MAX_INTERESTS;
                const disabled = !isSelected && atLimit;
                const emoji = emojiFor(interest.name);
                return (
                  <TouchableOpacity
                    key={interest.id}
                    style={[
                      styles.chip,
                      isSelected && { backgroundColor: lime, borderColor: lime },
                      disabled && { opacity: 0.35 },
                    ]}
                    onPress={() => toggleInterest(interest.id)}
                    activeOpacity={0.75}
                    disabled={disabled}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected ? styles.chipTextSelected : { color: accentColor },
                      ]}
                    >
                      {emoji ? `${emoji} ` : ''}{interest.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.selectionHint}>
          {selected.size === 0
            ? `Select at least 1 interest (up to ${MAX_INTERESTS})`
            : `${selected.size}/${MAX_INTERESTS} selected`}
        </Text>
        <AppButton
          title="Continue"
          onPress={handleContinue}
          loading={saving}
          disabled={selected.size === 0}
          style={{ ...styles.continueBtn, backgroundColor: accentColor }}
        />
      </View>

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => setAlert(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  headerBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  categoryBlock: {
    marginBottom: 22,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: { color: Colors.text, fontWeight: '600' },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: Colors.background,
  },
  selectionHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  continueBtn: {
    borderRadius: 14,
  },
});
