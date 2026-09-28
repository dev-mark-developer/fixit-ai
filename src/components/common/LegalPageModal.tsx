import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RenderHTML, { MixedStyleRecord } from '@native-html/render';
import { contentApi, ContentPage, ContentPageSlug } from '../../api/content';
import { Colors } from '../../utils/colors';
import { extractApiError } from '../../utils/apiError';

/** Shown in the header while the page loads, before the API's own title. */
const FALLBACK_TITLES: Record<ContentPageSlug, string> = {
  'terms-and-conditions': 'Terms & Conditions',
  'privacy-policy': 'Privacy Policy',
  'user-guidelines': 'User Guidelines',
};

/**
 * Loaded once per app session — the text rarely changes and every menu that
 * links to it would otherwise refetch on each open.
 */
const cache = new Map<ContentPageSlug, ContentPage>();

interface Props {
  /** Which page to show; null keeps the modal closed. */
  slug: ContentPageSlug | null;
  onClose: () => void;
  /** The calling module's colour, for links and the Close button. */
  accent?: string;
}

/**
 * Terms & Conditions, Privacy Policy and User Guidelines, as edited in the
 * admin panel (`GET /content/pages/{slug}`), rendered from their HTML.
 */
export default function LegalPageModal({ slug, onClose, accent = Colors.primary }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState<ContentPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (which: ContentPageSlug) => {
    const cached = cache.get(which);
    if (cached) {
      setPage(cached);
      setError(null);
      return;
    }
    setPage(null);
    setError(null);
    setLoading(true);
    try {
      const res = await contentApi.getPage(which);
      const loaded = res.data.data;
      cache.set(which, loaded);
      setPage(loaded);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (slug) load(slug);
  }, [slug, load]);

  // The page on screen must be the one asked for — never the previous slug's
  // while the new one loads.
  const shown = page && page.slug === slug ? page : null;
  const title = shown?.title ?? (slug ? FALLBACK_TITLES[slug] : '');

  const tagsStyles: MixedStyleRecord = {
    body: { color: Colors.text, fontSize: 14, lineHeight: 22 },
    p: { marginTop: 0, marginBottom: 12 },
    h2: { fontSize: 17, fontWeight: '800', color: Colors.text, marginTop: 12, marginBottom: 8 },
    h3: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 8, marginBottom: 6 },
    ul: { marginTop: 0, marginBottom: 12, paddingLeft: 18 },
    li: { marginBottom: 4 },
    em: { color: Colors.textMuted },
    a: { color: accent, textDecorationLine: 'underline' },
  };

  return (
    // Translucent on Android too, so the safe-area padding below means the same
    // thing on both platforms instead of doubling up under the status bar.
    <Modal
      visible={slug !== null}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {shown ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <RenderHTML
              contentWidth={width - 40}
              source={{ html: shown.bodyHtml }}
              tagsStyles={tagsStyles}
              classesStyles={CLASSES_STYLES}
            />
          </ScrollView>
        ) : (
          <View style={styles.center}>
            {loading || !error ? (
              <ActivityIndicator size="large" color={accent} />
            ) : (
              <>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={[styles.retryBtn, { borderColor: accent }]}
                  onPress={() => slug && load(slug)}
                >
                  <Text style={[styles.retryText, { color: accent }]}>Try Again</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: accent, marginBottom: 20 + insets.bottom }]}
          onPress={onClose}
        >
          <Text style={styles.doneText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const CLASSES_STYLES: MixedStyleRecord = {
  lead: { fontSize: 15, color: Colors.textSecondary },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { flex: 1, marginRight: 12, fontSize: 18, fontWeight: '800', color: Colors.text },
  closeText: { fontSize: 18, color: Colors.text },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  retryBtn: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontSize: 14, fontWeight: '600' },
  doneBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  doneText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
