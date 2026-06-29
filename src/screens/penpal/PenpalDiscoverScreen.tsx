import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  TextInput, ActivityIndicator,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalDrawerParamList, PenpalStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { penpalApi, PenpalDiscoverItem } from '../../api/penpal';
import ReportModal from '../../components/common/ReportModal';

type Props = CompositeScreenProps<
  DrawerScreenProps<PenpalDrawerParamList, 'PenpalDiscover'>,
  NativeStackScreenProps<PenpalStackParamList>
>;

export default function PenpalDiscoverScreen(_props: Props) {
  const [items, setItems] = useState<PenpalDiscoverItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState<number | null>(null);
  const [reportUserId, setReportUserId] = useState<number | null>(null);

  const load = async (searchTerm: string) => {
    setLoading(true);
    try {
      const res = await penpalApi.discover({ search: searchTerm || undefined, page: 1, pageSize: 20 });
      setItems(res.data?.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(''); }, []);

  const handleConnect = async (userId: number) => {
    setConnecting(userId);
    try {
      await penpalApi.sendConnection(userId);
      setItems((prev) => prev.filter((i) => i.userId !== userId));
      Alert.alert('Request Sent!', 'Your connection request has been sent.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not send request.');
    } finally {
      setConnecting(null);
    }
  };

  const renderItem = ({ item }: { item: PenpalDiscoverItem }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.pseudoName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.pseudoName}>{item.pseudoName}</Text>
        {item.firstName && (
          <Text style={styles.realName}>{item.firstName} {item.lastName}</Text>
        )}
        <Text style={styles.meta}>
          {item.letterType === 'Physical' ? '📮' : '💻'} {item.letterType}
          {(item.city || item.country)
            ? ` · 📍 ${[item.city, item.country].filter(Boolean).join(', ')}`
            : ''}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.connectBtn}
          onPress={() => handleConnect(item.userId)}
          disabled={connecting === item.userId}
        >
          {connecting === item.userId
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={styles.connectBtnText}>Connect</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.reportFlag} onPress={() => setReportUserId(item.userId)}>
          <Text style={styles.reportFlagText}>🚩</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ReportModal
        visible={reportUserId !== null}
        reportedUserId={reportUserId ?? 0}
        module="Penpal"
        onClose={() => setReportUserId(null)}
      />

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by pen name..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(search)}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); load(''); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.userId.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🌍</Text>
              <Text style={styles.emptyText}>No penpals found</Text>
              <Text style={styles.emptySubtext}>Try a different search or check back later</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? <ActivityIndicator color={Colors.primary} style={{ padding: 24 }} /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    margin: 16, borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, height: 46, fontSize: 15, color: Colors.text },
  clearBtn: { fontSize: 16, color: Colors.textMuted, paddingHorizontal: 4 },
  list: { padding: 16, paddingTop: 0 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: Colors.white },
  cardInfo: { flex: 1, marginLeft: 12 },
  pseudoName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  realName: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  meta: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  cardActions: { flexDirection: 'column', alignItems: 'center', gap: 6 },
  reportFlag: { padding: 4 },
  reportFlagText: { fontSize: 16 },
  connectBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.primary, minWidth: 76, alignItems: 'center',
  },
  connectBtnText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptySubtext: { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
});
