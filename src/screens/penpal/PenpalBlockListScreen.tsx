import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalStackParamList } from '../../types/navigation';
import { sharedApi } from '../../api/shared';
import AppAlert from '../../components/common/AppAlert';
import { Colors } from '../../utils/colors';
import RemoteImage from '../../components/common/RemoteImage';
import { loadBlockedUsers } from '../../utils/blockedUsers';
import { withPseudonyms, PenpalBlockedUser } from '../../utils/penpalBlocks';
import { parseApiDate } from '../../utils/datetime';
import { extractApiError } from '../../utils/apiError';

type Props = NativeStackScreenProps<PenpalStackParamList, 'PenpalBlockList'>;

/**
 * The account's one block list (`/blocks` is shared with Dating), shown with
 * pen names where this device knows them.
 */
export default function PenpalBlockListScreen({ navigation }: Props) {
  const [blocked, setBlocked] = useState<PenpalBlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblocking, setUnblocking] = useState<number | null>(null);
  const [pendingUnblock, setPendingUnblock] = useState<PenpalBlockedUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    // Through the shared loader, so the push filter's copy stays current too.
    const rows = await loadBlockedUsers();
    if (rows) setBlocked(await withPseudonyms(rows));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const doUnblock = async () => {
    const user = pendingUnblock;
    if (!user) return;
    setUnblocking(user.blockedId);
    try {
      await sharedApi.unblock(user.blockedId);
      setBlocked(prev => prev.filter(u => u.blockedId !== user.blockedId));
      loadBlockedUsers();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setUnblocking(null);
    }
  };

  const renderItem = ({ item }: { item: PenpalBlockedUser }) => {
    const isProcessing = unblocking === item.blockedId;
    return (
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          {item.profileImageUrl ? (
            <RemoteImage uri={item.profileImageUrl} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {item.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rowContent}>
          <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
          <Text style={styles.blockedAt}>
            Blocked {parseApiDate(item.blockedAt).toLocaleDateString()}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.unblockBtn, isProcessing && styles.unblockBtnDisabled]}
          activeOpacity={0.7}
          disabled={isProcessing}
          onPress={() => setPendingUnblock(item)}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={Colors.penpal} />
          ) : (
            <Text style={styles.unblockText}>Unblock</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.penpal} />
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={u => String(u.blockedId)}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.penpal}
              colors={[Colors.penpal]}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>Blocked Users</Text>
              <Text style={styles.listHeaderSub}>
                {blocked.length} {blocked.length === 1 ? 'person' : 'people'} blocked
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🚫</Text>
              <Text style={styles.emptyTitle}>No blocked users</Text>
              <Text style={styles.emptySub}>Users you block will appear here.</Text>
            </View>
          }
          contentContainerStyle={blocked.length === 0 ? styles.emptyContainer : undefined}
        />
      )}

      <AppAlert
        visible={!!pendingUnblock}
        title="Unblock User"
        message={
          pendingUnblock
            ? `Unblock ${pendingUnblock.displayName}? They will be able to find you again. Blocking removed them from your penpals, so you'll need to connect again to exchange letters.`
            : ''
        }
        buttons={[
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unblock', style: 'destructive', onPress: doUnblock },
        ]}
        onClose={() => setPendingUnblock(null)}
      />

      <AppAlert
        visible={!!error}
        title="Error"
        message={error ?? ''}
        onClose={() => setError(null)}
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backArrow: { fontSize: 24, color: Colors.text, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  listHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  listHeaderTitle: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  listHeaderSub: { fontSize: 14, color: Colors.textSecondary },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  avatarWrap: { marginRight: 14 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.penpal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: Colors.white },

  rowContent: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  blockedAt: { fontSize: 12, color: Colors.textMuted },

  unblockBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.penpal,
    minWidth: 80,
    alignItems: 'center',
  },
  unblockBtnDisabled: { opacity: 0.5 },
  unblockText: { fontSize: 13, fontWeight: '600', color: Colors.penpal },

  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 84 },

  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
});
