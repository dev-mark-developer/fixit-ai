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
  PenpalDiscoverItem,
} from '../../api/penpal';
import { getUser } from '../../store/auth';
import ReportModal from '../../components/common/ReportModal';

type Props = CompositeScreenProps<
  DrawerScreenProps<PenpalDrawerParamList, 'PenpalConnections'>,
  NativeStackScreenProps<PenpalStackParamList>
>;

type Tab = 'All' | 'Requests' | 'Connected';
const TABS: Tab[] = ['All', 'Requests', 'Connected'];

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

export default function PenpalConnectionsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState<PenpalDiscoverItem[]>([]); // All tab
  const [conns, setConns] = useState<PenpalConnection[]>([]); // Requests/Connected
  usePrefetchImages([
    ...people.map(p => p.profileImageUrl),
    ...conns.flatMap(c => [c.requesterImageUrl, c.receiverImageUrl]),
  ]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [activeAction, setActiveAction] = useState<{
    id: number;
    action: string;
  } | null>(null);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [reportUserId, setReportUserId] = useState<number | null>(null);
  const [reportName, setReportName] = useState<string>('');

  // Unified accept-confirm modal (digital + physical variants)
  const [confirmModal, setConfirmModal] = useState<{
    connectionId: number;
    name: string;
    physical: boolean;
  } | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    getUser().then(u => setCurrentUserId(u?.id ?? null));
  }, []);

  const load = async (which: Tab, searchTerm = '') => {
    setLoading(true);
    try {
      if (which === 'All') {
        const res = await penpalApi.discover({
          search: searchTerm || undefined,
          page: 1,
          pageSize: 20,
        });
        setPeople(res.data?.data ?? []);
      } else {
        const status = which === 'Requests' ? 'Pending' : 'Accepted';
        const res = await penpalApi.getConnections({ status });
        setConns(res.data?.data ?? []);
      }
    } catch {
      if (which === 'All') setPeople([]);
      else setConns([]);
    } finally {
      setLoading(false);
    }
  };

  // Reload the active tab whenever it changes AND whenever the screen
  // regains focus (e.g. returning from a public profile after accepting,
  // declining or removing a connection).
  useFocusEffect(
    useCallback(() => {
      load(tab, tab === 'All' ? search : '');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]),
  );

  // Live search on the All tab: refetch (debounced) as the user types.
  // Requests/Connected filter client-side below, so no fetch is needed there.
  const searchMounted = useRef(false);
  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true; // focus effect covers the initial load
      return;
    }
    if (tab !== 'All') return;
    const timer = setTimeout(() => load('All', search), 350);
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
    connectionId: number,
    status: 'Accepted' | 'Declined',
  ) => {
    setConfirmModal(null);
    setActiveAction({ id: connectionId, action: status });
    try {
      await penpalApi.respondConnection(connectionId, status);
      setConns(prev => prev.filter(c => c.id !== connectionId));
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Action failed.');
    } finally {
      setActiveAction(null);
    }
  };

  const handleAccept = (item: PenpalConnection) => {
    setConsentChecked(false);
    setConfirmModal({
      connectionId: item.id,
      name: item.requesterPseudoName,
      physical: item.requesterLetterType === 'Physical',
    });
  };

  const handleCancel = (connectionId: number) => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this connection request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            setActiveAction({ id: connectionId, action: 'Cancel' });
            try {
              await penpalApi.cancelConnection(connectionId);
              setConns(prev => prev.filter(c => c.id !== connectionId));
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

  const openConnectionProfile = (item: PenpalConnection) => {
    const isRequester = item.requesterId === currentUserId;
    navigation.navigate('PenpalPublicProfile', {
      userId: isRequester ? item.receiverId : item.requesterId,
      pseudoName: isRequester
        ? item.receiverPseudoName
        : item.requesterPseudoName,
      letterType: isRequester ? item.receiverLetterType : item.requesterLetterType,
      identityVisibility: '',
      city: isRequester ? item.receiverCity : item.requesterCity,
      state: isRequester ? item.receiverState : item.requesterState,
      profileImageUrl: isRequester
        ? item.receiverImageUrl
        : item.requesterImageUrl,
    });
  };

  // ── Renderers ──────────────────────────────────────────────
  const renderPerson = ({ item }: { item: PenpalDiscoverItem }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => openDiscoverProfile(item)}
    >
      {item.profileImageUrl ? (
        <RemoteImage uri={item.profileImageUrl} style={styles.rowAvatar} />
      ) : (
        <View style={[styles.rowAvatar, styles.rowAvatarFallback]}>
          <Text style={styles.rowAvatarText}>
            {item.pseudoName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
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

  const renderRequest = ({ item }: { item: PenpalConnection }) => {
    const isIncoming = item.receiverId === currentUserId;
    const otherName = isIncoming
      ? item.requesterPseudoName
      : item.receiverPseudoName;
    const otherImage = isIncoming
      ? item.requesterImageUrl
      : item.receiverImageUrl;
    const busy = activeAction?.id === item.id;

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.8}
        onPress={() => openConnectionProfile(item)}
      >
        {otherImage ? (
          <RemoteImage uri={otherImage} style={styles.rowAvatar} />
        ) : (
          <View style={[styles.rowAvatar, styles.rowAvatarFallback]}>
            <Text style={styles.rowAvatarText}>
              {otherName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>
            {otherName}
          </Text>
          <Text style={styles.rowMeta}>{timeAgo(item.createdAt)}</Text>
        </View>

        {busy ? (
          <ActivityIndicator color={Colors.penpal} size="small" />
        ) : isIncoming ? (
          <View style={styles.reqActions}>
            <TouchableOpacity
              style={[styles.circleBtn, styles.circleDecline]}
              onPress={() => handleRespond(item.id, 'Declined')}
            >
              <Text style={styles.circleGlyph}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.circleBtn, styles.circleAccept]}
              onPress={() => handleAccept(item)}
            >
              <Text style={styles.circleGlyph}>✓</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.cancelPill}
            onPress={() => handleCancel(item.id)}
          >
            <Text style={styles.cancelPillText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderConnected = ({ item }: { item: PenpalConnection }) => {
    const isRequester = item.requesterId === currentUserId;
    const otherName = isRequester
      ? item.receiverPseudoName
      : item.requesterPseudoName;
    const otherId = isRequester ? item.receiverId : item.requesterId;
    const otherImageUrl = isRequester
      ? item.receiverImageUrl
      : item.requesterImageUrl;
    const otherLetterType = isRequester
      ? item.receiverLetterType
      : item.requesterLetterType;
    const isPhysical = otherLetterType === 'Physical';

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
        onPress={() => openConnectionProfile(item)}
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

  // Client-side name filter for the Requests/Connected tabs.
  const filteredConns = search
    ? conns.filter(c => {
        const isRequester = c.requesterId === currentUserId;
        const name = isRequester ? c.receiverPseudoName : c.requesterPseudoName;
        return name.toLowerCase().includes(search.toLowerCase());
      })
    : conns;

  // Instant client-side filter for the All tab while the debounced server
  // search is in flight (also covers servers that ignore the search param).
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
          data={filteredConns}
          keyExtractor={item => item.id.toString()}
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
          data={filteredConns}
          keyExtractor={item => item.id.toString()}
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
                  handleRespond(confirmModal.connectionId, 'Accepted')
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
