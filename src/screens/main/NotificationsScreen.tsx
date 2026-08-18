import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../utils/colors';
import { useModuleStatus } from '../../store/ModuleStatusContext';
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

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just Now';
  if (diffMins < 60) return `${diffMins} Mins Ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} Hour${diffHrs > 1 ? 's' : ''} Ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays} Day${diffDays > 1 ? 's' : ''} Ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { datingType } = useModuleStatus();

  // Active-pill / dot accent per module (dating follows the chosen path)
  const TAB_COLOR: Record<Module, string> = {
    Dating: datingType === 'Spiritual' ? Colors.spiritual : Colors.dating,
    Penpal: Colors.penpal,
    Mentor: Colors.mentor,
  };

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

  // Card (Figma): white rounded card with unread dot + message,
  // timestamp below the card aligned right
  const renderItem = ({ item }: { item: Notification }) => (
    <View style={styles.notifBlock}>
      <TouchableOpacity
        style={styles.notifCard}
        onPress={() => handleToggleRead(item.id, item.isRead)}
        activeOpacity={0.75}
      >
        {!item.isRead && (
          <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />
        )}
        <Text style={styles.notifText}>
          {item.title ? `${item.title}${item.body ? ' — ' : ''}` : ''}
          {item.body}
        </Text>
      </TouchableOpacity>
      <Text style={styles.notifTime}>{formatTime(item.createdAt)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Back arrow + title (Figma) */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() && navigation.goBack()}
          hitSlop={8}
        >
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>
      <Text style={styles.heading}>Notifications</Text>

      {/* Pill tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabPill,
                isActive ? { backgroundColor: TAB_COLOR[tab] } : styles.tabPillInactive,
              ]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={styles.tabPillText}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
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
              <Icon name="notifications-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySubtitle}>You're all caught up on {activeTab} notifications.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  headerBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },

  tabRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tabPill: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 18,
  },
  tabPillInactive: { backgroundColor: '#BDBDBD' },
  tabPillText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  listContent: { paddingHorizontal: 16, paddingBottom: 30 },
  emptyContainer: { flexGrow: 1 },

  notifBlock: { marginBottom: 14 },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  notifText: { flex: 1, fontSize: 15, color: Colors.text, lineHeight: 22 },
  notifTime: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 8,
    marginRight: 4,
  },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 6, marginTop: 14 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
});
