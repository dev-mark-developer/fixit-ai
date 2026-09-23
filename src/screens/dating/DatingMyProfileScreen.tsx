import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Dimensions,
  ActivityIndicator, Platform, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchImageLibrary } from 'react-native-image-picker';
import { extractApiError } from '../../utils/apiError';
import { imageRejectionReason, uploadOutcomeAlert } from '../../utils/imageUpload';
import { canonicalMime } from '../../utils/mime';
import { datingApi, DatingProfile, DatingImage } from '../../api/dating';
import { usersApi } from '../../api/users';
import { Colors } from '../../utils/colors';
import RemoteImage from '../../components/common/RemoteImage';
import { useAuth } from '../../store/AuthContext';
import { useModuleStatus } from '../../store/ModuleStatusContext';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';
import CountryPicker from '../../components/common/CountryPicker';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';
import DatingTopBar from '../../components/dating/DatingTopBar';
import DatingBottomBar from '../../components/dating/DatingBottomBar';
import { parseApiDateOnly, toApiDate } from '../../utils/datetime';

const GRID_GAP = 10;
const TILE_W = (Dimensions.get('window').width - 48 - GRID_GAP * 2) / 3;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatDate = (d: Date) =>
  `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
const MAX_DOB = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d; })();

/**
 * "My Profile" tab (Figma pg 25/44): avatar + gender badge, name/email,
 * editable dating profile + photo gallery.
 *
 * NOTE: pseudo name / DOB / country / city / state are collected in the UI
 * but the dating profile endpoint only accepts about/interestedInGender/
 * displayImageId — logged in API_CHANGES_NEEDED. Gallery + bio use the
 * existing endpoints.
 */
export default function DatingMyProfileScreen() {
  const { user, updateUser } = useAuth();
  const { datingType } = useModuleStatus();
  const isSpiritual = datingType === 'Spiritual';
  const accent = isSpiritual ? Colors.spiritual : Colors.dating;
  const lime = isSpiritual ? Colors.spiritualLime : Colors.datingSecondary;

  const [profile, setProfile] = useState<DatingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** "2/5" under the tile while a multi-photo pick uploads one by one. */
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  /** Shows the new photo immediately after upload, before the profile refetch. */
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  // Editable fields — all persisted via POST /dating/profile (gap #8 resolved)
  /**
   * First and last name belong to the account, not the dating profile, so they
   * save through `PATCH /users/me` alongside it. They used to be read-only
   * here, which left no way to correct a name from this screen at all — the
   * only other place is Profile › Edit Profile, which a dating user never
   * passes through.
   */
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [pseudoName, setPseudoName] = useState('');
  const [bio, setBio] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  // Gender for the avatar badge — from the account profile (gap #8)
  const [gender, setGender] = useState<string | null>(null);
  /** The account's profile picture, which is what the avatar shows. */
  const [accountImageUrl, setAccountImageUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    // The avatar badge's gender and the profile picture itself both live on
    // the account, not the dating profile.
    usersApi.getProfile()
      .then((r) => {
        setGender(r.data?.data?.gender ?? null);
        setAccountImageUrl(r.data?.data?.profileImageUrl ?? null);
      })
      .catch(() => {});
    try {
      const res = await datingApi.getProfile();
      const p: DatingProfile | null = res.data?.data ?? null;
      setProfile(p);
      // All of these are now returned/accepted by the API (gap #8 resolved)
      if (p?.about) setBio(p.about);
      if (p?.pseudoName) setPseudoName(p.pseudoName);
      if (p?.dateOfBirth) {
        const d = parseApiDateOnly(p.dateOfBirth);
        if (!Number.isNaN(d.getTime())) setDob(d);
      }
      if (p?.country) setCountry(p.country);
      if (p?.city) setCity(p.city);
      if (p?.state) setStateVal(p.state);
    } catch {
      // profile may not exist yet — screen still renders
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setFirstName((current) => current || user.firstName);
    setLastName((current) => current || user.lastName);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleUpload = () => {
    launchImageLibrary({
      mediaType: 'photo',
      // 0 = pick as many as you like. There is no client-side cap because the
      // gallery ceiling is an admin-panel setting with no endpoint to read it
      // from (see docs/API_CHANGES_NEEDED.md gap #28) — the server enforces it
      // and names it when it refuses, which is handled below.
      selectionLimit: 0,
      quality: 0.8,
      // Gallery shots are viewed full-screen, so they keep more detail than
      // an avatar — but still nowhere near a 4032px camera original.
      maxWidth: 1440,
      maxHeight: 1440,
    }, async (res) => {
      const picked = (res.assets ?? []).filter((a) => a.uri);
      if (picked.length === 0) return;

      // One unsupported file in a multi-pick shouldn't stop the rest.
      const skipped: string[] = [];
      const accepted = picked.filter((asset) => {
        const reason = imageRejectionReason(asset);
        if (reason) skipped.push(reason);
        return !reason;
      });

      setUploading(true);
      setUploadProgress(accepted.length > 1 ? { done: 0, total: accepted.length } : null);
      let uploaded = 0;
      let failure: string | null = null;
      try {
        // Sequential, because the endpoint takes one file per call and the
        // ceiling is enforced server-side: uploading in parallel would fire
        // every request before the first refusal could come back.
        for (const asset of accepted) {
          try {
            await datingApi.uploadImage(asset.uri!, canonicalMime(asset.type) || 'image/jpeg');
            uploaded += 1;
            setUploadProgress((p) => (p ? { ...p, done: uploaded } : null));
          } catch (err) {
            failure = extractApiError(err, 'Could not upload the photo. Please try again.');
            break;
          }
        }
        if (uploaded > 0) await load();
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }

      const outcome = uploadOutcomeAlert({
        uploaded,
        attempted: accepted.length,
        skipped,
        failure,
      });
      if (outcome) setAlert(outcome);
    });
  };

  /**
   * Tap the avatar → set the **account's profile picture**, via
   * `POST /users/me/profile-image`.
   *
   * This used to push the photo into the dating gallery and mark it the
   * display image, which conflated two separate things: My Gallery is the
   * dating photo set, the profile picture is the account's own photo — the one
   * the sign-up flow collects and the one other people see in a profile
   * header. Uploading an avatar no longer adds a gallery tile.
   */
  const handleAvatarUpload = () => {
    launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      // Shown as a circle, so there is no reason to ship a 4032px original.
      maxWidth: 512,
      maxHeight: 512,
    }, async (res) => {
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      const rejection = imageRejectionReason(asset);
      if (rejection) {
        setAlert({ title: 'Photo Not Supported', message: rejection });
        return;
      }
      setUploadingAvatar(true);
      try {
        const uploadRes = await usersApi.uploadProfileImage(
          asset.uri,
          canonicalMime(asset.type) || 'image/jpeg',
        );
        const returned = uploadRes.data?.data;
        const newUrl = typeof returned === 'string' ? returned : returned?.profileImageUrl;
        // Cache-bust: the backend reuses the path, so the old bitmap would win.
        setAvatarOverride(
          newUrl ? `${newUrl}${newUrl.includes('?') ? '&' : '?'}t=${Date.now()}` : asset.uri,
        );
        await load();
      } catch (err) {
        setAlert({
          title: 'Upload Failed',
          message: extractApiError(err, 'Could not update your profile photo. Please try again.'),
        });
      } finally {
        setUploadingAvatar(false);
      }
    });
  };

  const handleDeleteImage = async (img: DatingImage) => {
    try {
      await datingApi.deleteImage(img.id);
      await load();
    } catch (err) {
      setAlert({
        title: 'Error',
        message: extractApiError(err, 'Could not remove the photo. Please try again.'),
      });
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    if (!firstName.trim() || !lastName.trim()) {
      setAlert({ title: 'Name Required', message: 'Please enter both your first and last name.' });
      return;
    }
    setSaving(true);
    try {
      // Account fields first: if this fails the dating profile is untouched,
      // so a retry cannot half-apply the form.
      const nameChanged =
        firstName.trim() !== user?.firstName || lastName.trim() !== user?.lastName;
      if (nameChanged) {
        await usersApi.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
        // Patches the session copy the drawers and headers read from.
        await updateUser({ firstName: firstName.trim(), lastName: lastName.trim() });
      }
      // Full field set now accepted by the backend (gap #8 resolved)
      await datingApi.saveProfile({
        datingType: profile.datingType,
        about: bio.trim() || undefined,
        interestedInGender: profile.interestedInGender,
        displayImageId: profile.displayImageId,
        pseudoName: pseudoName.trim() || undefined,
        dateOfBirth: dob ? toApiDate(dob) : undefined,
        country: country || undefined,
        city: city.trim() || undefined,
        state: stateVal.trim() || undefined,
      });
      await load();
      setAlert({ title: 'Saved', message: 'Your profile changes have been saved.' });
    } catch (err) {
      setAlert({
        title: 'Error',
        message: extractApiError(err, 'Could not save your profile. Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  };

  // The account's profile picture first: that is what the avatar now sets, and
  // what other people see in a profile header. The dating display image is
  // only a fallback for accounts that set one before the two were separated.
  const avatarUri =
    avatarOverride ?? accountImageUrl ?? profile?.profileImageUrl ?? profile?.displayImageUrl;
  // Gender badge (Figma) — gender now comes from GET /users/me (gap #8 resolved)
  const genderIcon =
    gender?.toLowerCase() === 'female'
      ? 'female'
      : gender?.toLowerCase() === 'male'
        ? 'male'
        : 'person';

  // The avatar (display image) lives in the same image pool as the gallery —
  // keep the two sections separate by hiding it from the grid.
  const galleryImages = (profile?.images ?? []).filter(
    (img) =>
      img.id !== profile?.displayImageId &&
      img.imageUrl !== profile?.displayImageUrl,
  );

  return (
    <SafeAreaView style={styles.root}>
      <DatingTopBar />

      <KeyboardAwareScrollView contentContainerStyle={styles.container} extraHeight={80}>
        {/* Avatar + gender badge — tap to change the profile photo */}
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={handleAvatarUpload}
          activeOpacity={0.8}
          disabled={uploadingAvatar}
        >
          {avatarUri ? (
            <RemoteImage
              uri={avatarUri}
              style={styles.avatar}
              indicatorColor={accent}
            />
          ) : (
            <Image source={require('../../assets/profile.png')} style={styles.avatar} />
          )}
          {uploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={Colors.white} size="small" />
            </View>
          )}
          <View style={[styles.genderBadge, { backgroundColor: lime }]}>
            <Icon name={genderIcon} size={16} color={accent} />
          </View>
          <View style={[styles.cameraBadge, { backgroundColor: accent }]}>
            <Icon name="camera" size={13} color={Colors.white} />
          </View>
        </TouchableOpacity>
        <Text style={styles.name}>
          {user ? `${user.firstName} ${user.lastName}` : '—'}
        </Text>
        {!!user?.email && (
          <Text style={[styles.email, { color: accent }]}>{user.email}</Text>
        )}

        {loading ? (
          // The account details above come from the session, so they show at
          // once; only the dating profile below waits on the network. The form
          // mounts when it arrives, so nothing typed early can be overwritten.
          <View style={styles.formLoading}>
            <ActivityIndicator size="large" color={accent} />
          </View>
        ) : (
          <>
            {/* Names (owned by the account, not the dating profile) */}
            <View style={styles.row}>
              <AppInput label="First Name" value={firstName} onChangeText={setFirstName}
                placeholder="First name" maxLength={50} showCounter={false}
                containerStyle={styles.rowField} />
              <AppInput label="Last Name" value={lastName} onChangeText={setLastName}
                placeholder="Last name" maxLength={50} showCounter={false}
                containerStyle={styles.rowField} />
            </View>

            {isSpiritual && (
              <AppInput label="Pseudo Name*" placeholder="Enter pseudo name" value={pseudoName}
                onChangeText={setPseudoName} maxLength={50} />
            )}

            <AppInput label={isSpiritual ? 'Spiritual Bio*' : 'About You*'}
              placeholder={isSpiritual ? 'Enter you spiritual journey' : 'Tell others about yourself'}
              value={bio} onChangeText={setBio} maxLength={1000}
              multiline numberOfLines={5} style={styles.bioInput} />

            {/* Date of Birth */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Date of Birth</Text>
              <TouchableOpacity style={styles.selectBox} onPress={() => setShowDatePicker(true)}>
                <Text style={dob ? styles.selectText : styles.selectPlaceholder}>
                  {dob ? formatDate(dob) : 'Select date of birth'}
                </Text>
                <Image source={require('../../assets/calendar.png')} style={styles.calendarIcon} resizeMode="contain" />
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              Platform.OS === 'ios' ? (
                <View style={styles.iosPicker}>
                  <View style={styles.iosPickerBar}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={[styles.iosPickerDone, { color: accent }]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={dob ?? MAX_DOB}
                    mode="date"
                    display="spinner"
                    maximumDate={MAX_DOB}
                    // Pinned light: the wheel otherwise follows the system
                    // appearance and drew light text on this light container
                    // in dark mode. The app's palette is light-only.
                    themeVariant="light"
                    onChange={(_, date) => { if (date) setDob(date); }}
                  />
                </View>
              ) : (
                <DateTimePicker
                  value={dob ?? MAX_DOB}
                  mode="date"
                  display="default"
                  maximumDate={MAX_DOB}
                  onChange={(_, date) => { setShowDatePicker(false); if (date) setDob(date); }}
                />
              )
            )}

            {/* Country */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Where do You Live?</Text>
              <TouchableOpacity style={styles.selectBox} onPress={() => setShowCountryPicker(true)}>
                <Text style={country ? styles.selectText : styles.selectPlaceholder}>
                  {country || 'Select your country'}
                </Text>
                <Icon name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* City / State */}
            <View style={styles.row}>
              <AppInput label="City" placeholder="Enter your city" value={city}
                onChangeText={setCity} maxLength={50} containerStyle={styles.rowField} />
              <AppInput label="State" placeholder="Enter your state" value={stateVal}
                onChangeText={setStateVal} maxLength={50} containerStyle={styles.rowField} />
            </View>

            {/* Gallery */}
            <Text style={styles.galleryTitle}>My Gallery</Text>
            <View style={styles.galleryGrid}>
              <TouchableOpacity
                style={styles.uploadTile}
                onPress={handleUpload}
                activeOpacity={0.75}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <ActivityIndicator color={accent} />
                    {uploadProgress && (
                      <Text style={styles.uploadTileText}>
                        {uploadProgress.done}/{uploadProgress.total}
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <Icon name="image-outline" size={30} color={accent} />
                    <Text style={styles.uploadTileText}>Upload Photos</Text>
                  </>
                )}
              </TouchableOpacity>

              {galleryImages.map((img) => (
                <View key={img.id} style={styles.photoTile}>
                  <RemoteImage uri={img.imageUrl} style={styles.photoImg} indicatorColor={accent} />
                  <TouchableOpacity
                    style={[styles.deleteBadge, { backgroundColor: lime }]}
                    onPress={() => handleDeleteImage(img)}
                    hitSlop={6}
                  >
                    <Icon name="trash-outline" size={14} color={Colors.text} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <AppButton
              title="Save Changes"
              onPress={handleSave}
              loading={saving}
              style={{ ...styles.saveBtn, backgroundColor: accent }}
            />
          </>
        )}
      </KeyboardAwareScrollView>

      <DatingBottomBar active="DatingMyProfile" />

      <CountryPicker
        visible={showCountryPicker}
        selected={country}
        onSelect={(c) => setCountry(c)}
        onClose={() => setShowCountryPicker(false)}
      />

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
  container: { padding: 24, paddingTop: 8, paddingBottom: 140 },
  formLoading: { paddingVertical: 48, alignItems: 'center' },

  avatarWrap: { alignSelf: 'center', width: 96, height: 96, marginBottom: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.surface },
  genderBadge: {
    position: 'absolute', top: 0, right: -4,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  avatarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 48, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: -4,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  name: { fontSize: 19, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  email: { fontSize: 13, textAlign: 'center', marginTop: 2, marginBottom: 22 },

  row: { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1, marginBottom: 16 },

  bioInput: { height: 120, textAlignVertical: 'top', paddingTop: 12, flex: 1, fontSize: 15, color: Colors.text },

  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: Colors.text, marginBottom: 6 },
  selectBox: {
    height: 52, borderRadius: 12, backgroundColor: Colors.surface, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectText: { fontSize: 15, color: Colors.text, flex: 1 },
  selectPlaceholder: { fontSize: 15, color: Colors.textMuted, flex: 1 },
  calendarIcon: { width: 20, height: 20 },

  iosPicker: { backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  iosPickerBar: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iosPickerDone: { fontSize: 16, fontWeight: '700' },

  galleryTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 6, marginBottom: 12 },
  galleryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginBottom: 22,
  },
  uploadTile: {
    width: TILE_W, height: TILE_W * 1.2, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.white,
  },
  uploadTileText: { fontSize: 12, color: Colors.textSecondary },
  photoTile: {
    width: TILE_W, height: TILE_W * 1.2, borderRadius: 14, overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  deleteBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },

  saveBtn: { marginTop: 4 },
});
