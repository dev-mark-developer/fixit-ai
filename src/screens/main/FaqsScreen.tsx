import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Colors } from '../../utils/colors';
import api from '../../api/axios';

interface FaqItem {
  id: number;
  question: string;
  answer: string;
}

interface FaqCategory {
  id: number;
  name: string;
  items: FaqItem[];
}

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.faqRow, open && styles.faqRowOpen]}
      onPress={() => setOpen((v) => !v)}
      activeOpacity={0.75}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, open && styles.faqQuestionOpen]}>
          {item.question}
        </Text>
        <Text style={[styles.faqChevron, open && styles.faqChevronOpen]}>
          {open ? '▲' : '▼'}
        </Text>
      </View>
      {open && (
        <Text style={styles.faqAnswer}>{item.answer}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function FaqsScreen() {
  const [categories, setCategories] = useState<FaqCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/faqs');
      setCategories(res.data.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load FAQs.</Text>
        <TouchableOpacity onPress={load} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Frequently Asked Questions</Text>
      <Text style={styles.pageSubtitle}>Tap a question to expand the answer.</Text>

      {categories.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.name}</Text>
          <View style={styles.sectionCard}>
            {section.items.map((item, idx) => (
              <View key={item.id}>
                <FaqRow item={item} />
                {idx < section.items.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.footer}>
        Can't find an answer? Contact us via the support form and we'll get back to you shortly.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  errorText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 10 },
  retryText: { color: Colors.white, fontWeight: '600', fontSize: 14 },

  pageTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  pageSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 24 },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  faqRow: { padding: 16 },
  faqRowOpen: { backgroundColor: Colors.primaryLight },
  faqHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text, lineHeight: 20, paddingRight: 8 },
  faqQuestionOpen: { color: Colors.primary },
  faqChevron: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  faqChevronOpen: { color: Colors.primary },
  faqAnswer: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginTop: 10 },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  footer: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
