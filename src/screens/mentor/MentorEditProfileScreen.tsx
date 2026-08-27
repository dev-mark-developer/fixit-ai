import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MentorStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import RemoteImage from '../../components/common/RemoteImage';
import { mentorApi } from '../../api/mentor';
import { usersApi } from '../../api/users';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';

type Props = NativeStackScreenProps<MentorStackParamList, 'MentorEditProfile'>;

export default function MentorEditProfileScreen({ navigation }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [remoteImageUrl, setRemoteImageUrl] = useState<string | null>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<{ title: string; message: string; buttons?: AlertButton[] } | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      const [mentorRes, userRes] = await Promise.allSettled([
        mentorApi.getProfile(),
        usersApi.getProfile(),
      ]);
      let mentorImg: string | null = null;
      let userImg: string | null = null;
      if (mentorRes.status === 'fulfilled') {
        const d = mentorRes.value.data?.data;
        if (d) {
          setDisplayName(d.displayName ?? '');
          setTagline(d.tagline ?? '');
          setBio(d.bio ?? '');
          mentorImg = d.profileImageUrl ?? null;
        }
      }
      if (userRes.status === 'fulfilled') {
        const d = userRes.value.data?.data;
        if (d) {
          setFirstName(d.firstName ?? '');
          setLastName(d.lastName ?? '');
          userImg = d.profileImageUrl ?? null;
        }
      }
      setRemoteImageUrl(mentorImg ?? userImg ?? null);
    } catch {
      setAlert({ title: 'Error', message: 'Could not load profile. Please try again.' });
    } finally {
      setFetching(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const pickImage = () => {
    launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      // Rendered as a small circle everywhere — no reason to ship the
      // camera's full-resolution original over the wire.
      maxWidth: 512,
      maxHeight: 512,
    }, async (response) => {
      const uri = response.assets?.[0]?.uri;
      if (!uri) return;
      setLocalImageUri(uri);
      setUploadingImage(true);
      try {
        const res = await usersApi.uploadProfileImage(uri);
        // Keep the server's URL so the avatar survives refetches; cache-bust
        // in case the backend reuses the same file path for every upload.
        const returned = res.data?.data;
        const newUrl =
          typeof returned === 'string' ? returned : returned?.profileImageUrl;
        if (newUrl) {
          setRemoteImageUrl(`${newUrl}${newUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
        }
      } catch {
        setAlert({ title: 'Upload Failed', message: 'Could not upload the image. Please try again.' });
        setLocalImageUri(null);
      } finally {
        setUploadingImage(false);
      }
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!displayName.trim()) e.displayName = 'Display name is required';
    if (!bio.trim()) e.bio = 'Bio is required';
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await Promise.all([
        mentorApi.saveProfile({
          displayName: displayName.trim(),
          bio: bio.trim(),
          tagline: tagline.trim() || undefined,
          // Name now also persisted on the mentor profile (gap #4 resolved)
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
        usersApi.updateProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      ]);
      setAlert({
        title: 'Profile Updated',
        message: 'Your profile has been saved successfully.',
        buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }],
      });
    } catch (err: any) {
      setAlert({ title: 'Error', message: err?.response?.data?.message ?? 'Could not save profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.mentor} />
      </View>
    );
  }

  const displayImageUri = localImageUri ?? remoteImageUrl ?? null;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container} extraHeight={80}>

      {/* Avatar */}
      <TouchableOpacity
        style={styles.avatarWrap}
        onPress={pickImage}
        activeOpacity={0.8}
        disabled={uploadingImage}
      >
        {displayImageUri ? (
          <RemoteImage
            uri={displayImageUri}
            style={styles.avatar}
            indicatorColor={Colors.mentor}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.avatarBadge}>
          {uploadingImage
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={styles.avatarBadgeText}>+</Text>}
        </View>
      </TouchableOpacity>
      <Text style={styles.avatarHint}>
        {uploadingImage ? 'Uploading...' : 'Tap to change photo'}
      </Text>

      {/* Guru Profile Section */}
      <Text style={styles.sectionLabel}>Guru Profile</Text>

      <AppInput
        label="Display Name"
        required
        placeholder="Your public name as a Guru"
        value={displayName}
        onChangeText={(v) => { setDisplayName(v); setErrors((e) => ({ ...e, displayName: '' })); }}
        error={errors.displayName}
        maxLength={80}
      />
      <AppInput
        label="Tagline"
        placeholder="A short phrase about your practice (optional)"
        value={tagline}
        onChangeText={setTagline}
        maxLength={120}
      />
      <AppInput
        label="Bio"
        required
        placeholder="Tell seekers about your spiritual background and approach..."
        value={bio}
        onChangeText={(v) => { setBio(v); setErrors((e) => ({ ...e, bio: '' })); }}
        error={errors.bio}
        maxLength={1000}
        multiline
        style={styles.bioInput}
      />

      <View style={styles.divider} />

      {/* Personal Info Section */}
      <Text style={styles.sectionLabel}>Personal Info</Text>

      <AppInput
        label="First Name"
        required
        placeholder="First name"
        value={firstName}
        onChangeText={(v) => { setFirstName(v); setErrors((e) => ({ ...e, firstName: '' })); }}
        error={errors.firstName}
        maxLength={100}
      />
      <AppInput
        label="Last Name"
        required
        placeholder="Last name"
        value={lastName}
        onChangeText={(v) => { setLastName(v); setErrors((e) => ({ ...e, lastName: '' })); }}
        error={errors.lastName}
        maxLength={100}
      />

      <AppButton
        title="Save Changes"
        onPress={handleSave}
        loading={saving}
        style={styles.saveBtn}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: 24, paddingBottom: 40 },

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
    borderColor: Colors.mentor,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.mentorLight,
    borderWidth: 2,
    borderColor: Colors.mentor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 30, fontWeight: '700', color: Colors.mentor },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.mentor,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  avatarBadgeText: { fontSize: 18, color: Colors.white, fontWeight: '700', lineHeight: 22 },
  avatarHint: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, marginBottom: 28 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  bioInput: { height: 130, textAlignVertical: 'top', paddingTop: 12, flex: 1, fontSize: 15, color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 20 },
  saveBtn: { marginTop: 8 },
});
