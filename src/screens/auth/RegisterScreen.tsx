import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Platform, Modal, ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { getDeviceId, getPlatform, getPushToken } from '../../utils/device';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';
import CountryPicker from '../../components/common/CountryPicker';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';
import api from '../../api/axios';
import { usersApi } from '../../api/users';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const GENDERS = ['Male', 'Female'];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const formatDate = (d: Date) =>
  `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;

const MAX_DOB = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
})();

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter (a–z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number (0–9)', test: (p: string) => /\d/.test(p) },
  { label: 'Special character (!@#...)', test: (p: string) => /[^a-zA-Z\d]/.test(p) },
];

const extractError = (err: any): string => {
  const data = err.response?.data;
  if (!err.response) return 'Unable to connect to server. Please check your network.';
  if (data?.message) return data.message;
  if (data?.errors) {
    if (Array.isArray(data.errors)) {
      return data.errors.map((e: any) => e.description || e.message || String(e)).join('\n');
    }
    if (typeof data.errors === 'object') {
      return Object.values(data.errors).flat().join('\n');
    }
  }
  if (data?.title) return data.title;
  return `Server error (${err.response?.status}). Please try again.`;
};

export default function RegisterScreen({ navigation }: Props) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    country: '', city: '', state: '', gender: '',
  });
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profileImageType, setProfileImageType] = useState('image/jpeg');
  const [tcAccepted, setTcAccepted] = useState(false);
  const [legalModal, setLegalModal] = useState<'tc' | 'privacy' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string; buttons?: AlertButton[] } | null>(null);

  const showAlert = (title: string, message: string, buttons?: AlertButton[]) =>
    setAlert({ title, message, buttons });

  const set = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const allPasswordRulesMet = PASSWORD_RULES.every((r) => r.test(form.password));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (!allPasswordRulesMet) e.password = 'Password does not meet requirements';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!dob) e.dob = 'Date of birth is required';
    else if (dob > MAX_DOB) e.dob = 'You must be at least 18 years old';
    if (!form.country.trim()) e.country = 'Country is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.state.trim()) e.state = 'State is required';
    if (!form.gender) e.gender = 'Gender is required';
    if (!tcAccepted) e.tc = 'You must accept the Terms & Conditions to continue';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pickImage = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8, includeBase64: false }, (response) => {
      const asset = response.assets?.[0];
      if (asset?.uri) {
        setProfileImageUri(asset.uri);
        setProfileImageType(asset.type ?? 'image/jpeg');
      }
    });
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const [deviceId, pushToken] = await Promise.all([getDeviceId(), getPushToken()]);

      // Sign-up photo is uploaded first (no auth needed); the returned URL is
      // sent with the registration payload as `profilePictureUrl`.
      let profilePictureUrl: string | undefined;
      if (profileImageUri) {
        try {
          const res = await usersApi.uploadRegistrationImage(profileImageUri, profileImageType);
          const returned = res.data?.data;
          profilePictureUrl =
            typeof returned === 'string'
              ? returned
              : returned?.profilePictureUrl ?? returned?.profileImageUrl ?? returned?.url;
        } catch {
          // A failed photo upload shouldn't block sign-up — the user can add
          // a photo later from Edit Profile.
        }
      }

      await api.post('/auth/register', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        dateOfBirth: dob!.toISOString().split('T')[0],
        country: form.country,
        city: form.city.trim(),
        state: form.state.trim(),
        gender: form.gender,
        role: 'User',
        profilePictureUrl,
        deviceId,
        platform: getPlatform(),
        deviceName: 'Mobile App',
        pushToken,
      });
      navigation.navigate('Otp', { email: form.email.trim(), purpose: 'Registration', password: form.password });
    } catch (err: any) {
      showAlert('Registration Failed', extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>

        {/* Title */}
        <Text style={styles.title}>Sign Up</Text>

        {/* Profile Photo */}
        <TouchableOpacity style={styles.photoRow} onPress={pickImage} activeOpacity={0.8}>
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarIcon}>👤</Text>
            </View>
          )}
          <Text style={styles.uploadText}>Upload Photo</Text>
        </TouchableOpacity>

        {/* Name */}
        <View style={styles.row}>
          <AppInput label="First Name" placeholder="Enter first name" value={form.firstName}
            onChangeText={(v) => set('firstName', v)} error={errors.firstName} maxLength={50}
            containerStyle={styles.rowField} />
          <AppInput label="Last Name" placeholder="Enter last name" value={form.lastName}
            onChangeText={(v) => set('lastName', v)} error={errors.lastName} maxLength={50}
            containerStyle={styles.rowField} />
        </View>

        {/* Email */}
        <AppInput label="Email Address" placeholder="Enter your email address" value={form.email}
          onChangeText={(v) => set('email', v)} keyboardType="email-address"
          autoCapitalize="none" error={errors.email} maxLength={100} />

        {/* Password */}
        <AppInput
          label="Password"
          placeholder="Enter your password"
          value={form.password}
          onChangeText={(v) => set('password', v)}
          secureToggle
          error={errors.password}
          onBlur={() => setPasswordTouched(true)}
        />
        {passwordTouched && (
          <View style={styles.policyBox}>
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(form.password);
              return (
                <View key={rule.label} style={styles.policyRow}>
                  <Text style={[styles.policyIcon, met ? styles.policyMet : styles.policyUnmet]}>
                    {met ? '✓' : '○'}
                  </Text>
                  <Text style={[styles.policyLabel, met ? styles.policyMet : styles.policyUnmet]}>
                    {rule.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <AppInput label="Confirm Password" placeholder="Repeat your password" value={form.confirmPassword}
          onChangeText={(v) => set('confirmPassword', v)} secureToggle error={errors.confirmPassword} />

        {/* Date of Birth */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity
            style={[styles.selectBox, !!errors.dob && styles.selectBoxError]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={dob ? styles.selectText : styles.selectPlaceholder}>
              {dob ? formatDate(dob) : 'Select date of birth'}
            </Text>
            <Image
              source={require('../../assets/calendar.png')}
              style={styles.calendarIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          {!!errors.dob && <Text style={styles.errorText}>{errors.dob}</Text>}
          <Text style={styles.dobHelper}>
            Only individuals aged 18 and above are permitted to register on this App
          </Text>
        </View>

        {showDatePicker && (
          Platform.OS === 'ios' ? (
            <View style={styles.iosPicker}>
              <View style={styles.iosPickerBar}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.iosPickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dob ?? MAX_DOB}
                mode="date"
                display="spinner"
                maximumDate={MAX_DOB}
                onChange={(_, date) => {
                  if (date) { setDob(date); setErrors((e) => ({ ...e, dob: '' })); }
                }}
              />
            </View>
          ) : (
            <DateTimePicker
              value={dob ?? MAX_DOB}
              mode="date"
              display="default"
              maximumDate={MAX_DOB}
              onChange={(_, date) => {
                setShowDatePicker(false);
                if (date) { setDob(date); setErrors((e) => ({ ...e, dob: '' })); }
              }}
            />
          )
        )}

        {/* Country */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Where do you live?</Text>
          <TouchableOpacity
            style={[styles.selectBox, !!errors.country && styles.selectBoxError]}
            onPress={() => setShowCountryPicker(true)}
          >
            <Text style={form.country ? styles.selectText : styles.selectPlaceholder}>
              {form.country || 'Select your country'}
            </Text>
            <Text style={styles.selectChevron}>▾</Text>
          </TouchableOpacity>
          {!!errors.country && <Text style={styles.errorText}>{errors.country}</Text>}
        </View>

        <View style={styles.row}>
          <AppInput label="City" placeholder="Enter your city" value={form.city}
            onChangeText={(v) => set('city', v)} error={errors.city} maxLength={50}
            containerStyle={styles.rowField} />
          <AppInput label="State" placeholder="Enter your state" value={form.state}
            onChangeText={(v) => set('state', v)} error={errors.state} maxLength={50}
            containerStyle={styles.rowField} />
        </View>

        {/* Gender */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Your Gender?</Text>
          <View style={styles.genderRow}>
            {GENDERS.map((g) => {
              const active = form.gender === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={styles.radioRow}
                  onPress={() => set('gender', g)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                    {active && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioLabel}>{g}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!!errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
        </View>

        {/* T&C Checkbox */}
        <TouchableOpacity
          style={styles.tcRow}
          onPress={() => { setTcAccepted((v) => !v); setErrors((e) => ({ ...e, tc: '' })); }}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, tcAccepted && styles.checkboxChecked]}>
            {tcAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.tcText}>
            By continuing, you agree to our{' '}
            <Text style={styles.tcLink} onPress={() => setLegalModal('tc')}>Terms & Conditions</Text>
            {' '}and{' '}
            <Text style={styles.tcLink} onPress={() => setLegalModal('privacy')}>Privacy Policy</Text>.
          </Text>
        </TouchableOpacity>
        {!!errors.tc && <Text style={styles.errorText}>{errors.tc}</Text>}

        <AppButton title="Create Your Account" onPress={handleRegister} loading={loading} style={styles.btn} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Pickers */}
        <CountryPicker
        visible={showCountryPicker}
        selected={form.country}
        onSelect={(c) => { set('country', c); }}
        onClose={() => setShowCountryPicker(false)}
      />

      {/* Legal Modals */}
      <Modal visible={legalModal !== null} animationType="slide" onRequestClose={() => setLegalModal(null)}>
        <View style={styles.legalModal}>
          <View style={styles.legalHeader}>
            <Text style={styles.legalTitle}>
              {legalModal === 'tc' ? 'Terms & Conditions' : 'Privacy Policy'}
            </Text>
            <TouchableOpacity onPress={() => setLegalModal(null)} style={styles.legalClose}>
              <Text style={styles.legalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.legalScroll} showsVerticalScrollIndicator={false}>
            {legalModal === 'tc' ? (
              <Text style={styles.legalBody}>
                {`Welcome to Fixit. By creating an account, you agree to these Terms & Conditions.\n\n1. Eligibility\nYou must be at least 18 years old to use Fixit.\n\n2. Acceptable Use\nYou agree not to use Fixit for any unlawful purpose or in any way that harms other users. Harassment, hate speech, or abusive behaviour will result in immediate account termination.\n\n3. User Content\nYou are responsible for all content you post. Fixit reserves the right to remove content that violates these terms.\n\n4. Privacy\nYour use of Fixit is also governed by our Privacy Policy.\n\n5. Subscriptions\nPaid subscriptions are billed monthly. You may cancel at any time through your device's app store. Refunds are subject to the app store's policies.\n\n6. Account Termination\nFixit reserves the right to suspend or terminate your account for violations of these terms.\n\n7. Changes\nWe may update these terms from time to time. Continued use of the app after changes constitutes acceptance.\n\nFor questions, contact us at support@fixit.com`}
              </Text>
            ) : (
              <Text style={styles.legalBody}>
                {`Fixit ("we", "us", "our") is committed to protecting your privacy.\n\n1. Information We Collect\n- Account information (name, email, date of birth, gender, location)\n- Profile information (photos, bio, preferences)\n- Usage data (swipes, matches, messages)\n- Device information (device ID, platform, push token)\n\n2. How We Use Your Information\n- To provide and improve our services\n- To match you with other users\n- To send push notifications\n- To ensure safety and security\n\n3. Information Sharing\nWe do not sell your personal information. We may share data with:\n- Other users as part of the matching experience\n- Service providers who help us operate the platform\n- Law enforcement when required by law\n\n4. Data Security\nWe use industry-standard encryption to protect your data.\n\n5. Your Rights\nYou may request access to, correction of, or deletion of your personal data by contacting us at support@fixit.com.\n\n6. Retention\nWe retain your data for as long as your account is active. Deleted accounts are purged within 30 days.\n\n7. Changes\nWe may update this policy. We will notify you of significant changes via the app.\n\nContact: support@fixit.com`}
              </Text>
            )}
          </ScrollView>
          <TouchableOpacity style={styles.legalDoneBtn} onPress={() => setLegalModal(null)}>
            <Text style={styles.legalDoneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Aesthetic Alert */}
      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        buttons={alert?.buttons}
        onClose={() => setAlert(null)}
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: 24, paddingTop: 48 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 20 },

  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 30 },
  uploadText: { marginLeft: 16, fontSize: 15, fontWeight: '600', color: Colors.text },

  policyBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginTop: -8,
    marginBottom: 16,
    gap: 6,
  },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  policyIcon: { fontSize: 13, fontWeight: '700', width: 16 },
  policyLabel: { fontSize: 12 },
  policyMet: { color: Colors.success },
  policyUnmet: { color: Colors.textMuted },

  row: { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1, marginBottom: 16 },

  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: Colors.text, marginBottom: 6 },
  selectBox: {
    height: 52, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 12,
    backgroundColor: Colors.surface, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectBoxError: { borderColor: Colors.error },
  selectText: { fontSize: 15, color: Colors.text, flex: 1 },
  selectPlaceholder: { fontSize: 15, color: Colors.textMuted, flex: 1 },
  selectChevron: { fontSize: 13, color: Colors.textMuted },
  calendarIcon: { width: 20, height: 20 },
  dobHelper: { marginTop: 8, fontSize: 12, color: Colors.primary, lineHeight: 17 },
  iosPicker: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  iosPickerBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iosPickerDone: { fontSize: 16, fontWeight: '700', color: Colors.primary },

  genderRow: { flexDirection: 'row', gap: 40 },
  radioRow: { flexDirection: 'row', alignItems: 'center' },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.textMuted,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  radioOuterActive: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  radioLabel: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  errorText: { marginTop: 4, fontSize: 12, color: Colors.error },
  btn: { marginTop: 8, marginBottom: 24 },
  footer: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 24 },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' },

  tcRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, marginTop: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    marginRight: 10, marginTop: 1,
  },
  checkboxChecked: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  checkmark: { fontSize: 13, color: Colors.white, fontWeight: '700' },
  tcText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  tcLink: { color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline' },

  legalModal: { flex: 1, backgroundColor: Colors.background },
  legalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  legalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  legalClose: { padding: 4 },
  legalCloseText: { fontSize: 18, color: Colors.textSecondary },
  legalScroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  legalBody: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, paddingBottom: 24 },
  legalDoneBtn: {
    margin: 20, backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  legalDoneBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
