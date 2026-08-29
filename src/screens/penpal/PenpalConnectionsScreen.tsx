import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  PenpalDrawerParamList,
  PenpalStackParamList,
} from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { usePrefetchImages } from '../../utils/imageCache';
import RemoteImage, {
  RemoteImageBackground,
} from '../../components/common/RemoteImage';
import {
  penpalApi,
  PenpalConnection,
  PenpalConnectionStatus,
  PenpalDiscoverItem,
} from '../../api/penpal';
import { getUser } from '../../store/auth';
import ReportModal from '../../components/common/ReportModal';
import DisabilityBadge from '../../components/penpal/DisabilityBadge';

type Props = CompositeScreenProps<
  DrawerScreenProps<PenpalDrawerParamList, 'PenpalConnections'>,
  NativeStackScreenProps<PenpalStackParamList>
>;

type Tab = 'All' | 'Requests' | 'Connected';
const TABS: Tab[] = ['All', 'Requests', 'Connected'];

/**
 * All three tabs are one `/penpal/discover` call — the `status` param is the
 * only thing that differs. Requests and Connected used to hit
 * `/penpal/connections` instead, which returned a different shape and left the
 * two halves of the screen out of sync.
 *
 * All sends the param empty rather than `None`: `None` reads as "people you
 * have no connection with", which would hide everyone already connected or
 * pending from a tab whose whole job is to show everyone.
 */
const TAB_STATUS: Record<Tab, PenpalConnectionStatus> = {
  All: '',
  Requests: 'Pending',
  Connected: 'Accepted',
};

// Two cards per row: screen width − list padding (16×2) − gap (12), split in two.
const GRID_GAP = 12;
const CARD_W = (Dimensions.get('window').width - 32 - GRID_GAP) / 2;

const timeAgo = (dateStr: string) => {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day} day${day > 1 ? 's' : ''} ago`;
  if (hr > 0) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
  if (min > 0) return `${min} min${min > 1 ? 's' : ''} ago`;
  return 'just now';
};

/**
 * Fills in the connection row behind each Pending/Accepted person.
 *
 * Discover is the list; these are the fields the Requests tab acts on — the
 * connection id, and who sent the request. If discover already carries them
 * this never runs. It's a stopgap for a discover response that returns the
 * person but not the connection (gap #26); once the backend includes them the
 * whole function goes cold on its own.
 */
async function withConnectionMeta(
  items: PenpalDiscoverItem[],
  status: PenpalConnectionStatus,
  signal?: AbortSignal,
): Promise<PenpalDiscoverItem[]> {
  try {
    const res = await penpalApi.getConnections(
      { status, page: 1, pageSize: 100 },
      signal,
    );
    const conns: PenpalConnection[] = res.data?.data ?? [];
    // Keyed by both ends: the person in the list is whichever end isn't us.
    const byUserId = new Map<number, PenpalConnection>();
    conns.forEach(c => {
      byUserId.set(c.requesterId, c);
      byUserId.set(c.receiverId, c);
    });
    return items.map(p => {
      const c = byUserId.get(p.userId);
      if (!c) return p;
      return {
        ...p,
        connectionId: p.connectionId ?? c.id,
        requesterId: p.requesterId ?? c.requesterId,
        receiverId: p.receiverId ?? c.receiverId,
        connectionCreatedAt: p.connectionCreatedAt ?? c.createdAt,
      };
    });
  } catch {
    // Non-fatal: the list still renders, the action buttons just stay hidden.
    return items;
  }
}

export default function PenpalConnectionsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  // One list for all three tabs now that they share an endpoint.
  const [people, setPeople] = useState<PenpalDiscoverItem[]>([]);
  usePrefetchImages(people.map(p => p.profileImageUrl));
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  // Keyed by userId — the one id every tab's rows share.
  const [activeAction, setActiveAction] = useState<{
    userId: number;
    action: string;
  } | null>(null);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [reportUserId, setReportUserId] = useState<number | null>(null);
  const [reportName, setReportName] = useState<string>('');

  // Unified accept-confirm modal (digital + physical variants)
  const [confirmModal, setConfirmModal] = useState<{
    userId: number;
    connectionId: number;
    name: string;
    physical: boolean;
  } | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    getUser().then(u => setCurrentUserId(u?.id ?? null));
  }, []);

  // A tab switch or a keystroke supersedes whatever is still running. Without
  // this they pile up on one connection, and a stale response can land last
  // and overwrite the list the user is actually looking at.
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  const load = async (which: Tab, searchTerm = '') => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    const status = TAB_STATUS[which];
    setLoading(true);
    try {
      const res = await penpalApi.discover(
        {
          search: searchTerm || undefined,
          status,
          page: 1,
          pageSize: 20,
        },
        controller.signal,
      );
      const items: PenpalDiscoverItem[] = res.data?.data ?? [];
      // Only the two connection tabs need the connection row, and only when
      // discover didn't already supply it.
      const withMeta =
        which !== 'All' && items.some(p => p.connectionId === undefined)
          ? await withConnectionMeta(items, status, controller.signal)
          : items;
      if (controller.signal.aborted) return;
      setPeople(withMeta);
    } catch {
      // An abort isn't a failure — a newer load owns the list now.
      if (!controller.signal.aborted) setPeople([]);
    } finally {
      // Only the newest load may clear the spinner; an aborted one bowing out
      // would otherwise turn it off while its replacement is still running.
      if (inFlight.current === controller) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  };

  // Reload the active tab whenever it changes AND whenever the screen
  // regains focus (e.g. returning from a public profile after accepting,
  // declining or removing a connection).
  useFocusEffect(
    useCallback(() => {
      load(tab, search);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]),
  );

  // Live search: refetch (debounced) as the user types. Every tab now goes
  // through discover, which takes `search`, so this is no longer All-only.
  const searchMounted = useRef(false);
  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true; // focus effect covers the initial load
      return;
    }
    const timer = setTimeout(() => load(tab, search), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Actions ────────────────────────────────────────────────
  const handleConnect = async (userId: number) => {
    setConnectingId(userId);
    try {
      await penpalApi.sendConnection(userId);
      // Keep the row in place and flip its button to Pending — dropping the
      // person out of the list reads as if the request failed.
      setPeople(prev =>
        prev.map(p => (p.userId === userId ? { ...p, connectionStatus: 'Pending' } : p)),
      );
      Alert.alert('Request Sent!', 'Your connection request has been sent.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not send request.');
    } finally {
      setConnectingId(null);
    }
  };

  const handleRespond = async (
    userId: number,
    connectionId: number,
    status: 'Accepted' | 'Declined',
  ) => {
    setConfirmModal(null);
    setActiveAction({ userId, action: status });
    try {
      await penpalApi.respondConnection(connectionId, status);
      // Either answer takes the person out of Pending, which is this tab.
      setPeople(prev => prev.filter(p => p.userId !== userId));
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Action failed.');
    } finally {
      setActiveAction(null);
    }
  };

  const handleAccept = (item: PenpalDiscoverItem, connectionId: number) => {
    setConsentChecked(false);
    setConfirmModal({
      userId: item.userId,
      connectionId,
      name: item.pseudoName,
      // `letterType` is the other person's — they're the one who'd receive
      // the address, same as the old `requesterLetterType`.
      physical: item.letterType === 'Physical',
    });
  };

  const handleCancel = (userId: number, connectionId: number) => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this connection request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            setActiveAction({ userId, action: 'Cancel' });
            try {
              await penpalApi.cancelConnection(connectionId);
              setPeople(prev => prev.filter(p => p.userId !== userId));
            } catch (err: any) {
              Alert.alert(
                'Error',
                err.response?.data?.message ?? 'Could not cancel request.',
              );
            } finally {
              setActiveAction(null);
            }
          },
        },
      ],
    );
  };

  // ── Navigation helpers ─────────────────────────────────────
  // All three tabs hold discover items now, so one helper covers them. The
  // Requests/Connected rows gained identityVisibility, country and age this
  // way — the connections response never carried them.
  const openDiscoverProfile = (p: PenpalDiscoverItem) =>
    navigation.navigate('PenpalPublicProfile', {
      userId: p.userId,
      pseudoName: p.pseudoName,
      letterType: p.letterType,
      identityVisibility: p.identityVisibility,
      city: p.city,
      state: p.state,
      country: p.country,
      firstName: p.firstName,
      lastName: p.lastName,
      profileImageUrl: p.profileImageUrl,
      age: p.age,
    });

  // ── Renderers ──────────────────────────────────────────────
  const renderPerson = ({ item }: { item: PenpalDiscoverItem }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => openDiscoverProfile(item)}
    >
      <View style={styles.rowAvatarWrap}>
        {item.profileImageUrl ? (
          <RemoteImage uri={item.profileImageUrl} style={styles.rowAvatar} />
        ) : (
          <View style={[styles.rowAvatar, styles.rowAvatarFallback]}>
            <Text style={styles.rowAvatarText}>
              {item.pseudoName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <DisabilityBadge identityVisibility={item.identityVisibility} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.pseudoName}
        </Text>
      </View>
      {/* connectionStatus now comes from the discover API (gap #1 resolved) */}
      {item.connectionStatus?.toLowerCase() === 'accepted' ? (
        <View style={[styles.connectBtn, styles.connectedBadge]}>
          <Text style={styles.connectBtnText}>Connected</Text>
        </View>
      ) : item.connectionStatus?.toLowerCase() === 'pending' ? (
        <View style={[styles.connectBtn, styles.pendingBadge]}>
          <Text style={styles.connectBtnText}>Pending</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.connectBtn}
          onPress={() => handleConnect(item.userId)}
          disabled={connectingId === item.userId}
        >
          {connectingId === item.userId ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.connectBtnText}>Connect</Text>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderRequest = ({ item }: { item: PenpalDiscoverItem }) => {
    // Which way the request points decides Accept/Decline vs Cancel. Read from
    // whichever end discover gives us; if it gives neither, treat it as
    // incoming — the common case, since an outgoing request is one the user
    // just sent themselves.
    const isIncoming =
      item.receiverId !== undefined
        ? item.receiverId === currentUserId
        : item.requesterId === undefined || item.requesterId !== currentUserId;
    const connectionId = item.connectionId;
    const sentAt = item.connectionCreatedAt ?? item.createdAt;
    const busy = activeAction?.userId === item.userId;

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.8}
        onPress={() => openDiscoverProfile(item)}
      >
        <View style={styles.rowAvatarWrap}>
          {item.profileImageUrl ? (
            <RemoteImage uri={item.profileImageUrl} style={styles.rowAvatar} />
          ) : (
            <View style={[styles.rowAvatar, styles.rowAvatarFallback]}>
              <Text style={styles.rowAvatarText}>
                {item.pseudoName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <DisabilityBadge identityVisibility={item.identityVisibility} />
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.pseudoName}
          </Text>
          {!!sentAt && <Text style={styles.rowMeta}>{timeAgo(sentAt)}</Text>}
        </View>

        {/* No connection id means nothing can be acted on — better a row with
            no buttons than buttons that fail on tap. */}
        {busy ? (
          <ActivityIndicator color={Colors.penpal} size="small" />
        ) : connectionId === undefined ? null : isIncoming ? (
          <View style={styles.reqActions}>
            <TouchableOpacity
              style={[styles.circleBtn, styles.circleDecline]}
              onPress={() => handleRespond(item.userId, connectionId, 'Declined')}
            >
              <Text style={styles.circleGlyph}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.circleBtn, styles.circleAccept]}
              onPress={() => handleAccept(item, connectionId)}
            >
              <Text style={styles.circleGlyph}>✓</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.cancelPill}
            onPress={() => handleCancel(item.userId, connectionId)}
          >
            <Text style={styles.cancelPillText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderConnected = ({ item }: { item: PenpalDiscoverItem }) => {
    const otherName = item.pseudoName;
    const otherId = item.userId;
    const otherImageUrl = item.profileImageUrl;
    const isPhysical = item.letterType === 'Physical';

    const CardOverlay = (
      <>
        {/* Top-left: report */}
        <TouchableOpacity
          style={[styles.iconBtn, styles.iconBtnTL]}
          onPress={() => {
            setReportUserId(otherId);
            setReportName(otherName);
          }}
        >
          <Image
            source={require('../../assets/flag.png')}
            style={[styles.iconImg, { tintColor: Colors.penpal }]}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Top-right: write (digital penpals only) */}
        {!isPhysical && (
          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnTR]}
            onPress={() =>
              navigation.navigate('PenpalCompose', {
                receiverId: otherId,
                receiverPseudoName: otherName,
              })
            }
          >
            <Image
              source={require('../../assets/letter.png')}
              style={styles.iconImg}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}

        {/* Bottom-left: name */}
        <Text style={styles.photoName} numberOfLines={1}>
          {otherName}
        </Text>
      </>
    );

    return (
      <TouchableOpacity
        style={styles.photoCard}
        activeOpacity={0.9}
        onPress={() => openDiscoverProfile(item)}
      >
        {otherImageUrl ? (
          <RemoteImageBackground
            uri={otherImageUrl}
            style={styles.photoBg}
            imageStyle={styles.photoBgImage}
          >
            {CardOverlay}
          </RemoteImageBackground>
        ) : (
          <View style={[styles.photoBg, styles.photoFallback]}>
            <Text style={styles.photoFallbackText}>
              {otherName.charAt(0).toUpperCase()}
            </Text>
            {CardOverlay}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Instant client-side filter while the debounced server search is in flight
  // (also covers servers that ignore the search param). One list, so this now
  // covers all three tabs.
  const q = search.trim().toLowerCase();
  const filteredPeople = q
    ? people.filter(p =>
        [p.pseudoName, p.firstName, p.lastName]
          .filter(Boolean)
          .some(n => (n as string).toLowerCase().includes(q)),
      )
    : people;

  const rootNav = navigation.getParent()?.getParent();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Custom header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} hitSlop={8}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('PenpalEntry')}
            hitSlop={8}
          >
            <Text style={styles.headerIcon}>ⓘ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => rootNav?.navigate('Notifications' as never)}
            hitSlop={8}
            style={{ marginLeft: 16 }}
          >
            <Icon name="notifications-outline" size={24} color={Colors.penpal} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.title}>
        Find a <Text style={styles.titleAccent}>Kindred Spirit</Text>
      </Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search people here....."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => tab === 'All' && load('All', search)}
          returnKeyType="search"
        />
        <Image
          source={require('../../assets/search.png')}
          style={styles.searchIcon}
          resizeMode="contain"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.penpal} size="large" />
        </View>
      ) : tab === 'All' ? (
        <FlatList
          data={filteredPeople}
          keyExtractor={item => item.userId.toString()}
          extraData={connectingId}
          renderItem={renderPerson}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState image text="No penpals found" />
          }
        />
      ) : tab === 'Requests' ? (
        <FlatList
          data={filteredPeople}
          keyExtractor={item => item.userId.toString()}
          extraData={activeAction}
          renderItem={renderRequest}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState image text="No pending requests" />
          }
        />
      ) : (
        <FlatList
          key="connected-grid"
          data={filteredPeople}
          keyExtractor={item => item.userId.toString()}
          renderItem={renderConnected}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              image
              text="No connections yet"
              subtext="Discover penpals and send connection requests!"
            />
          }
        />
      )}

      <ReportModal
        visible={reportUserId !== null}
        reportedUserId={reportUserId ?? 0}
        module="Penpal"
        reportedName={reportName}
        onClose={() => setReportUserId(null)}
      />

      {/* Accept-confirm modal (digital + physical) */}
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
            {confirmModal?.physical ? (
              <TouchableOpacity
                style={styles.consentRow}
                activeOpacity={0.7}
                onPress={() => setConsentChecked(v => !v)}
              >
                <View
                  style={[
                    styles.checkbox,
                    consentChecked && styles.checkboxChecked,
                  ]}
                >
                  {consentChecked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.consentText}>
                  By accepting this request,{' '}
                  <Text style={styles.modalName}>{confirmModal?.name}</Text> will
                  be able to see your physical mailing address. Are you sure you
                  want to proceed?
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.modalMessage}>
                Are you sure you want to add{' '}
                <Text style={styles.modalName}>{confirmModal?.name}</Text> to your
                friends list?
              </Text>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setConfirmModal(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalConfirmBtn,
                  confirmModal?.physical &&
                    !consentChecked &&
                    styles.modalConfirmDisabled,
                ]}
                disabled={!!confirmModal?.physical && !consentChecked}
                onPress={() =>
                  confirmModal &&
                  handleRespond(
                    confirmModal.userId,
                    confirmModal.connectionId,
                    'Accepted',
                  )
                }
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function EmptyState({
  icon,
  image,
  text,
  subtext,
}: {
  icon?: string;
  image?: boolean;
  text: string;
  subtext?: string;
}) {
  return (
    <View style={styles.empty}>
      {image ? (
        <Image
          source={require('../../assets/notfound.png')}
          style={styles.emptyImage}
          resizeMode="contain"
        />
      ) : (
        <Text style={styles.emptyIcon}>{icon}</Text>
      )}
      <Text style={styles.emptyText}>{text}</Text>
      {subtext && <Text style={styles.emptySubtext}>{subtext}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  menuIcon: { fontSize: 24, color: Colors.penpal, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { fontSize: 20, color: Colors.text },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  titleAccent: { color: Colors.penpal },

  tabs: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Colors.textMuted,
  },
  tabActive: { backgroundColor: Colors.penpal },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.white },
  tabTextActive: { color: Colors.white, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 28,
    paddingHorizontal: 20,
    height: 52,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  searchIcon: { width: 20, height: 20 },

  list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  // List rows (All + Requests)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowAvatarWrap: { width: 44, height: 44 },
  rowAvatar: { width: 44, height: 44, borderRadius: 22 },
  rowAvatarFallback: {
    backgroundColor: Colors.penpal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarText: { fontSize: 17, fontWeight: '700', color: Colors.white },
  rowInfo: { flex: 1, marginLeft: 12 },
  rowName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  rowMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  connectBtn: {
    backgroundColor: Colors.penpal,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 96,
    alignItems: 'center',
  },
  connectBtnText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  connectedBadge: { backgroundColor: Colors.success },
  pendingBadge: { backgroundColor: Colors.textMuted },

  reqActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDecline: { backgroundColor: Colors.error },
  circleAccept: { backgroundColor: Colors.success },
  circleGlyph: { color: Colors.white, fontSize: 17, fontWeight: '800' },

  cancelPill: {
    borderWidth: 1,
    borderColor: Colors.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cancelPillText: { color: Colors.error, fontSize: 13, fontWeight: '600' },

  // Connected photo grid
  gridRow: { justifyContent: 'space-between', marginBottom: GRID_GAP },
  photoCard: {
    width: CARD_W,
    aspectRatio: 0.82,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  photoBg: { flex: 1, justifyContent: 'flex-end' },
  photoBgImage: { borderRadius: 18 },
  photoFallback: {
    backgroundColor: Colors.penpal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallbackText: {
    fontSize: 64,
    fontWeight: '800',
    color: Colors.white,
    opacity: 0.9,
  },
  photoName: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    right: 14,
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  iconBtn: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  iconBtnTL: { top: 12, left: 12 },
  iconBtnTR: { top: 12, right: 12 },
  iconImg: { width: 20, height: 20 },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyImage: { width: 180, height: 150, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },

  // Confirm modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalClose: { fontSize: 18, color: Colors.text },
  modalMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 24,
  },
  modalName: { fontWeight: '700', color: Colors.text },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelBtn: { backgroundColor: Colors.navy },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  modalConfirmBtn: { backgroundColor: Colors.penpal },
  modalConfirmDisabled: { opacity: 0.4 },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: { borderColor: Colors.penpal, backgroundColor: Colors.penpal },
  checkmark: { fontSize: 13, color: Colors.white, fontWeight: '700' },
  consentText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },
});
