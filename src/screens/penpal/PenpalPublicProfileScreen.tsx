import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { penpalApi, PenpalConnection } from '../../api/penpal';
import { getUser } from '../../store/auth';
import AppButton from '../../components/common/AppButton';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';
import ReportModal from '../../components/common/ReportModal';

type Props = NativeStackScreenProps<PenpalStackParamList, 'PenpalPublicProfile'>;

type ConnectionState =
  | 'none'
  | 'sent'        // I am requester, Pending
  | 'received'    // I am receiver, Pending
  | 'connected'   // Accepted
  | 'inactive';   // Declined or Cancelled → show Add again

const extractError = (err: any): string => {
  const data = err?.response?.data;
  if (!err?.response) return 'Unable to connect to server. Please check your network.';
  if (data?.message) return data.message;
  if (data?.title) return data.title;
  return `Server error (${err.response?.status}). Please try again.`;
};

export default function PenpalPublicProfileScreen({ route, navigation }: Props) {
  const {
    userId,
    pseudoName,
    letterType,
    identityVisibility,
    city,
    state,
    country,
    firstName,
    lastName,
    profileImageUrl,
  } = route.params;

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

  // For Physical-to-Physical consent
  const [reportVisible, setReportVisible] = useState(false);
  const [physicalConsentVisible, setPhysicalConsentVisible] = useState(false);
  const [physicalConsentChecked, setPhysicalConsentChecked] = useState(false);
  const [pendingAcceptConnectionId, setPendingAcceptConnectionId] = useState<number | null>(null);

  const showAlert = (title: string, message: string, buttons?: AlertButton[]) =>
    setAlert({ title, message, buttons });

  const deriveState = useCallback(
    (conn: PenpalConnection | null, myId: number): ConnectionState => {
      if (!conn) return 'none';
      if (conn.status === 'Accepted') return 'connected';
      if (conn.status === 'Pending') {
        return conn.requesterId === myId ? 'sent' : 'received';
      }
      // Declined / Cancelled / anything else → show Add again
      return 'inactive';
    },
    [],
  );

  const loadConnectionStatus = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getUser();
      const myId = user?.id ?? null;
      setCurrentUserId(myId);

      if (myId === null) {
        setConnState('none');
        return;
      }

      // Fetch all connections (no status filter so we get everything)
      const res = await penpalApi.getConnections();
      const items: PenpalConnection[] = res.data?.data ?? [];

      const found = items.find(
        (c) =>
          (c.requesterId === userId || c.receiverId === userId) &&
          (c.requesterId === myId || c.receiverId === myId),
      );

      setConnection(found ?? null);
      setConnState(deriveState(found ?? null, myId));
    } catch {
      setConnState('none');
    } finally {
      setLoading(false);
    }
  }, [userId, deriveState]);

  useEffect(() => {
    loadConnectionStatus();
  }, [loadConnectionStatus]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleAddPenpal = async () => {
    setActionLoading(true);
    try {
      const res = await penpalApi.sendConnection(userId);
      const newConn: PenpalConnection = res.data?.data ?? res.data;
      setConnection(newConn ?? null);
      setConnState('sent');
    } catch (err: any) {
      showAlert('Error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!connection) return;
    showAlert(
      'Cancel Request',
      'Are you sure you want to cancel this connection request?',
      [
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
      ],
    );
  };

  const handleDecline = async () => {
    if (!connection) return;
    setActionLoading(true);
    try {
      await penpalApi.respondConnection(connection.id, 'Declined');
      setConnection((prev) => (prev ? { ...prev, status: 'Declined' } : null));
      setConnState('inactive');
    } catch (err: any) {
      showAlert('Error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async (connectionId: number) => {
    setActionLoading(true);
    try {
      const res = await penpalApi.respondConnection(connectionId, 'Accepted');
      const updated: PenpalConnection = res.data?.data ?? res.data;
      setConnection(updated ?? (connection ? { ...connection, status: 'Accepted' } : null));
      setConnState('connected');
    } catch (err: any) {
      showAlert('Error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptPress = () => {
    if (!connection) return;
    // If both sides are Physical, require consent confirmation
    if (letterType === 'Physical') {
      setPendingAcceptConnectionId(connection.id);
      setPhysicalConsentChecked(false);
      setPhysicalConsentVisible(true);
    } else {
      handleAccept(connection.id);
    }
  };

  const confirmPhysicalAccept = () => {
    if (!physicalConsentChecked) {
      showAlert('Consent Required', 'Please check the consent box to proceed.');
      return;
    }
    setPhysicalConsentVisible(false);
    if (pendingAcceptConnectionId !== null) {
      handleAccept(pendingAcceptConnectionId);
    }
  };

  const handleWriteLetter = () => {
    navigation.navigate('PenpalCompose', {
      receiverId: userId,
      receiverPseudoName: pseudoName,
    });
  };

  const handleReport = () => setReportVisible(true);

  // ── Derived display values ────────────────────────────────────────────────

  const initials = pseudoName.charAt(0).toUpperCase();

  const locationParts = [city, state, country].filter(Boolean);
  const locationText = locationParts.length > 0 ? locationParts.join(', ') : null;

  const identityLabel =
    identityVisibility === 'Anonymous'
      ? 'Anonymous'
      : identityVisibility === 'FirstNameOnly'
      ? 'First Name Only'
      : 'Full Name Visible';

  const showFullName =
    identityVisibility === 'FullName' && (firstName || lastName);

  const letterTypeIcon = letterType === 'Physical' ? '✉' : '💬';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Navy header card */}
        <View style={styles.headerCard}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {profileImageUrl ? (
              <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </View>

          <Text style={styles.pseudoNameText}>{pseudoName}</Text>

          {showFullName && (
            <Text style={styles.realNameText}>
              {[firstName, lastName].filter(Boolean).join(' ')}
            </Text>
          )}

          {/* Letter type badge */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {letterTypeIcon} {letterType}
              </Text>
            </View>
          </View>

          {/* Location */}
          {locationText && (
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>{locationText}</Text>
            </View>
          )}
        </View>

        {/* Identity section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Text style={styles.infoIcon}>👤</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Visibility</Text>
              <Text style={styles.infoValue}>{identityLabel}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Text style={styles.infoIcon}>{letterTypeIcon}</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Letter Type</Text>
              <Text style={styles.infoValue}>{letterType}</Text>
            </View>
          </View>
          {locationText && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Text style={styles.infoIcon}>📍</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{locationText}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Action section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection</Text>

          {loading ? (
            <ActivityIndicator color={Colors.penpal} style={styles.actionLoader} />
          ) : (
            <View style={styles.actionArea}>
              {connState === 'none' || connState === 'inactive' ? (
                <AppButton
                  title="Add as Penpal"
                  onPress={handleAddPenpal}
                  loading={actionLoading}
                  style={styles.primaryActionBtn}
                />
              ) : connState === 'sent' ? (
                <AppButton
                  title="Cancel Request"
                  onPress={handleCancelRequest}
                  loading={actionLoading}
                  variant="outline"
                  style={styles.cancelActionBtn}
                  textStyle={styles.cancelActionBtnText}
                />
              ) : connState === 'received' ? (
                <View style={styles.respondRow}>
                  <View style={styles.respondBtnWrap}>
                    <AppButton
                      title="Accept"
                      onPress={handleAcceptPress}
                      loading={actionLoading}
                      style={styles.acceptBtn}
                    />
                  </View>
                  <View style={styles.respondBtnWrap}>
                    <AppButton
                      title="Decline"
                      onPress={handleDecline}
                      loading={actionLoading}
                      variant="outline"
                      style={styles.declineBtn}
                      textStyle={styles.declineBtnText}
                    />
                  </View>
                </View>
              ) : connState === 'connected' ? (
                <AppButton
                  title="Write Letter"
                  onPress={handleWriteLetter}
                  loading={actionLoading}
                  style={styles.primaryActionBtn}
                />
              ) : null}

              {/* Connection status label */}
              {!loading && (
                <Text style={styles.connStatusText}>
                  {connState === 'sent' && 'Connection request sent — awaiting response'}
                  {connState === 'received' && 'This person wants to be your penpal!'}
                  {connState === 'connected' && 'You are connected penpals'}
                  {connState === 'inactive' && 'Previous connection was declined or cancelled'}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Report */}
        <TouchableOpacity
          style={styles.reportBtn}
          onPress={handleReport}
          activeOpacity={0.7}
        >
          <Text style={styles.reportBtnText}>Report this user</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Physical-to-Physical consent alert */}
      <AppAlert
        visible={physicalConsentVisible}
        title="Physical Mail Consent"
        message="By accepting this connection, you agree that your physical mailing address may be shared with this penpal for letter delivery. Please confirm your consent below."
        buttons={[
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setPhysicalConsentVisible(false);
              setPendingAcceptConnectionId(null);
            },
          },
          {
            text: physicalConsentChecked ? 'Accept' : 'I Consent & Accept',
            style: 'default',
            onPress: confirmPhysicalAccept,
          },
        ]}
        onClose={() => {
          setPhysicalConsentVisible(false);
          setPendingAcceptConnectionId(null);
        }}
      />

      {/* Consent checkbox — rendered as an overlay row below the alert when it is shown */}
      {physicalConsentVisible && (
        <View style={styles.consentCheckboxOverlay}>
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setPhysicalConsentChecked((v) => !v)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkbox,
                physicalConsentChecked && styles.checkboxChecked,
              ]}
            >
              {physicalConsentChecked && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={styles.consentLabel}>
              I understand and consent to sharing my address
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
        onClose={() => setReportVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 40 },

  // Header card (navy)
  headerCard: {
    backgroundColor: Colors.navy,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatarWrap: {
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: Colors.penpal,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.penpal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.penpalLight,
  },
  avatarInitials: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.white,
  },
  pseudoNameText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
    textAlign: 'center',
  },
  realNameText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 10,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  badge: {
    backgroundColor: Colors.penpal,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationIcon: { fontSize: 13, marginRight: 4 },
  locationText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },

  // Sections
  section: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.penpalLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoIcon: { fontSize: 16 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 15, color: Colors.text, fontWeight: '500' },

  // Actions
  actionLoader: { paddingVertical: 20 },
  actionArea: { padding: 16 },
  respondRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  respondBtnWrap: { flex: 1 },
  primaryActionBtn: { backgroundColor: Colors.penpal },
  cancelActionBtn: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  acceptBtn: { backgroundColor: Colors.penpal },
  declineBtn: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  connStatusText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 10,
  },

  // Report
  reportBtn: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reportBtnText: {
    fontSize: 13,
    color: Colors.error,
    textDecorationLine: 'underline',
  },

  // Physical consent overlay
  consentCheckboxOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 1000,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    borderColor: Colors.penpal,
    backgroundColor: Colors.penpal,
  },
  checkmark: { fontSize: 13, color: Colors.white, fontWeight: '700' },
  consentLabel: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 18 },
});
