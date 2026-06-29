import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Colors } from '../../utils/colors';
import api from '../../api/axios';

type Module = 'Dating' | 'Penpal' | 'Mentor';

interface Notification {
  id: number;
  title: string;
  body: string;
  module: Module;
  isRead: boolean;
  createdAt: string;
}

const TABS: Module[] = ['Dating', 'Penpal', 'Mentor'];

const TAB_COLOR: Record<Module, string> = {
  Dating: Colors.dating,
  Penpal: Colors.penpal,
  Mentor: Colors.mentor,
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function NotificationsScreen() {
  const [activeTab, setActiveTab] = useState<Module>('Dating');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async (mod: Module, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await api.get('/notifications', { params: { module: mod } });
      setNotifications(res.data?.data ?? []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(activeTab);
  }, [activeTab, fetchNotifications]);

  const handleToggleRead = async (id: number, isRead: boolean) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: !isRead } : n)),
    );
    try {
      await api.patch(`/notifications/${id}/toggle-read`);
    } catch {
      // revert on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead } : n)),
      );
    }
  };

  const accentColor = TAB_COLOR[activeTab];

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notifCard, item.isRead && styles.notifCardRead]}
      onPress={() => handleToggleRead(item.id, item.isRead)}
      activeOpacity={0.75}
    >
      <View style={[styles.unreadDot, { backgroundColor: item.isRead ? 'transparent' : accentColor }]} />
      <View style={styles.notifBody}>
        <Text style={[styles.notifTitle, item.isRead && styles.notifTitleRead]}>
          {item.title}
        </Text>
        <Text style={styles.notifMessage} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.notifTime}>{formatTime(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: TAB_COLOR[tab], borderBottomWidth: 2.5 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && { color: TAB_COLOR[tab], fontWeight: '700' }]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={accentColor} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchNotifications(activeTab, true); }}
              colors={[accentColor]}
              tintColor={accentColor}
            />
          }
          contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySubtitle}>You're all caught up on {activeTab} notifications.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  listContent: { paddingVertical: 8 },
  emptyContainer: { flexGrow: 1 },

  notifCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  notifCardRead: { backgroundColor: Colors.surface },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  notifBody: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  notifTitleRead: { fontWeight: '500', color: Colors.textSecondary },
  notifMessage: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 11, color: Colors.textMuted },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
});
