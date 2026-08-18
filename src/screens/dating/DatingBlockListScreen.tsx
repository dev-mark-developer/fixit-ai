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
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DatingDrawerParamList, DatingStackParamList } from '../../types/navigation';
import { datingApi } from '../../api/dating';
import AppAlert from '../../components/common/AppAlert';
import { Colors } from '../../utils/colors';
import RemoteImage from '../../components/common/RemoteImage';

type Props = CompositeScreenProps<
  DrawerScreenProps<DatingDrawerParamList, 'DatingBlockList'>,
  NativeStackScreenProps<DatingStackParamList>
>;

interface BlockedUser {
  blockedId: number;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  blockedAt: string;
}

export default function DatingBlockListScreen(_props: Props) {
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblocking, setUnblocking] = useState<number | null>(null);

  // Confirmation alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [pendingUnblock, setPendingUnblock] = useState<BlockedUser | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await datingApi.getBlocks();
      setBlocked(res.data?.data ?? []);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmUnblock = (user: BlockedUser) => {
    setPendingUnblock(user);
    setAlertVisible(true);
  };

  const doUnblock = async () => {
    if (!pendingUnblock) return;
    setUnblocking(pendingUnblock.blockedId);
    try {
      await datingApi.unblock(pendingUnblock.blockedId);
      setBlocked((prev) => prev.filter((u) => u.blockedId !== pendingUnblock.blockedId));
    } catch {
      // fail silently
    } finally {
      setUnblocking(null);
      setPendingUnblock(null);
    }
  };

  const renderItem = ({ item }: { item: BlockedUser }) => {
    const initials = item.firstName.charAt(0).toUpperCase();
    const isProcessing = unblocking === item.blockedId;

    return (
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          {item.profileImageUrl ? (
            <RemoteImage uri={item.profileImageUrl} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
        </View>

        <View style={styles.rowContent}>
          <Text style={styles.name}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.blockedAt}>
            Blocked {new Date(item.blockedAt).toLocaleDateString()}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.unblockBtn, isProcessing && styles.unblockBtnDisabled]}
          activeOpacity={0.7}
          disabled={isProcessing}
          onPress={() => confirmUnblock(item)}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.unblockText}>Unblock</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.dating} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={blocked}
        keyExtractor={(u) => String(u.blockedId)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Colors.dating}
            colors={[Colors.dating]}
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

      <AppAlert
        visible={alertVisible}
        title="Unblock User"
        message={
          pendingUnblock
            ? `Unblock ${pendingUnblock.firstName} ${pendingUnblock.lastName}? They will be able to see your profile again.`
            : ''
        }
        buttons={[
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unblock', style: 'destructive', onPress: doUnblock },
        ]}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  listHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  listHeaderTitle: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  listHeaderSub: { fontSize: 14, color: Colors.textSecondary },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  avatarWrap: { marginRight: 14 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: Colors.textSecondary },

  rowContent: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  blockedAt: { fontSize: 12, color: Colors.textMuted },

  unblockBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    minWidth: 80,
    alignItems: 'center',
  },
  unblockBtnDisabled: { opacity: 0.5 },
  unblockText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 84 },

  emptyContainer: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
});
