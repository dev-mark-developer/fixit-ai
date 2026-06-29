import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalDrawerParamList, PenpalStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { penpalApi, PenpalConnection } from '../../api/penpal';
import { getUser } from '../../store/auth';
import ReportModal from '../../components/common/ReportModal';

type Props = CompositeScreenProps<
  DrawerScreenProps<PenpalDrawerParamList, 'PenpalConnections'>,
  NativeStackScreenProps<PenpalStackParamList>
>;
type Tab = 'Pending' | 'Accepted';

export default function PenpalConnectionsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('Pending');
  const [items, setItems] = useState<PenpalConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [activeAction, setActiveAction] = useState<{ id: number; action: string } | null>(null);

  const [reportUserId, setReportUserId] = useState<number | null>(null);

  const [consentModal, setConsentModal] = useState<{
    connectionId: number;
    requesterName: string;
  } | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    getUser().then((u) => setCurrentUserId(u?.id ?? null));
  }, []);

  const loadConnections = async (status: Tab) => {
    setLoading(true);
    try {
      const res = await penpalApi.getConnections({ status });
      setItems(res.data?.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConnections(tab); }, [tab]);

  const handleRespond = async (connectionId: number, status: 'Accepted' | 'Declined') => {
    setConsentModal(null);
    setActiveAction({ id: connectionId, action: status });
    try {
      await penpalApi.respondConnection(connectionId, status);
      setItems((prev) => prev.filter((c) => c.id !== connectionId));
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Action failed.');
    } finally {
      setActiveAction(null);
    }
  };

  const handleAccept = (item: PenpalConnection) => {
    const isPhysical = item.requesterLetterType === 'Physical';
    if (isPhysical) {
      setConsentChecked(false);
      setConsentModal({ connectionId: item.id, requesterName: item.requesterPseudoName });
    } else {
      handleRespond(item.id, 'Accepted');
    }
  };

  const handleCancel = async (connectionId: number) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this connection request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Request', style: 'destructive',
        onPress: async () => {
          setActiveAction({ id: connectionId, action: 'Cancel' });
          try {
            await penpalApi.cancelConnection(connectionId);
            setItems((prev) => prev.filter((c) => c.id !== connectionId));
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message ?? 'Could not cancel request.');
          } finally {
            setActiveAction(null);
          }
        },
      },
    ]);
  };

  const handleRemove = async (connectionId: number) => {
    Alert.alert('Remove Connection', 'Are you sure you want to remove this penpal?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          setActiveAction({ id: connectionId, action: 'Remove' });
          try {
            await penpalApi.removeConnection(connectionId);
            setItems((prev) => prev.filter((c) => c.id !== connectionId));
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message ?? 'Could not remove connection.');
          } finally {
            setActiveAction(null);
          }
        },
      },
    ]);
  };

  const renderPending = ({ item }: { item: PenpalConnection }) => {
    const isIncoming = item.receiverId === currentUserId;
    const otherName = isIncoming ? item.requesterPseudoName : item.receiverPseudoName;
    const otherUserId = isIncoming ? item.requesterId : item.receiverId;
    const isThisCard = activeAction?.id === item.id;
    const acceptingThis = isThisCard && activeAction?.action === 'Accepted';
    const decliningThis = isThisCard && activeAction?.action === 'Declined';
    const cancellingThis = isThisCard && activeAction?.action === 'Cancel';
    const anyAction = isThisCard;

    return (
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{otherName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.penName}>{otherName}</Text>
          <Text style={styles.directionBadge}>{isIncoming ? '📩 Incoming request' : '📤 Request sent'}</Text>
        </View>
        <View style={styles.pendingRight}>
          {isIncoming ? (
            <View style={styles.actionBtns}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => handleAccept(item)}
                disabled={anyAction}
              >
                {acceptingThis
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.acceptBtnText}>Accept</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn]}
                onPress={() => handleRespond(item.id, 'Declined')}
                disabled={anyAction}
              >
                {decliningThis
                  ? <ActivityIndicator color={Colors.error} size="small" />
                  : <Text style={styles.declineBtnText}>Decline</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={() => handleCancel(item.id)}
              disabled={anyAction}
            >
              {cancellingThis
                ? <ActivityIndicator color={Colors.error} size="small" />
                : <Text style={styles.declineBtnText}>Cancel</Text>}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.reportFlag} onPress={() => setReportUserId(otherUserId)}>
            <Text style={styles.reportFlagText}>🚩</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAccepted = ({ item }: { item: PenpalConnection }) => {
    const isRequester = item.requesterId === currentUserId;
    const otherName = isRequester ? item.receiverPseudoName : item.requesterPseudoName;
    const otherId = isRequester ? item.receiverId : item.requesterId;
    const otherLetterType = isRequester ? item.receiverLetterType : item.requesterLetterType;
    const otherAddress = isRequester
      ? { line1: item.receiverAddressLine1, city: item.receiverCity, state: item.receiverState, postal: item.receiverPostalCode }
      : { line1: item.requesterAddressLine1, city: item.requesterCity, state: item.requesterState, postal: item.requesterPostalCode };
    const removing = activeAction?.id === item.id && activeAction?.action === 'Remove';
    const isPhysical = otherLetterType === 'Physical';

    return (
      <View style={[styles.card, isPhysical && styles.physicalCard]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{otherName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.penName}>{otherName}</Text>
          <Text style={styles.directionBadge}>
            {isPhysical ? '📮 Physical penpal' : '✅ Connected penpal'}
          </Text>
          {isPhysical && (
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>📍 Mailing address</Text>
              {otherAddress.line1 && <Text style={styles.addressText}>{otherAddress.line1}</Text>}
              {(otherAddress.city || otherAddress.state) && (
                <Text style={styles.addressText}>
                  {[otherAddress.city, otherAddress.state, otherAddress.postal].filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
          )}
        </View>
        <View style={styles.actionCol}>
          {!isPhysical && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn, { marginBottom: 6 }]}
              onPress={() => navigation.navigate('PenpalCompose', { receiverId: otherId, receiverPseudoName: otherName })}
              disabled={removing}
            >
              <Text style={styles.acceptBtnText}>Write</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.declineBtn, { marginBottom: 6 }]}
            onPress={() => handleRemove(item.id)}
            disabled={removing}
          >
            {removing
              ? <ActivityIndicator color={Colors.error} size="small" />
              : <Text style={styles.declineBtnText}>Remove</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportFlag} onPress={() => setReportUserId(otherId)}>
            <Text style={styles.reportFlagText}>🚩</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(['Pending', 'Accepted'] as Tab[]).map((t) => (
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
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          extraData={activeAction}
          renderItem={tab === 'Pending' ? renderPending : renderAccepted}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{tab === 'Pending' ? '📭' : '🤝'}</Text>
              <Text style={styles.emptyText}>
                {tab === 'Pending' ? 'No pending requests' : 'No accepted connections yet'}
              </Text>
              {tab === 'Accepted' && (
                <Text style={styles.emptySubtext}>Discover penpals and send connection requests!</Text>
              )}
            </View>
          }
        />
      )}

      <ReportModal
        visible={reportUserId !== null}
        reportedUserId={reportUserId ?? 0}
        module="Penpal"
        onClose={() => setReportUserId(null)}
      />

      {/* Physical connection consent modal */}
      <Modal
        visible={!!consentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConsentModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>📮 Accept Physical Penpal</Text>
            <Text style={styles.modalMessage}>
              <Text style={{ fontWeight: '700' }}>{consentModal?.requesterName}</Text>
              {' '}sends physical letters. By accepting, your mailing address will be shared with them.
            </Text>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setConsentChecked((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
                {consentChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>
                I understand and consent to sharing my address with this penpal.
              </Text>
            </TouchableOpacity>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setConsentModal(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalAcceptBtn, !consentChecked && styles.modalAcceptDisabled]}
                onPress={() => consentModal && handleRespond(consentModal.connectionId, 'Accepted')}
                disabled={!consentChecked}
              >
                <Text style={styles.modalAcceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2.5, borderColor: Colors.primary },
  tabText: { fontSize: 15, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  list: { padding: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  physicalCard: { alignItems: 'flex-start' },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: Colors.white },
  cardInfo: { flex: 1, marginLeft: 12 },
  penName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  directionBadge: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  addressBlock: { marginTop: 8 },
  addressLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 3 },
  addressText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  actionBtns: { flexDirection: 'row', gap: 8 },
  actionCol: { flexDirection: 'column', alignItems: 'center' },
  pendingRight: { flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  reportFlag: { padding: 4 },
  reportFlagText: { fontSize: 16 },
  actionBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, minWidth: 68, alignItems: 'center',
  },
  acceptBtn: { backgroundColor: Colors.primary },
  acceptBtnText: { fontSize: 12, fontWeight: '600', color: Colors.white },
  declineBtn: { borderWidth: 1, borderColor: Colors.error, backgroundColor: Colors.background },
  cancelBtn: { borderWidth: 1, borderColor: Colors.error, backgroundColor: Colors.background },
  declineBtnText: { fontSize: 12, fontWeight: '600', color: Colors.error },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptySubtext: { fontSize: 13, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 360,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  modalMessage: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
    marginRight: 12, marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  checkmark: { fontSize: 13, color: Colors.white, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 19 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  modalCancelBtn: { borderWidth: 1.5, borderColor: Colors.border },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  modalAcceptBtn: { backgroundColor: Colors.primary },
  modalAcceptDisabled: { opacity: 0.4 },
  modalAcceptText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
