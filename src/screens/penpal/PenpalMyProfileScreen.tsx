import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  PenpalDrawerParamList,
  PenpalStackParamList,
} from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { penpalApi, PenpalProfile } from '../../api/penpal';
import { usersApi } from '../../api/users';
import { useAuth } from '../../store/AuthContext';
import RemoteImage from '../../components/common/RemoteImage';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';

type Props = CompositeScreenProps<
  DrawerScreenProps<PenpalDrawerParamList, 'PenpalMyProfile'>,
  NativeStackScreenProps<PenpalStackParamList>
>;

type LetterType = 'Online' | 'Physical';

// Kept for when the letter-type / disability sections come back — their inputs
// are commented out below, but the values they edit are still loaded from the
// profile and sent back on save.
// const LETTER_OPTIONS: { value: LetterType; label: string; subtitle: string }[] = [
//   { value: 'Online', label: '✨  Online Letters', subtitle: 'Instant delivery, eternal connection' },
//   { value: 'Physical', label: '✍️  Physical Letters', subtitle: 'Old School Way' },
// ];

// const IDENTITY_OPTIONS: { value: string; label: string; hint?: string }[] = [
//   { value: 'Yes', label: 'Yes', hint: 'Would appear on your public profile.' },
//   { value: 'No', label: 'No' },
//   { value: 'PreferNotToSay', label: 'Prefer not to say' },
// ];

/**
 * "My Profile" for penpal members — the same fields `PenpalSetupScreen`
 * collects at sign-up, reachable any time from the drawer. Names and photo
 * belong to the account (`/users/me`); everything else is the penpal profile
 * (`POST /penpal/profile`, an upsert).
 */
export default function PenpalMyProfileScreen({ navigation }: Props) {
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Account fields (PATCH /users/me), seeded from the session until the
  // account call answers.
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  // What the server last told us the names were, so only real edits are sent.
  const originalName = useRef({ first: user?.firstName ?? '', last: user?.lastName ?? '' });

  // Penpal profile fields
  const [letterType, setLetterType] = useState<LetterType>('Online');
  const [pseudoName, setPseudoName] = useState('');
  const [identityVisibility, setIdentityVisibility] = useState('No');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [physicalConsent, setPhysicalConsent] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkingName, setCheckingName] = useState(false);
  // The member's own name is always "taken" — remember it so the availability
  // check doesn't reject them for keeping it.
  const originalPseudoName = useRef('');

  const load = useCallback(async () => {
    usersApi.getProfile()
      .then((res) => {
        const account = res.data?.data;
        setAvatarUrl(account?.profileImageUrl ?? null);
        if (account?.firstName) setFirstName(account.firstName);
        if (account?.lastName) setLastName(account.lastName);
        originalName.current = {
          first: account?.firstName ?? '',
          last: account?.lastName ?? '',
        };
      })
      .catch(() => {});
    try {
      const res = await penpalApi.getProfile();
      const p: PenpalProfile | null = res.data?.data ?? null;
      if (p) {
        setLetterType(p.letterType === 'Physical' ? 'Physical' : 'Online');
        setPseudoName(p.pseudoName);
        originalPseudoName.current = p.pseudoName;
        setIdentityVisibility(p.identityVisibility);
        setAddressLine1(p.addressLine1 ?? '');
        setAddressLine2(p.addressLine2 ?? '');
        setCity(p.city ?? '');
        setStateVal(p.state ?? '');
        setPostalCode(p.postalCode ?? '');
        setPhysicalConsent(p.physicalConsentGiven);
      }
    } catch {
      // No profile yet (or the call failed) — the form still renders empty.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const clearError = (key: string) => setErrors((e) => ({ ...e, [key]: '' }));

  const handleAvatarUpload = () => {
    launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      // Rendered as a small circle everywhere — no reason to ship the camera's
      // full-resolution original over the wire.
      maxWidth: 512,
      maxHeight: 512,
    }, async (response) => {
      const asset = response.assets?.[0];
      if (!asset?.uri) return;
      setUploadingAvatar(true);
      try {
        const res = await usersApi.uploadProfileImage(asset.uri, asset.type ?? 'image/jpeg');
        const returned = res.data?.data;
        const newUrl = typeof returned === 'string' ? returned : returned?.profileImageUrl;
        // Cache-bust in case the backend reuses the same file path
        setAvatarUrl(
          newUrl ? `${newUrl}${newUrl.includes('?') ? '&' : '?'}t=${Date.now()}` : asset.uri,
        );
      } catch {
        setAlert({ title: 'Upload Failed', message: 'Could not upload the image. Please try again.' });
      } finally {
        setUploadingAvatar(false);
      }
    });
  };

  const checkPseudoNameAvailability = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === originalPseudoName.current) return;
    setCheckingName(true);
    try {
      const res = await penpalApi.checkPseudoName(trimmed);
      if (!res.data?.data?.isAvailable) {
        setErrors((e) => ({
          ...e,
          pseudoName: 'This pen name is already taken. Please choose a different one.',
        }));
      }
    } catch {
      // Silently ignore network errors on the blur check — save still validates.
    } finally {
      setCheckingName(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    // A "name taken" verdict from the blur check still stands.
    if (errors.pseudoName) e.pseudoName = errors.pseudoName;
    if (!pseudoName.trim()) e.pseudoName = 'Pen name is required';
    if (letterType === 'Physical') {
      if (!addressLine1.trim()) e.addressLine1 = 'Address Line 1 is required';
      if (!city.trim()) e.city = 'City is required';
      if (!stateVal.trim()) e.state = 'State / Province is required';
      if (!postalCode.trim()) e.postalCode = 'Postal code is required';
      // Goes with the commented-out consent checkbox — with no way to tick it
      // here, this would block the save on a profile that answered No.
      // if (!physicalConsent) e.consent = 'You must consent to share your address for physical letters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (checkingName) return;
    if (!validate()) return;
    setSaving(true);
    const physical = letterType === 'Physical';
    try {
      // Names belong to the account, not the penpal profile — and only go up
      // when they actually changed.
      const namePatch: { firstName?: string; lastName?: string } = {};
      if (firstName.trim() !== originalName.current.first) namePatch.firstName = firstName.trim();
      if (lastName.trim() !== originalName.current.last) namePatch.lastName = lastName.trim();
      if (Object.keys(namePatch).length > 0) {
        await usersApi.updateProfile(namePatch);
        originalName.current = { first: firstName.trim(), last: lastName.trim() };
        // Keep the drawer, headers and every other reader of the session in sync.
        await updateUser({ firstName: firstName.trim(), lastName: lastName.trim() });
      }

      await penpalApi.saveProfile({
        letterType,
        pseudoName: pseudoName.trim(),
        identityVisibility,
        addressLine1: physical ? addressLine1.trim() : undefined,
        addressLine2: physical ? addressLine2.trim() : undefined,
        city: physical ? city.trim() : undefined,
        state: physical ? stateVal.trim() : undefined,
        postalCode: physical ? postalCode.trim() : undefined,
        physicalConsentGiven: physical ? physicalConsent : false,
      });
      originalPseudoName.current = pseudoName.trim();
      setAlert({ title: 'Saved', message: 'Your profile changes have been saved.' });
    } catch (err: any) {
      setAlert({
        title: 'Error',
        message: err?.response?.data?.message ?? 'Could not save your profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '–';

  const rootNav = navigation.getParent()?.getParent();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.penpal} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Custom header — matches the Penpal Group screen */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} hitSlop={8}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => rootNav?.navigate('Notifications' as never)}
          hitSlop={8}
        >
          <Icon name="notifications-outline" size={24} color={Colors.penpal} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content} extraHeight={100}>
        <Text style={styles.title}>
          My <Text style={styles.titleAccent}>Profile</Text>
        </Text>

        {/* Avatar — tap to change the account photo */}
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={handleAvatarUpload}
          activeOpacity={0.8}
          disabled={uploadingAvatar}
        >
          {avatarUrl ? (
            <RemoteImage
              uri={avatarUrl}
              style={styles.avatar}
              indicatorColor={Colors.penpal}
              fallback={
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              }
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {uploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={Colors.white} size="small" />
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Icon name="camera" size={13} color={Colors.white} />
          </View>
        </TouchableOpacity>

        <Text style={styles.name}>
          {`${firstName} ${lastName}`.trim() || '—'}
        </Text>
        {!!user?.email && <Text style={styles.email}>{user.email}</Text>}

        {/* Names live on the account, not the penpal profile */}
        <View style={styles.row}>
          <AppInput
            label="First Name"
            required
            value={firstName}
            onChangeText={(v) => { setFirstName(v); clearError('firstName'); }}
            placeholder="First name"
            maxLength={50}
            error={errors.firstName}
            containerStyle={styles.rowField}
          />
          <AppInput
            label="Last Name"
            required
            value={lastName}
            onChangeText={(v) => { setLastName(v); clearError('lastName'); }}
            placeholder="Last name"
            maxLength={50}
            error={errors.lastName}
            containerStyle={styles.rowField}
          />
        </View>

        {/* Pen name */}
        <AppInput
          label="Pen Name"
          required
          placeholder="What shall we call you?"
          value={pseudoName}
          onChangeText={(v) => { setPseudoName(v); clearError('pseudoName'); }}
          onBlur={() => checkPseudoNameAvailability(pseudoName)}
          maxLength={50}
          error={errors.pseudoName}
          hint={checkingName ? 'Checking availability…' : undefined}
        />

        {/* Letter type — hidden for now, the saved value is kept and re-sent.
        <Text style={styles.sectionLabel}>How would you like to write?</Text>
        {LETTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={styles.radioOption}
            onPress={() => setLetterType(opt.value)}
            activeOpacity={0.7}
          >
            <View style={[styles.radioCircle, letterType === opt.value && styles.radioCircleActive]}>
              {letterType === opt.value && <View style={styles.radioDot} />}
            </View>
            <View style={styles.radioContent}>
              <Text style={[styles.radioTitle, letterType === opt.value && styles.radioTitleActive]}>
                {opt.label}
              </Text>
              <Text style={styles.radioSubtitle}>{opt.subtitle}</Text>
            </View>
          </TouchableOpacity>
        ))}
        */}

        {/* Mailing address — physical letters only */}
        {letterType === 'Physical' && (
          <View style={styles.addressBlock}>
            <AppInput
              label="Address Line 1"
              required
              placeholder="Enter your address line 1"
              value={addressLine1}
              onChangeText={(v) => { setAddressLine1(v); clearError('addressLine1'); }}
              maxLength={100}
              error={errors.addressLine1}
            />
            <AppInput
              label="Address Line 2"
              placeholder="Enter your address line 2"
              value={addressLine2}
              onChangeText={setAddressLine2}
              maxLength={100}
            />
            <AppInput
              label="Postal Code"
              required
              placeholder="Enter postal code"
              value={postalCode}
              onChangeText={(v) => { setPostalCode(v); clearError('postalCode'); }}
              maxLength={20}
              keyboardType="numeric"
              error={errors.postalCode}
            />
            <View style={styles.row}>
              <AppInput
                label="State"
                required
                placeholder="Enter state"
                value={stateVal}
                onChangeText={(v) => { setStateVal(v); clearError('state'); }}
                maxLength={50}
                error={errors.state}
                containerStyle={styles.rowField}
              />
              <AppInput
                label="City"
                required
                placeholder="Enter city"
                value={city}
                onChangeText={(v) => { setCity(v); clearError('city'); }}
                maxLength={50}
                error={errors.city}
                containerStyle={styles.rowField}
              />
            </View>

            {/* Address-sharing consent — hidden for now; the answer given at
                setup is kept and re-sent on save.
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => { setPhysicalConsent((v) => !v); clearError('consent'); }}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, physicalConsent && styles.checkboxActive]}>
                {physicalConsent && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.consentDesc}>
                By proceeding, you agree to share your mailing address with your penpal.
                This information is shared only with your chosen connection for the
                purpose of sending letters.
              </Text>
            </TouchableOpacity>
            {!!errors.consent && <Text style={styles.errorText}>{errors.consent}</Text>}
            */}
          </View>
        )}

        {/* Disability visibility — hidden for now, the saved answer is re-sent.
        <Text style={styles.sectionLabel}>
          Do you identify as a person with a disability?
        </Text>
        {IDENTITY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={styles.radioOption}
            onPress={() => setIdentityVisibility(opt.value)}
            activeOpacity={0.7}
          >
            <View style={[styles.radioCircle, identityVisibility === opt.value && styles.radioCircleActive]}>
              {identityVisibility === opt.value && <View style={styles.radioDot} />}
            </View>
            <View style={styles.radioContent}>
              <Text style={styles.radioLabel}>{opt.label}</Text>
              {!!opt.hint && <Text style={styles.radioHint}>{opt.hint}</Text>}
            </View>
          </TouchableOpacity>
        ))}
        */}

        <AppButton
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
          style={styles.saveBtn}
        />
      </KeyboardAwareScrollView>

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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  menuIcon: { fontSize: 24, color: Colors.penpal, fontWeight: '700' },

  title: { fontSize: 24, fontWeight: '800', color: Colors.text, marginTop: 8, marginBottom: 20 },
  titleAccent: { color: Colors.penpal },

  avatarWrap: { alignSelf: 'center', width: 96, height: 96, marginBottom: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.surface },
  avatarFallback: {
    backgroundColor: Colors.penpal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: Colors.white },
  avatarOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.penpal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },

  name: { fontSize: 19, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  email: { fontSize: 13, color: Colors.penpal, textAlign: 'center', marginTop: 2, marginBottom: 22 },

  row: { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1 },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 14,
  },

  radioOption: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  radioCircleActive: { borderColor: Colors.penpal },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.penpal },
  radioContent: { flex: 1 },
  radioTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  radioTitleActive: { color: Colors.penpal },
  radioSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  radioLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  radioHint: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  addressBlock: { marginTop: 4 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  checkboxActive: { backgroundColor: Colors.penpal, borderColor: Colors.penpal },
  checkmark: { fontSize: 13, color: Colors.white, fontWeight: '700' },
  consentDesc: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 20 },
  errorText: { fontSize: 12, color: Colors.error, marginTop: 6 },

  saveBtn: { backgroundColor: Colors.penpal, marginTop: 12 },
});
