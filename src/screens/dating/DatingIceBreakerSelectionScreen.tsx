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
import Icon from 'react-native-vector-icons/Ionicons';
import type { DatingStackParamList } from '../../types/navigation';
import { datingApi, IceBreakerQuestion } from '../../api/dating';
import AppAlert from '../../components/common/AppAlert';
import AppButton from '../../components/common/AppButton';
import { Colors } from '../../utils/colors';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingIceBreakerSelection'>;

const MAX_SELECTIONS = 3;

export default function DatingIceBreakerSelectionScreen({ navigation, route }: Props) {
  const { datingType, editMode } = route.params;
  const accentColor = datingType === 'Spiritual' ? Colors.spiritual : Colors.dating;

  const [questions, setQuestions] = useState<IceBreakerQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [qRes, profileRes] = await Promise.all([
          datingApi.getIceBreakers(),
          editMode ? datingApi.getProfile() : Promise.resolve(null),
        ]);
        setQuestions(qRes.data?.data ?? []);
        if (editMode && profileRes) {
          const ids: number[] = profileRes.data?.data?.iceBreakerQuestionIds ?? [];
          setSelected(new Set(ids));
        }
      } catch {
        setAlert({ title: 'Error', message: 'Could not load questions. Please try again.' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [editMode]);

  const toggle = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECTIONS) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await datingApi.setIceBreakers(Array.from(selected));
      if (editMode) {
        navigation.goBack();
      } else {
        navigation.navigate('DatingMain');
      }
    } catch {
      setAlert({ title: 'Error', message: 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (editMode) {
      navigation.goBack();
    } else {
      navigation.navigate('DatingMain');
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
      {/* Header (Figma: back arrow + "Configure Ice Breaker") */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : handleSkip())}
          hitSlop={8}
        >
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configure Ice Breaker</Text>
        <Text style={styles.headerSub}>
          Pick the questions that will start your conversations — matches can
          answer them as your Opening Move.
        </Text>
        <Text style={styles.headerCount}>
          You can select up to {MAX_SELECTIONS} question
        </Text>
      </View>

      <FlatList
        data={questions}
        keyExtractor={(q) => String(q.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          const atLimit = selected.size >= MAX_SELECTIONS;
          const disabled = !isSelected && atLimit;
          return (
            <TouchableOpacity
              style={[styles.questionRow, disabled && { opacity: 0.4 }]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.75}
              disabled={disabled}
            >
              <View style={[styles.checkbox, isSelected && { borderColor: accentColor }]}>
                {isSelected && <Icon name="checkmark" size={14} color={accentColor} />}
              </View>
              <Text style={styles.questionText}>{item.question}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.footer}>
        <Text style={styles.selectionHint}>
          {selected.size === 0
            ? `Select up to ${MAX_SELECTIONS} questions`
            : `${selected.size}/${MAX_SELECTIONS} selected`}
        </Text>
        <AppButton
          title={editMode ? 'Submit' : 'Submit'}
          onPress={handleSave}
          loading={saving}
          disabled={selected.size === 0}
          style={{ ...styles.continueBtn, backgroundColor: accentColor }}
        />
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} disabled={saving}>
          <Text style={styles.skipText}>{editMode ? 'Cancel' : 'Skip for now'}</Text>
        </TouchableOpacity>
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

  headerBar: { paddingHorizontal: 20, paddingTop: 8 },

  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  headerSub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 14 },
  headerCount: { fontSize: 16, fontWeight: '700', color: Colors.text },

  listContent: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4 },

  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 10,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },

  footer: {
    paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12,
    backgroundColor: Colors.background,
  },
  selectionHint: {
    fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', marginBottom: 12,
  },
  continueBtn: { borderRadius: 14 },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
});
