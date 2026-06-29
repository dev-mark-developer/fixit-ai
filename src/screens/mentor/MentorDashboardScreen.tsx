import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MentorStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { mentorApi, AssignedUser } from '../../api/mentor';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';

type AssignedTab = 'Active' | 'Completed';

export default function MentorDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MentorStackParamList>>();
  const [tab, setTab] = useState<AssignedTab>('Active');
  const [users, setUsers] = useState<AssignedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<{ id: number; status: 'Completed' | 'Removed' } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [alert, setAlert] = useState<{ title: string; message: string; buttons?: AlertButton[] } | null>(null);
  const pendingAction = useRef<(() => Promise<void>) | null>(null);

  useFocusEffect(useCallback(() => {
    mentorApi.getSubscription()
      .then((res) => {
        const sub = res.data?.data;
        setHasSubscription(!!sub && !sub.isExpired);
      })
      .catch(() => setHasSubscription(false));
  }, []));

  const loadUsers = async (status: AssignedTab, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await mentorApi.getAssignedUsers({ status });
      setUsers(res.data?.data ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadUsers(tab); }, [tab]);

  const handleUpdateStatus = (user: AssignedUser, status: 'Completed' | 'Removed') => {
    const action = status === 'Completed' ? 'mark as completed' : 'remove';

    pendingAction.current = async () => {
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

    setAlert({
      title: status === 'Removed' ? 'Remove User' : 'Mark as Completed',
      message: `Are you sure you want to ${action} ${user.firstName} ${user.lastName}?`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'Removed' ? 'Remove' : 'Confirm',
          style: status === 'Removed' ? 'destructive' : 'default',
          onPress: () => pendingAction.current?.(),
        },
      ],
    });
  };

  const renderUser = ({ item }: { item: AssignedUser }) => {
    const isThisCard = activeAction?.id === item.assignmentId;
    const completingThis = isThisCard && activeAction?.status === 'Completed';
    const removingThis = isThisCard && activeAction?.status === 'Removed';
    const anyActionOnThis = completingThis || removingThis;
    return (
      <View style={styles.userCard}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{item.firstName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.userDate}>
            Assigned {new Date(item.assignedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        {tab === 'Active' && (
          <View style={styles.userActions}>
            <TouchableOpacity
              style={[styles.userActionBtn, styles.completeBtn]}
              onPress={() => handleUpdateStatus(item, 'Completed')}
              disabled={anyActionOnThis}
            >
              {completingThis
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.completeBtnText}>Done</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.userActionBtn, styles.removeBtn]}
              onPress={() => handleUpdateStatus(item, 'Removed')}
              disabled={anyActionOnThis}
            >
              {removingThis
                ? <ActivityIndicator color={Colors.error} size="small" />
                : <Text style={styles.removeBtnText}>Remove</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (hasSubscription === false) {
    return (
      <View style={styles.noSubRoot}>
        <Text style={styles.noSubIcon}>👑</Text>
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
    <>
      <View style={styles.root}>
        <View style={styles.tabs}>
          {(['Active', 'Completed'] as AssignedTab[]).map((t) => (
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
                <Text style={styles.emptyIcon}>{tab === 'Active' ? '👥' : '✅'}</Text>
                <Text style={styles.emptyListText}>
                  {tab === 'Active' ? 'No active assignments' : 'No completed assignments yet'}
                </Text>
              </View>
            }
          />
        )}
      </View>

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        buttons={alert?.buttons}
        onClose={() => setAlert(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noSubRoot: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  noSubIcon: { fontSize: 56, marginBottom: 16 },
  noSubTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  noSubMessage: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: 28,
  },
  noSubBtn: {
    backgroundColor: Colors.mentor, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  noSubBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2.5, borderColor: Colors.mentor },
  tabText: { fontSize: 15, color: Colors.textSecondary },
  tabTextActive: { color: Colors.mentor, fontWeight: '700' },
  list: { padding: 16 },
  emptyList: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyListText: { fontSize: 15, color: Colors.textSecondary },
  userCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  userAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.mentor, justifyContent: 'center', alignItems: 'center',
  },
  userAvatarText: { fontSize: 18, fontWeight: '700', color: Colors.white },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  userDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  userActions: { flexDirection: 'column', gap: 6 },
  userActionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, alignItems: 'center', minWidth: 62 },
  completeBtn: { backgroundColor: Colors.mentor },
  completeBtnText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  removeBtn: { borderWidth: 1, borderColor: Colors.error, backgroundColor: Colors.background },
  removeBtnText: { color: Colors.error, fontSize: 12, fontWeight: '600' },
});
