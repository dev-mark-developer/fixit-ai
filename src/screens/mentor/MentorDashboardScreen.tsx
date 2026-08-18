import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MentorStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import RemoteImage from '../../components/common/RemoteImage';
import { mentorApi, AssignedUser } from '../../api/mentor';
import AppAlert from '../../components/common/AppAlert';

type AssignedTab = 'All' | 'Active' | 'Completed';
const TABS: AssignedTab[] = ['All', 'Active', 'Completed'];

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

export default function MentorDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MentorStackParamList>>();
  const [tab, setTab] = useState<AssignedTab>('All');
  const [users, setUsers] = useState<AssignedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<{ id: number; status: 'Completed' | 'Removed' } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ user: AssignedUser; status: 'Completed' | 'Removed' } | null>(null);

  useFocusEffect(useCallback(() => {
    mentorApi.getSubscription()
      .then((res) => {
        const sub = res.data?.data;
        setHasSubscription(!!sub && !sub.isExpired);
      })
      .catch(() => setHasSubscription(false));
  }, []));

  const loadUsers = async (which: AssignedTab, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await mentorApi.getAssignedUsers(which === 'All' ? {} : { status: which });
      setUsers(res.data?.data ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadUsers(tab); }, [tab]);

  const requestUpdate = (user: AssignedUser, status: 'Completed' | 'Removed') =>
    setConfirmModal({ user, status });

  const performUpdate = async (user: AssignedUser, status: 'Completed' | 'Removed') => {
    setConfirmModal(null);
    setActiveAction({ id: user.assignmentId, status });
    try {
      await mentorApi.updateAssignmentStatus(user.assignmentId, status);
      setUsers((prev) => prev.filter((u) => u.assignmentId !== user.assignmentId));
    } catch (err: any) {
      setAlert({ title: 'Error', message: err.response?.data?.message ?? 'Action failed. Please try again.' });
    } finally {
      setActiveAction(null);
    }
  };

  const renderUser = ({ item }: { item: AssignedUser }) => {
    const busy = activeAction?.id === item.assignmentId;
    const isCompleted = item.status === 'Completed' || tab === 'Completed';
    return (
      <View style={styles.userCard}>
        {item.profileImageUrl ? (
          <RemoteImage
            uri={item.profileImageUrl}
            style={styles.userAvatar}
            indicatorColor={Colors.mentor}
          />
        ) : (
          <View style={[styles.userAvatar, styles.userAvatarFallback]}>
            <Text style={styles.userAvatarText}>{item.firstName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.userDate}>Assigned: {formatDate(item.assignedAt)}</Text>
          {!isCompleted && (
            <TouchableOpacity onPress={() => requestUpdate(item, 'Removed')} disabled={busy}>
              <Text style={styles.removeLink}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>

        {busy ? (
          <ActivityIndicator color={Colors.mentor} size="small" />
        ) : (
          <TouchableOpacity
            style={[styles.checkBtn, isCompleted && styles.checkBtnDone]}
            onPress={() => !isCompleted && requestUpdate(item, 'Completed')}
            disabled={isCompleted}
          >
            <Icon name="checkmark" size={20} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── No subscription gate ───────────────────────────────────
  if (hasSubscription === false) {
    return (
      <View style={styles.noSubRoot}>
        <Image source={require('../../assets/crown.png')} style={styles.noSubImage} resizeMode="contain" />
        <Text style={styles.noSubTitle}>Subscription Required</Text>
        <Text style={styles.noSubMessage}>
          Activate your Mentor Plan to start receiving seeker assignments.
        </Text>
        <TouchableOpacity
          style={styles.noSubBtn}
          onPress={() => navigation.navigate('MentorSubscription')}
          activeOpacity={0.8}
        >
          <Text style={styles.noSubBtnText}>Activate Subscription</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (navigation as any).openDrawer?.()} hitSlop={8}>
          <Icon name="menu" size={26} color={Colors.mentor} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} hitSlop={8}>
          <Icon name="notifications-outline" size={24} color={Colors.mentor} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.mentor} size="large" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.assignmentId.toString()}
          extraData={activeAction}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadUsers(tab, true); }}
              tintColor={Colors.mentor}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Image source={require('../../assets/noActiveUser.png')} style={styles.emptyImage} resizeMode="contain" />
              <Text style={styles.emptyTitle}>No Active Users</Text>
              <Text style={styles.emptyText}>
                You don't have any assigned seekers yet. New assignments will
                appear here.
              </Text>
            </View>
          }
        />
      )}

      {/* Are You Sure confirm modal */}
      <Modal
        visible={!!confirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Are You Sure?</Text>
              <TouchableOpacity onPress={() => setConfirmModal(null)} hitSlop={8}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalMessage}>
              {confirmModal?.status === 'Removed'
                ? `Remove ${confirmModal?.user.firstName} ${confirmModal?.user.lastName} from your seekers? This can't be undone.`
                : `Mark ${confirmModal?.user.firstName} ${confirmModal?.user.lastName} as completed? They'll move to your Completed list.`}
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setConfirmModal(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={() => confirmModal && performUpdate(confirmModal.user, confirmModal.status)}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },

  tabs: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.textMuted,
  },
  tabActive: { backgroundColor: Colors.mentor },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.white },
  tabTextActive: { color: Colors.white, fontWeight: '700' },

  list: { padding: 16, paddingTop: 8 },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  userAvatar: { width: 46, height: 46, borderRadius: 23 },
  userAvatarFallback: { backgroundColor: Colors.mentor, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 18, fontWeight: '700', color: Colors.white },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  userDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  removeLink: { fontSize: 12, fontWeight: '600', color: Colors.error, marginTop: 4 },

  checkBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBtnDone: { opacity: 0.55 },

  emptyList: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  emptyImage: { width: 220, height: 160, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },

  noSubRoot: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  noSubImage: { width: 90, height: 90, marginBottom: 16 },
  noSubTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  noSubMessage: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: 28,
  },
  noSubBtn: { backgroundColor: Colors.mentor, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  noSubBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  // Confirm modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 22,
    width: '100%', maxWidth: 360,
  },
  modalHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalClose: { fontSize: 18, color: Colors.text },
  modalMessage: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: 24 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalCancelBtn: { backgroundColor: '#C6D63C' },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  modalConfirmBtn: { backgroundColor: Colors.mentor },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
