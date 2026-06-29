import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingStackParamList } from '../../types/navigation';
import { datingApi, InterestCategory } from '../../api/dating';
import AppAlert from '../../components/common/AppAlert';
import AppButton from '../../components/common/AppButton';
import { Colors } from '../../utils/colors';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingInterestSelection'>;

const MAX_INTERESTS = 5;

export default function DatingInterestSelectionScreen({ navigation, route }: Props) {
  const { datingType } = route.params;
  const accentColor = datingType === 'Spiritual' ? Colors.spiritual : Colors.dating;
  const accentLight = datingType === 'Spiritual' ? Colors.spiritualLight : Colors.datingLight;

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
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: accentColor }]}>Your Interests</Text>
        <Text style={styles.headerSub}>
          Choose the things you love (up to {MAX_INTERESTS}). We'll use these to find your best matches.
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
                return (
                  <TouchableOpacity
                    key={interest.id}
                    style={[
                      styles.chip,
                      isSelected && { backgroundColor: accentColor, borderColor: accentColor },
                      !isSelected && { backgroundColor: accentLight, borderColor: accentColor },
                      disabled && { opacity: 0.35 },
                    ]}
                    onPress={() => toggleInterest(interest.id)}
                    activeOpacity={0.75}
                    disabled={disabled}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected ? { color: Colors.white } : { color: accentColor },
                      ]}
                    >
                      {interest.name}
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

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  categoryBlock: {
    marginBottom: 20,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
