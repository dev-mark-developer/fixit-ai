import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import AppInput from '../../components/common/AppInput';
import AppAlert from '../../components/common/AppAlert';
import { penpalApi, PenpalProfile } from '../../api/penpal';

type Props = NativeStackScreenProps<PenpalStackParamList, 'PenpalSetup'>;

const ACCENT = '#4361EE';

const LETTER_OPTIONS: { value: 'Online' | 'Physical'; icon: string; label: string; subtitle: string }[] = [
  { value: 'Online',   icon: '✨', label: 'Online Letters',   subtitle: 'Instant delivery, eternal connection' },
  { value: 'Physical', icon: '✍️', label: 'Physical Letters', subtitle: 'Old School Way' },
];

const IDENTITY_OPTIONS: { value: string; label: string; hint?: string }[] = [
  { value: 'Yes',            label: 'Yes',              hint: 'Would appear on your public profile.' },
  { value: 'No',             label: 'No' },
  { value: 'PreferNotToSay', label: 'Prefer not to say' },
];

export default function PenpalSetupScreen({ navigation }: Props) {
  const [letterType, setLetterType] = useState<'Online' | 'Physical'>('Online');
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
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const originalPseudoName = React.useRef('');
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    penpalApi
      .getProfile()
      .then(res => {
        const p: PenpalProfile | null = res.data?.data ?? null;
        if (p) {
          setLetterType(p.letterType as 'Online' | 'Physical');
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
      })
      .finally(() => setInitialLoading(false));
  }, []);

  const clearError = (key: string) => setErrors(e => ({ ...e, [key]: '' }));

  const checkPseudoNameAvailability = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === originalPseudoName.current) return;
    setCheckingName(true);
    try {
      const res = await penpalApi.checkPseudoName(trimmed);
      if (!res.data?.data?.isAvailable) {
        setErrors(e => ({ ...e, pseudoName: 'This pen name is already taken. Please choose a different one.' }));
      }
    } catch {
      // silently ignore network errors on blur check
    } finally {
      setCheckingName(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!pseudoName.trim()) e.pseudoName = 'Pen name is required';
    if (letterType === 'Physical') {
      if (!addressLine1.trim()) e.addressLine1 = 'Address Line 1 is required';
      if (!city.trim()) e.city = 'City is required';
      if (!stateVal.trim()) e.state = 'State / Province is required';
      if (!postalCode.trim()) e.postalCode = 'Postal code is required';
      if (!physicalConsent) e.consent = 'You must consent to share your address for physical letters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (checkingName) return;
    if (!validate()) return;
    setLoading(true);
    try {
      await penpalApi.saveProfile({
        letterType,
        pseudoName: pseudoName.trim(),
        identityVisibility,
        addressLine1: letterType === 'Physical' ? addressLine1.trim() : undefined,
        addressLine2: letterType === 'Physical' ? addressLine2.trim() : undefined,
        city: letterType === 'Physical' ? city.trim() : undefined,
        state: letterType === 'Physical' ? stateVal.trim() : undefined,
        postalCode: letterType === 'Physical' ? postalCode.trim() : undefined,
        physicalConsentGiven: letterType === 'Physical' ? physicalConsent : false,
      });
      navigation.replace('PenpalMain');
    } catch (err: any) {
      setAlert({
        title: 'Error',
        message: err.response?.data?.message ?? 'Failed to save profile. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.pageTitle}>
            Choose Your <Text style={styles.pageTitleAccent}>Medium</Text>
          </Text>

          {/* Letter type */}
          {LETTER_OPTIONS.map(opt => (
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
                  {opt.icon}  {opt.label}
                </Text>
                <Text style={styles.radioSubtitle}>{opt.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Physical address fields */}
          {letterType === 'Physical' && (
            <View style={styles.addressBlock}>

              {/* Address Line 1 */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Address Line 1</Text>
                <View style={[styles.inputBox, !!errors.addressLine1 && styles.inputBoxError]}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your address line 1"
                    placeholderTextColor={Colors.textMuted}
                    value={addressLine1}
                    onChangeText={v => { setAddressLine1(v); clearError('addressLine1'); }}
                    maxLength={100}
                  />
                </View>
                {!!errors.addressLine1 && <Text style={styles.errorText}>{errors.addressLine1}</Text>}
              </View>

              {/* Address Line 2 */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Address Line 2</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your address line 2"
                    placeholderTextColor={Colors.textMuted}
                    value={addressLine2}
                    onChangeText={setAddressLine2}
                    maxLength={100}
                  />
                </View>
              </View>

              {/* Postal Code */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Postal Code</Text>
                <View style={[styles.inputBox, !!errors.postalCode && styles.inputBoxError]}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter postal code"
                    placeholderTextColor={Colors.textMuted}
                    value={postalCode}
                    onChangeText={v => { setPostalCode(v); clearError('postalCode'); }}
                    maxLength={20}
                    keyboardType="numeric"
                  />
                </View>
                {!!errors.postalCode && <Text style={styles.errorText}>{errors.postalCode}</Text>}
              </View>

              {/* State + City side by side */}
              <View style={styles.cityRow}>
                <View style={[styles.fieldBlock, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>State</Text>
                  <View style={[styles.inputBox, !!errors.state && styles.inputBoxError]}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter state"
                      placeholderTextColor={Colors.textMuted}
                      value={stateVal}
                      onChangeText={v => { setStateVal(v); clearError('state'); }}
                      maxLength={50}
                    />
                  </View>
                  {!!errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
                </View>
                <View style={[styles.fieldBlock, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>City</Text>
                  <View style={[styles.inputBox, !!errors.city && styles.inputBoxError]}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter city"
                      placeholderTextColor={Colors.textMuted}
                      value={city}
                      onChangeText={v => { setCity(v); clearError('city'); }}
                      maxLength={50}
                    />
                  </View>
                  {!!errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
                </View>
              </View>

              {/* Consent checkbox */}
              <TouchableOpacity
                style={styles.consentRow}
                onPress={() => { setPhysicalConsent(prev => !prev); clearError('consent'); }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, physicalConsent && styles.checkboxActive]}>
                  {physicalConsent && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.consentDesc}>
                  By proceeding, you agree to share your mailing address with your penpal. This information is shared only with your chosen connection for the purpose of sending letters.
                </Text>
              </TouchableOpacity>
              {errors.consent ? <Text style={styles.errorText}>{errors.consent}</Text> : null}

            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Pseudo Name */}
          <Text style={styles.sectionLabel}>Pseudo Name</Text>
          <View style={[styles.inputBox, !!errors.pseudoName && styles.inputBoxError]}>
            <TextInput
              style={styles.textInput}
              placeholder="What shall we call you?"
              placeholderTextColor={Colors.textMuted}
              value={pseudoName}
              onChangeText={v => { setPseudoName(v); clearError('pseudoName'); }}
              onBlur={() => checkPseudoNameAvailability(pseudoName)}
              maxLength={50}
            />
          </View>
          {!!errors.pseudoName && <Text style={styles.errorText}>{errors.pseudoName}</Text>}
          {!errors.pseudoName && checkingName && <Text style={styles.hintText}>Checking availability...</Text>}

          {/* Identity */}
          <Text style={styles.identityQuestion}>
            Do you identify as a person with a disability?
          </Text>

          {IDENTITY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={styles.radioOption}
              onPress={() => setIdentityVisibility(opt.value)}
              activeOpacity={0.7}
            >
              <View style={[styles.radioCircle, identityVisibility === opt.value && styles.radioCircleActive]}>
                {identityVisibility === opt.value && <View style={styles.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.radioLabel}>{opt.label}</Text>
                {opt.hint && <Text style={styles.radioHint}>{opt.hint}</Text>}
              </View>
            </TouchableOpacity>
          ))}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.continueBtnText}>Start My Journey</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },

  backBtn: {
    marginBottom: 16,
  },
  backArrow: {
    fontSize: 19,
    color: Colors.text,
    fontFamily: 'Gilroy-SemiBold',
  },

  pageTitle: {
    fontSize: 24,
    fontFamily: 'Gilroy-Black',
    color: Colors.text,
    lineHeight: 32,
    marginBottom: 28,
  },
  pageTitleAccent: {
    color: ACCENT,
    fontFamily: 'Gilroy-Black',
  },

  radioOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
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
  radioCircleActive: {
    borderColor: ACCENT,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: ACCENT,
  },
  radioContent: {
    flex: 1,
  },
  radioTitle: {
    fontSize: 15,
    fontFamily: 'Gilroy-SemiBold',
    color: Colors.text,
  },
  radioTitleActive: {
    color: ACCENT,
  },
  radioSubtitle: {
    fontSize: 12,
    fontFamily: 'Gilroy-Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  radioLabel: {
    fontSize: 14,
    fontFamily: 'Gilroy-SemiBold',
    color: Colors.text,
  },
  radioHint: {
    fontSize: 12,
    fontFamily: 'Gilroy-Regular',
    color: Colors.textMuted,
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 20,
  },

  sectionLabel: {
    fontSize: 14,
    fontFamily: 'Gilroy-Bold',
    color: Colors.text,
    marginBottom: 10,
  },
  inputBox: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  inputBoxError: {
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  textInput: {
    height: 52,
    fontSize: 14,
    fontFamily: 'Gilroy-Regular',
    color: Colors.text,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Gilroy-Regular',
    color: Colors.error,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 12,
    fontFamily: 'Gilroy-Regular',
    color: Colors.textMuted,
    marginBottom: 12,
  },

  identityQuestion: {
    fontSize: 14,
    fontFamily: 'Gilroy-Bold',
    color: Colors.text,
    lineHeight: 20,
    marginTop: 20,
    marginBottom: 16,
  },

  addressBlock: {
    marginTop: 8,
    marginBottom: 4,
  },
  addressTitle: {
    fontSize: 15,
    fontFamily: 'Gilroy-Bold',
    color: Colors.text,
    marginBottom: 16,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Gilroy-Bold',
    color: Colors.text,
  },
  fieldCounter: {
    fontSize: 11,
    fontFamily: 'Gilroy-Regular',
    color: Colors.textMuted,
  },
  cityRow: { flexDirection: 'row', gap: 8 },
  cityInput: { flex: 3 },
  stateInput: { flex: 2 },
  zipInput: { flex: 2 },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  checkmark: {
    fontSize: 13,
    color: Colors.white,
    fontFamily: 'Gilroy-Bold',
  },
  consentDesc: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Gilroy-Regular',
    color: Colors.text,
    lineHeight: 20,
  },

  continueBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  continueBtnDisabled: {
    opacity: 0.6,
  },
  continueBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: 'Gilroy-SemiBold',
  },
});
