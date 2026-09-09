import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { DatingStackParamList } from '../../types/navigation';
import { datingApi, SpiritualRequest } from '../../api/dating';
import AppButton from '../../components/common/AppButton';
import { Colors } from '../../utils/colors';

type Props = NativeStackScreenProps<DatingStackParamList, 'UploadCertificate'>;

type ScreenState = 'loading' | 'none' | 'pending' | 'approved' | 'declined';

export default function UploadCertificateScreen({ navigation }: Props) {
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [selectedMime, setSelectedMime] = useState<string>('application/pdf');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    loadRequest();
  }, []);

  const loadRequest = async () => {
    setScreenState('loading');
    try {
      const res = await datingApi.getSpiritualRequest();
      const req: SpiritualRequest | null = res.data?.data ?? null;
      if (!req) {
        setScreenState('none');
      } else {
        const s = req.status?.toLowerCase();
        if (s === 'approved') setScreenState('approved');
        else if (s === 'declined' || s === 'rejected') setScreenState('declined');
        else setScreenState('pending');
      }
    } catch (err: any) {
      // 404 means no request yet
      if (err?.response?.status === 404) {
        setScreenState('none');
      } else {
        setScreenState('none');
      }
    }
  };

  const handlePick = async () => {
    const result = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 1,
      // A certificate has to stay readable, so this is capped far higher than
      // an avatar — it only trims the camera's excess. Ignored for PDFs.
      maxWidth: 2048,
      maxHeight: 2048,
    });
    if (result.didCancel || !result.assets?.length) return;
    const asset = result.assets[0];
    setSelectedUri(asset.uri ?? null);
    setSelectedMime(asset.type ?? 'application/pdf');
    setSelectedName(asset.fileName ?? 'document');
    setSubmitError('');
  };

  const handleSubmit = async () => {
    if (!selectedUri) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await datingApi.submitSpiritualRequest(selectedUri, selectedMime);
      setSelectedUri(null);
      setSelectedName(null);
      await loadRequest();
    } catch {
      setSubmitError('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Plain back arrow header (Figma) — the native stack header is off for this
  // screen, same as the rest of the spiritual flow.
  const backHeader = (
    <View style={styles.headerBar}>
      <TouchableOpacity
        onPress={() => navigation.canGoBack() && navigation.goBack()}
        hitSlop={8}
      >
        <Icon name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>
    </View>
  );

  const renderBody = () => {
    // ─── Loading ───────────────────────────────────────────
    if (screenState === 'loading') {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.spiritual} />
        </View>
      );
    }

    // ─── Approved ─────────────────────────────────────────
    if (screenState === 'approved') {
      return (
        <ScrollView contentContainerStyle={styles.centeredContent}>
          <Image
            source={require('../../assets/thumb-up.png')}
            style={styles.stateImg}
            resizeMode="contain"
          />
          <Text style={styles.approvedTitle}>Congratulations!</Text>
          <Text style={styles.approvedHeading}>Your Profile is Approved</Text>
          <Text style={styles.approvedLead}>
            You have successfully resonated with the sanctuary community.
          </Text>
          <Text style={styles.pendingDesc}>
            Your credentials have been verified and the sanctuary is open to you.
            Take your time here — read with intention, reach out with care, and let
            each connection unfold at its own pace.
          </Text>
          <AppButton
            title="Start Connecting"
            onPress={() => navigation.navigate('DatingInterestSelection', { datingType: 'Spiritual' })}
            style={styles.spiritualBtn}
          />
        </ScrollView>
      );
    }

    // ─── Pending ──────────────────────────────────────────
    if (screenState === 'pending') {
      return (
        <ScrollView contentContainerStyle={styles.centeredContent}>
          <Image
            source={require('../../assets/load-time.png')}
            style={styles.stateImg}
            resizeMode="contain"
          />
          <Text style={styles.pendingTitle}>Please Wait!</Text>
          <Text style={styles.pendingDesc}>
            Your document is with our review team. Verification usually takes 1–3
            business days — we will let you know as soon as there is an update.
          </Text>
          <AppButton
            title="Back To Home"
            onPress={() => (navigation.getParent() as any)?.navigate('Home')}
            style={styles.spiritualBtn}
          />
        </ScrollView>
      );
    }

    // ─── Declined + No Request (upload UI) ───────────────
    const isDeclined = screenState === 'declined';

    // The decline itself is explained on SpiritualEntryScreen's declined
    // screen, which is where this one is reached from — no error banner here,
    // just the resubmit form.
    return (
      <ScrollView contentContainerStyle={styles.uploadContent}>
        <View style={styles.uploadHero}>
          <Image
            source={isDeclined
              ? require('../../assets/docDecline.png')
              : require('../../assets/certificate.png')}
            style={styles.stateImg}
            resizeMode="contain"
          />
          <Text style={styles.uploadTitle}>
            {isDeclined ? 'Resubmit Certificate' : 'Upload Certificate'}
          </Text>
          <Text style={styles.uploadSub}>
            Upload a document that verifies your spiritual credentials to access Spiritual Dating.
          </Text>
        </View>

        {/* File picker area */}
        <TouchableOpacity style={styles.pickerArea} activeOpacity={0.7} onPress={handlePick}>
          {selectedUri ? (
            <>
              <Text style={styles.pickerDoneIcon}>📎</Text>
              <Text style={styles.pickerFileName} numberOfLines={1}>
                {selectedName ?? 'Document selected'}
              </Text>
              <Text style={styles.pickerChange}>Tap to change</Text>
            </>
          ) : (
            <>
              <Image
                source={require('../../assets/document-upload.png')}
                style={styles.pickerUploadIcon}
                resizeMode="contain"
              />
              <Text style={styles.pickerLabel}>Tap to choose a document or image</Text>
              <Text style={styles.pickerHint}>PDF, JPG, PNG supported</Text>
            </>
          )}
        </TouchableOpacity>

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

        <AppButton
          title={isDeclined ? 'Resubmit for Review' : 'Submit for Review'}
          onPress={handleSubmit}
          disabled={!selectedUri}
          loading={submitting}
          style={styles.spiritualBtn}
        />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {backHeader}
      {renderBody()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  headerBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  centeredContent: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: Colors.background },
  uploadContent: { flexGrow: 1, padding: 24, backgroundColor: Colors.background },

  card: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stateImg: { width: 160, height: 150, marginBottom: 20, alignSelf: 'center' },
  pendingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.spiritual,
    textAlign: 'center',
    marginBottom: 14,
  },
  pendingDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  approvedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.spiritual,
    textAlign: 'center',
    marginBottom: 4,
  },
  approvedHeading: {
    fontSize: 21,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  approvedLead: {
    fontSize: 15,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  pickerUploadIcon: { width: 34, height: 34, marginBottom: 10 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 12, textAlign: 'center' },
  cardSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  cardMeta: { fontSize: 12, color: Colors.textMuted, marginBottom: 20 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.spiritualLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.spiritual, marginRight: 8 },
  statusText: { fontSize: 13, fontWeight: '600', color: Colors.spiritual },

  declinedBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    alignItems: 'flex-start',
  },
  declinedIcon: { fontSize: 20, marginRight: 12, marginTop: 2 },
  declinedTextBlock: { flex: 1 },
  declinedTitle: { fontSize: 15, fontWeight: '700', color: Colors.error, marginBottom: 4 },
  declinedSub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  uploadHero: { alignItems: 'center', marginBottom: 28 },
  uploadTitle: { fontSize: 22, fontWeight: '800', color: Colors.spiritual, marginBottom: 10, textAlign: 'center' },
  uploadSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },

  pickerArea: {
    borderWidth: 2,
    borderColor: Colors.spiritual,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: Colors.spiritualLight,
  },
  pickerPlaceholderIcon: { fontSize: 32, marginBottom: 10 },
  pickerLabel: { fontSize: 15, fontWeight: '600', color: Colors.spiritual, marginBottom: 6 },
  pickerHint: { fontSize: 12, color: Colors.textMuted },
  pickerDoneIcon: { fontSize: 32, marginBottom: 10 },
  pickerFileName: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 4, maxWidth: 220 },
  pickerChange: { fontSize: 12, color: Colors.spiritual },

  errorText: { color: Colors.error, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  spiritualBtn: { backgroundColor: Colors.spiritual },
});
