import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { usersApi, UserProfile } from '../../api/users';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';
import CountryPicker from '../../components/common/CountryPicker';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

const GENDERS = ['Male', 'Female'];

const extractError = (err: any): string => {
  const data = err?.response?.data;
  if (!err?.response) return 'Unable to connect to server. Please check your network.';
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

export default function EditProfileScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [gender, setGender] = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [alert, setAlert] = useState<{
    title: string;
    message: string;
    buttons?: AlertButton[];
  } | null>(null);

  const showAlert = (title: string, message: string, buttons?: AlertButton[]) =>
    setAlert({ title, message, buttons });

  const clearError = (key: string) =>
    setErrors((prev) => ({ ...prev, [key]: '' }));

  const fetchProfile = useCallback(async () => {
    setFetching(true);
    try {
      const res = await usersApi.getProfile();
      const data = res.data?.data;
      if (data) {
        setProfile(data);
        setFirstName(data.firstName ?? '');
        setLastName(data.lastName ?? '');
        setCountry(data.country ?? '');
        setCity(data.city ?? '');
        setState(data.state ?? '');
        setGender(data.gender ?? '');
      }
    } catch (err: any) {
      showAlert('Error', extractError(err));
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const initials = profile
    ? `${(profile.firstName ?? '?').charAt(0)}${(profile.lastName ?? '?').charAt(0)}`.toUpperCase()
    : '??';

  const pickImage = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8, includeBase64: false },
      async (response) => {
        const uri = response.assets?.[0]?.uri;
        if (!uri) return;
        setProfileImageUri(uri);
        setUploadingImage(true);
        try {
          await usersApi.uploadProfileImage(uri);
        } catch (err: any) {
          showAlert('Image Upload Failed', extractError(err));
          setProfileImageUri(null);
        } finally {
          setUploadingImage(false);
        }
      },
    );
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (firstName.trim() !== (profile?.firstName ?? '')) payload.firstName = firstName.trim();
      if (lastName.trim() !== (profile?.lastName ?? '')) payload.lastName = lastName.trim();
      if (country !== (profile?.country ?? '')) payload.country = country;
      if (city.trim() !== (profile?.city ?? '')) payload.city = city.trim();
      if (state.trim() !== (profile?.state ?? '')) payload.state = state.trim();
      if (gender !== (profile?.gender ?? '')) payload.gender = gender;

      if (Object.keys(payload).length > 0) {
        await usersApi.updateProfile(payload);
      }

      showAlert('Profile Updated', 'Your profile has been saved successfully.', [
        {
          text: 'OK',
          style: 'default',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err: any) {
      showAlert('Save Failed', extractError(err));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const remoteImageUrl = profile?.profileImageUrl;
  const displayImageUri = profileImageUri ?? remoteImageUrl ?? null;

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      {/* Avatar */}
      <TouchableOpacity
        style={styles.avatarWrap}
        onPress={pickImage}
        activeOpacity={0.8}
        disabled={uploadingImage}
      >
        {displayImageUri ? (
          <Image source={{ uri: displayImageUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.avatarBadge}>
          {uploadingImage ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.avatarBadgeText}>+</Text>
          )}
        </View>
      </TouchableOpacity>
      <Text style={styles.avatarHint}>
        {uploadingImage ? 'Uploading...' : 'Tap to change photo'}
      </Text>

      {/* Fields */}
      <AppInput
        label="First Name"
        placeholder="Enter first name"
        value={firstName}
        onChangeText={(v) => { setFirstName(v); clearError('firstName'); }}
        error={errors.firstName}
        maxLength={100}
      />
      <AppInput
        label="Last Name"
        placeholder="Enter last name"
        value={lastName}
        onChangeText={(v) => { setLastName(v); clearError('lastName'); }}
        error={errors.lastName}
        maxLength={100}
      />

      {/* Country picker */}
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Country</Text>
        <TouchableOpacity
          style={styles.selectBox}
          onPress={() => setShowCountryPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={country ? styles.selectText : styles.selectPlaceholder}>
            {country || 'Select your country'}
          </Text>
          <Text style={styles.selectChevron}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      <AppInput
        label="City"
        placeholder="e.g. New York"
        value={city}
        onChangeText={(v) => { setCity(v); clearError('city'); }}
        error={errors.city}
        maxLength={100}
      />
      <AppInput
        label="State / Province"
        placeholder="e.g. NY"
        value={state}
        onChangeText={(v) => { setState(v); clearError('state'); }}
        error={errors.state}
        maxLength={100}
      />

      {/* Gender */}
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
              onPress={() => { setGender(g); clearError('gender'); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {!!errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
      </View>

      <AppButton
        title="Save Changes"
        onPress={handleSave}
        loading={loading}
        style={styles.saveBtn}
      />

      <CountryPicker
        visible={showCountryPicker}
        selected={country}
        onSelect={(c) => { setCountry(c); setShowCountryPicker(false); }}
        onClose={() => setShowCountryPicker(false)}
      />

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
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    padding: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },

  avatarWrap: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    marginBottom: 6,
    position: 'relative',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    borderWidth: 2,
    borderColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.primary,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  avatarBadgeText: {
    fontSize: 18,
    color: Colors.white,
    fontWeight: '700',
    lineHeight: 22,
  },
  avatarHint: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 24,
  },

  fieldWrap: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 6,
  },
  selectBox: {
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: 15, color: Colors.text, flex: 1 },
  selectPlaceholder: { fontSize: 15, color: Colors.textMuted, flex: 1 },
  selectChevron: { fontSize: 14, color: Colors.textMuted },

  genderRow: { flexDirection: 'row', gap: 12 },
  genderBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  genderBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  genderText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  genderTextActive: { color: Colors.primary },
  errorText: { marginTop: 4, fontSize: 12, color: Colors.error },

  saveBtn: { marginTop: 8 },
});
