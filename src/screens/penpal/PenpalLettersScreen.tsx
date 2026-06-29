import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalDrawerParamList, PenpalStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { penpalApi, PenpalLetter } from '../../api/penpal';

type Props = CompositeScreenProps<
  DrawerScreenProps<PenpalDrawerParamList, 'PenpalLetters'>,
  NativeStackScreenProps<PenpalStackParamList>
>;
type Tab = 'Inbox' | 'Sent';

export default function PenpalLettersScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('Inbox');
  const [items, setItems] = useState<PenpalLetter[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLetters = async (direction: Tab) => {
    setLoading(true);
    try {
      const res = await penpalApi.getLetters({ direction });
      setItems(res.data?.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLetters(tab); }, [tab]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderItem = ({ item }: { item: PenpalLetter }) => {
    const displayName = tab === 'Inbox' ? item.senderPseudoName : item.receiverPseudoName;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('PenpalLetterDetail', { letterId: item.id })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.fromName}>{displayName}</Text>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.preview} numberOfLines={2}>{item.content}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(['Inbox', 'Sent'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'Inbox' ? '📥 Inbox' : '📤 Sent'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{tab === 'Inbox' ? '📭' : '✉️'}</Text>
              <Text style={styles.emptyText}>
                {tab === 'Inbox' ? 'No letters received yet' : 'No letters sent yet'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2.5, borderColor: Colors.primary },
  tabText: { fontSize: 15, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  list: { padding: 16 },
  card: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.primaryMuted, justifyContent: 'center', alignItems: 'center',
    marginRight: 12, flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: Colors.white },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  fromName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  date: { fontSize: 12, color: Colors.textMuted },
  title: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  preview: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
});
