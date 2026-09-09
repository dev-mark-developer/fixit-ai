import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import RemoteImage, {
  RemoteImageBackground,
} from '../../components/common/RemoteImage';
import { penpalApi, PenpalConnection, PenpalLetter } from '../../api/penpal';
import { getUser } from '../../store/auth';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';
import ReportModal from '../../components/common/ReportModal';

type Props = NativeStackScreenProps<PenpalStackParamList, 'PenpalPublicProfile'>;

type ConnectionState =
  | 'none'
  | 'sent' // I am requester, Pending
  | 'received' // I am receiver, Pending
  | 'connected' // Accepted
  | 'inactive'; // Declined or Cancelled → show Add again

const { height: SCREEN_H } = Dimensions.get('window');
const HEADER_H = Math.round(SCREEN_H * 0.52);

const extractError = (err: any): string => {
  const data = err?.response?.data;
  if (!err?.response) return 'Unable to connect to server. Please check your network.';
  if (data?.message) return data.message;
  if (data?.title) return data.title;
  return `Server error (${err.response?.status}). Please try again.`;
};

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

export default function PenpalPublicProfileScreen({ route, navigation }: Props) {
  const {
    userId,
    pseudoName,
    letterType,
    country,
    profileImageUrl,
    age,
  } = route.params;

  const insets = useSafeAreaInsets();
  const isPhysical = letterType === 'Physical';

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [connection, setConnection] = useState<PenpalConnection | null>(null);
  const [connState, setConnState] = useState<ConnectionState>('none');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [alert, setAlert] = useState<{
    title: string;
    message: string;
    buttons?: AlertButton[];
  } | null>(null);
  const [reportVisible, setReportVisible] = useState(false);

  // Accept-confirm modal (digital + physical variants)
  const [confirmModal, setConfirmModal] = useState<{
    connectionId: number;
    physical: boolean;
  } | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  // Letters Exchanged thread (connected digital only)
  const [letters, setLetters] = useState<PenpalLetter[]>([]);
  const [lettersLoading, setLettersLoading] = useState(false);

  // Lightweight toast
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 2200);
  };

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showAlert = (title: string, message: string, buttons?: AlertButton[]) =>
    setAlert({ title, message, buttons });

  const deriveState = useCallback(
    (conn: PenpalConnection | null, myId: number): ConnectionState => {
      if (!conn) return 'none';
      if (conn.status === 'Accepted') return 'connected';
      if (conn.status === 'Pending') {
        return conn.requesterId === myId ? 'sent' : 'received';
      }
      return 'inactive';
    },
    [],
  );

  const loadConnectionStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const user = await getUser();
      const myId = user?.id ?? null;
      setCurrentUserId(myId);

      if (myId === null) {
        setConnState('none');
        return;
      }

      const res = await penpalApi.getConnections();
      const items: PenpalConnection[] = res.data?.data ?? [];
      const found = items.find(
        c =>
          (c.requesterId === userId || c.receiverId === userId) &&
          (c.requesterId === myId || c.receiverId === myId),
      );

      setConnection(found ?? null);
      setConnState(deriveState(found ?? null, myId));
    } catch {
      setConnState('none');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId, deriveState]);

  useEffect(() => {
    loadConnectionStatus();
  }, [loadConnectionStatus]);

  // Load the letter thread whenever the screen is focused (connected digital
  // penpals only) — so returning from Compose refetches the latest letters.
  useFocusEffect(
    useCallback(() => {
      if (connState !== 'connected' || isPhysical) return;
      let cancelled = false;
      (async () => {
        setLettersLoading(true);
        try {
          // Per-penpal thread endpoint (gap #3 resolved)
          const res = await penpalApi.getLetters({ withUserId: userId });
          const all: PenpalLetter[] = res.data?.data ?? [];
          const thread = all
            .slice()
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            );
          if (!cancelled) setLetters(thread);
        } catch {
          if (!cancelled) setLetters([]);
        } finally {
          if (!cancelled) setLettersLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [connState, isPhysical, userId]),
  );

  // ── Actions ────────────────────────────────────────────────
  const handleAddPenpal = async () => {
    setActionLoading(true);
    try {
      const res = await penpalApi.sendConnection(userId);
      const newConn: PenpalConnection = res.data?.data ?? res.data;
      setConnection(newConn ?? null);
      setConnState('sent');
      showToast(`Connection request sent to ${pseudoName}!`);
    } catch (err: any) {
      showAlert('Error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = () => {
    if (!connection) return;
    showAlert('Cancel Request', 'Are you sure you want to cancel this connection request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await penpalApi.cancelConnection(connection.id);
            setConnection(null);
            setConnState('none');
          } catch (err: any) {
            showAlert('Error', extractError(err));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleDecline = async () => {
    if (!connection) return;
    setConfirmModal(null);
    setActionLoading(true);
    try {
      await penpalApi.respondConnection(connection.id, 'Declined');
      setConnection(prev => (prev ? { ...prev, status: 'Declined' } : null));
      setConnState('inactive');
    } catch (err: any) {
      showAlert('Error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async (connectionId: number) => {
    setConfirmModal(null);
    setActionLoading(true);
    try {
      const res = await penpalApi.respondConnection(connectionId, 'Accepted');
      const updated: PenpalConnection = res.data?.data ?? res.data;
      setConnection(updated ?? (connection ? { ...connection, status: 'Accepted' } : null));
      setConnState('connected');
      // The respond response doesn't carry the counterpart's mailing address —
      // silently refetch the full connection so "Send Letter To:" populates
      // immediately (physical penpals).
      loadConnectionStatus(true);
    } catch (err: any) {
      showAlert('Error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptPress = () => {
    if (!connection) return;
    setConsentChecked(false);
    setConfirmModal({ connectionId: connection.id, physical: isPhysical });
  };

  const handleRemove = () => {
    if (!connection) return;
    showAlert('Remove Connection', 'Are you sure you want to remove this penpal?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await penpalApi.removeConnection(connection.id);
            setConnection(null);
            setConnState('none');
            setLetters([]);
          } catch (err: any) {
            showAlert('Error', extractError(err));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleWriteLetter = () =>
    navigation.navigate('PenpalCompose', {
      receiverId: userId,
      receiverPseudoName: pseudoName,
    });

  // ── Derived display values ─────────────────────────────────
  const initials = pseudoName.charAt(0).toUpperCase();
  // Country only — city/state stay out of a public profile header.
  const locationText = country || null;

  // Age now comes from the discover API via route params (gap #2 resolved)
  const nameAge = age != null ? `${pseudoName}, ${age}` : pseudoName;

  // Physical mailing address comes from the connection's "other" side.
  const otherAddr =
    connection && currentUserId != null
      ? connection.requesterId === currentUserId
        ? {
            line1: connection.receiverAddressLine1,
            city: connection.receiverCity,
            state: connection.receiverState,
            postal: connection.receiverPostalCode,
          }
        : {
            line1: connection.requesterAddressLine1,
            city: connection.requesterCity,
            state: connection.requesterState,
            postal: connection.requesterPostalCode,
          }
      : null;

  // ── Render helpers ─────────────────────────────────────────
  const PenButton = (
    <TouchableOpacity
      style={styles.penBtn}
      onPress={handleWriteLetter}
      disabled={actionLoading}
    >
      <Image
        source={require('../../assets/letter.png')}
        style={styles.btnIcon}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );

  // Photo-overlay actions: Remove (connected) + pen; pen only otherwise.
  // Physical letter exchange has no in-app composing, so the pen is hidden.
  const renderPhotoActions = () => {
    if (loading) return <ActivityIndicator color={Colors.white} />;
    if (connState === 'connected') {
      return (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.removePhotoBtn}
            onPress={handleRemove}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Image
                  source={require('../../assets/remove.png')}
                  style={styles.removeIcon}
                  resizeMode="contain"
                />
                <Text style={styles.removeBtnText}>Remove</Text>
              </>
            )}
          </TouchableOpacity>
          {!isPhysical && PenButton}
        </View>
      );
    }
    return <View style={styles.actionRow}>{!isPhysical && PenButton}</View>;
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Photo header */}
        <RemoteImageBackground
          uri={profileImageUrl}
          style={[styles.header, { height: HEADER_H }]}
          imageStyle={styles.headerImg}
          indicatorSize="large"
        >
          {!profileImageUrl && (
            <View style={styles.headerFallback}>
              <Text style={styles.headerFallbackText}>{initials}</Text>
            </View>
          )}
          {/* Top row: back + report */}
          <View style={[styles.topRow, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.goBack()}
              hitSlop={8}
            >
              <Icon name="arrow-back" size={22} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setReportVisible(true)}
              hitSlop={8}
            >
              <Image
                source={require('../../assets/flag.png')}
                style={styles.flagIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          {/* Name + location */}
          <View style={styles.nameOverlay}>
            <Text style={styles.nameText}>{nameAge}</Text>
            {locationText && (
              <View style={styles.locationRow}>
                <Icon name="location-outline" size={14} color="rgba(255,255,255,0.9)" />
                <Text style={styles.locationText}>{locationText}</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsWrap}>{renderPhotoActions()}</View>
        </RemoteImageBackground>

        {/* Body — connected + physical: mailing address */}
        {connState === 'connected' && isPhysical && otherAddr && (
          <View style={styles.body}>
            <Text style={styles.bodyTitle}>Send Letter To:</Text>
            {otherAddr.line1 ? (
              <AddressField label="Address Line 1:" value={otherAddr.line1} />
            ) : null}
            {/* Address Line 2 isn't returned in the connection payload (only
                profile has it) — shown when available. */}
            <AddressField label="Postal Code:" value={otherAddr.postal} />
            <AddressField label="State:" value={otherAddr.state} />
            <AddressField label="City:" value={otherAddr.city} />
          </View>
        )}

        {/* Body — connected + digital: letters thread or empty state */}
        {connState === 'connected' && !isPhysical && (
          lettersLoading ? (
            <ActivityIndicator color={Colors.penpal} style={{ marginTop: 48 }} />
          ) : letters.length === 0 ? (
            <StateBody
              image={require('../../assets/notfound.png')}
              title="No Letter Exchanged"
              desc="You haven't exchanged any letters yet. Start the conversation and send your first letter now."
            >
              <TouchableOpacity
                style={[styles.fullBtn, { backgroundColor: Colors.penpal }]}
                onPress={handleWriteLetter}
              >
                <Text style={styles.fullBtnText}>Exchange Letter Now!</Text>
              </TouchableOpacity>
            </StateBody>
          ) : (
            <View style={styles.body}>
              <Text style={styles.bodyTitle}>Letters Exchanged</Text>
              {letters.map(l => {
                const mine = l.senderId === currentUserId;
                return (
                  <View
                    key={l.id}
                    style={[
                      styles.bubbleRow,
                      mine ? styles.bubbleRowRight : styles.bubbleRowLeft,
                    ]}
                  >
                    {!mine &&
                      (profileImageUrl ? (
                        <RemoteImage
                          uri={profileImageUrl}
                          style={styles.bubbleAvatar}
                        />
                      ) : (
                        <View
                          style={[styles.bubbleAvatar, styles.bubbleAvatarFallback]}
                        >
                          <Text style={styles.bubbleAvatarText}>{initials}</Text>
                        </View>
                      ))}
                    <View style={{ maxWidth: '78%' }}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          navigation.navigate('PenpalLetterDetail', {
                            letterId: l.id,
                          })
                        }
                        style={[
                          styles.bubble,
                          mine ? styles.bubbleMine : styles.bubbleTheirs,
                        ]}
                      >
                        <Text
                          style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}
                          numberOfLines={1}
                        >
                          Title: {l.title}
                        </Text>
                      </TouchableOpacity>
                      <Text
                        style={[
                          styles.bubbleTime,
                          mine ? styles.bubbleTimeRight : styles.bubbleTimeLeft,
                        ]}
                      >
                        {timeAgo(l.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )
        )}

        {/* Body — received request */}
        {connState === 'received' && (
          <StateBody
            title="Be Friends And Start Sending Letters"
            desc="Accept this request to connect and start exchanging heartfelt letters with each other."
          >
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={[styles.fullBtn, styles.declineFullBtn]}
                onPress={handleDecline}
                disabled={actionLoading}
              >
                <Icon name="close" size={18} color={Colors.white} />
                <Text style={styles.fullBtnText}>  Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fullBtn, styles.acceptFullBtn]}
                onPress={handleAcceptPress}
                disabled={actionLoading}
              >
                <Icon name="checkmark" size={18} color={Colors.white} />
                <Text style={styles.fullBtnText}>  Accept</Text>
              </TouchableOpacity>
            </View>
          </StateBody>
        )}

        {/* Body — request sent, pending */}
        {connState === 'sent' && (
          <StateBody
            title="Request Pending"
            desc="Your connection request has been sent. You'll be able to exchange letters once it's accepted."
          >
            <TouchableOpacity
              style={[styles.fullBtn, styles.cancelFullBtn]}
              onPress={handleCancelRequest}
              disabled={actionLoading}
            >
              <Text style={[styles.fullBtnText, { color: Colors.error }]}>
                Cancel Request
              </Text>
            </TouchableOpacity>
          </StateBody>
        )}

        {/* Body — connection status still loading */}
        {loading && (
          <ActivityIndicator color={Colors.penpal} style={styles.bodyLoader} />
        )}

        {/* Body — not connected */}
        {!loading && (connState === 'none' || connState === 'inactive') && (
          <StateBody
            title={`Add ${pseudoName}\nas a Friend`}
            desc="Send a connection request to become penpals and start exchanging letters with each other."
          >
            <TouchableOpacity
              style={[styles.fullBtn, { backgroundColor: Colors.success }]}
              onPress={handleAddPenpal}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Icon name="person" size={18} color={Colors.white} />
                  <Text style={styles.fullBtnText}>  Add Friend</Text>
                </>
              )}
            </TouchableOpacity>
          </StateBody>
        )}
      </ScrollView>

      {/* Accept-confirm modal (same design as PenpalConnections) */}
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
                  <Text style={styles.modalName}>{pseudoName}</Text> will be
                  able to see your physical mailing address. Are you sure you
                  want to proceed?
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.modalMessage}>
                Are you sure you want to add{' '}
                <Text style={styles.modalName}>{pseudoName}</Text> to your
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
                  confirmModal && handleAccept(confirmModal.connectionId)
                }
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* General alert */}
      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        buttons={alert?.buttons}
        onClose={() => setAlert(null)}
      />

      <ReportModal
        visible={reportVisible}
        reportedUserId={userId}
        module="Penpal"
        reportedName={pseudoName}
        onClose={() => setReportVisible(false)}
      />

      {/* Toast */}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            { opacity: toastOpacity, bottom: insets.bottom + 28 },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

function StateBody({
  image,
  title,
  desc,
  children,
}: {
  image?: number;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.stateBody}>
      <Image
        source={image ?? require('../../assets/penpalRequest.png')}
        style={styles.illustrationImg}
        resizeMode="contain"
      />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDesc}>{desc}</Text>
      {children}
    </View>
  );
}

function AddressField({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.addrField}>
      <Text style={styles.addrLabel}>{label}</Text>
      <Text style={styles.addrValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // The photo and the fallback are rounded at the bottom, so whatever the
  // container paints shows through those two corners — keep it the page colour,
  // and round the container itself so nothing can peek out at all.
  header: {
    justifyContent: 'flex-end',
    backgroundColor: Colors.background,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerImg: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.penpal,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerFallbackText: { fontSize: 96, fontWeight: '800', color: Colors.white, opacity: 0.85 },

  topRow: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Translucent pill behind the icons — the photo has no scrim, so the buttons
  // carry their own contrast.
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagIcon: { width: 20, height: 20, tintColor: Colors.white },

  nameOverlay: { position: 'absolute', left: 20, bottom: 26 },
  nameText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },

  actionsWrap: { position: 'absolute', right: 16, bottom: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  labelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    paddingHorizontal: 18,
    height: 46,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  labelBtnText: { fontSize: 15, fontWeight: '700' },
  addGlyph: { fontSize: 18, fontWeight: '900', color: Colors.success },
  penBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  btnIcon: { width: 22, height: 22 },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDecline: { backgroundColor: Colors.error },
  circleAccept: { backgroundColor: Colors.success },
  circleGlyph: { color: Colors.white, fontSize: 18, fontWeight: '800' },

  // Body
  body: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40 },
  bodyLoader: { marginTop: 56 },
  bodyTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  emptyThread: { fontSize: 14, color: Colors.textMuted, marginTop: 8 },

  // Letter bubbles
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 18 },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  bubbleAvatarFallback: {
    backgroundColor: Colors.penpal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleAvatarText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  bubble: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14 },
  bubbleTheirs: { backgroundColor: Colors.surface, borderTopLeftRadius: 4 },
  bubbleMine: { backgroundColor: Colors.penpal, borderTopRightRadius: 4 },
  bubbleTextTheirs: { fontSize: 13, color: Colors.text },
  bubbleTextMine: { fontSize: 13, color: Colors.white },
  bubbleTime: { fontSize: 11, color: Colors.textMuted, marginTop: 5 },
  bubbleTimeLeft: { textAlign: 'left', marginLeft: 4 },
  bubbleTimeRight: { textAlign: 'right', marginRight: 4 },

  // Address
  addrField: { marginBottom: 14 },
  addrLabel: { fontSize: 14, fontWeight: '700', color: Colors.penpal, marginBottom: 2 },
  addrValue: { fontSize: 14, color: Colors.text },

  // Photo Remove button (red)
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.error,
    paddingHorizontal: 18,
    height: 46,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  removeIcon: { width: 20, height: 20, tintColor: Colors.white },
  removeBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  // State bodies (empty / pending / not-connected)
  stateBody: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: 'center',
  },
  illustrationImg: { width: 210, height: 170, marginBottom: 20 },
  stateTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  stateDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 6,
  },
  fullBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  fullBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  footerRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  declineFullBtn: { flex: 1, backgroundColor: Colors.error },
  acceptFullBtn: { flex: 1, backgroundColor: Colors.success },
  cancelFullBtn: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },

  // Accept-confirm modal (mirrors PenpalConnectionsScreen)
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

  // Toast
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  toastText: { color: Colors.white, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
