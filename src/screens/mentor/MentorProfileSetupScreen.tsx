import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MentorStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { resolveImageUrl } from '../../utils/imageUrl';
import { useAuth } from '../../store/AuthContext';
import { useModuleStatus } from '../../store/ModuleStatusContext';
import { saveSession } from '../../store/auth';
import api from '../../api/axios';
import { mentorApi } from '../../api/mentor';
import { usersApi } from '../../api/users';
import AppInput from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AppAlert, { AlertButton } from '../../components/common/AppAlert';
import CountryPicker from '../../components/common/CountryPicker';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';

type Props = NativeStackScreenProps<MentorStackParamList, 'MentorProfileSetup'>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatDate = (d: Date) =>
  `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
const MAX_DOB = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d; })();

export default function MentorProfileSetupScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { isMentor, refresh } = useModuleStatus();

  // API-backed fields (submitted): displayName (first+last) → tagline (title) → bio (about)
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [title, setTitle] = useState('');
  const [about, setAbout] = useState('');

  // Full field set accepted by POST /mentor/profile since gap #4 was resolved.
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{
    title: string;
    message: string;
    buttons?: AlertButton[];
  } | null>(null);

  const clearError = (key: string) => setErrors((e) => ({ ...e, [key]: '' }));

  // Prefill from the account the user already registered with — name, DOB and
  // location are known, so only the guru-specific fields need typing. Existing
  // input is never overwritten (guards against a slow response clobbering it).
  useEffect(() => {
    let active = true;
    usersApi.getProfile()
      .then((res) => {
        const p = res.data?.data;
        if (!active || !p) return;
        setFirstName((v) => v || p.firstName || '');
        setLastName((v) => v || p.lastName || '');
        setCountry((v) => v || p.country || '');
        setCity((v) => v || p.city || '');
        setStateVal((v) => v || p.state || '');
        if (p.dateOfBirth) {
          const d = new Date(p.dateOfBirth);
          if (!Number.isNaN(d.getTime())) setDob((v) => v ?? d);
        }
        if (p.profileImageUrl) {
          setProfileImageUri((v) => v ?? resolveImageUrl(p.profileImageUrl) ?? null);
        }
      })
      .catch(() => {
        // offline / not reachable — the form still works, just unfilled
      });
    return () => { active = false; };
  }, []);

  const pickImage = () => {
    launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      // Rendered as a small circle everywhere — no reason to ship the
      // camera's full-resolution original over the wire.
      maxWidth: 512,
      maxHeight: 512,
    }, (res) => {
      if (res.assets?.[0]?.uri) setProfileImageUri(res.assets[0].uri);
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    if (!title.trim()) e.title = 'Title is required';
    if (!about.trim()) e.about = 'This field is required';
    else if (about.trim().length < 20) e.about = 'Please write at least 20 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // The account is upgraded to Mentor only now, on save — so a user who
      // backs out of this form stays a normal user.
      if (!isMentor) {
        const res = await api.post('/users/upgrade-to-mentor');
        const { accessToken } = res.data?.data ?? {};
        if (!accessToken) throw new Error('Invalid server response.');
        await saveSession(accessToken, { ...user!, role: 'Mentor' });
      }

      // Full field set now accepted by the backend (gap #4 resolved).
      // Photo still goes through the shared account endpoint.
      await mentorApi.saveProfile({
        displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        bio: about.trim(),
        tagline: title.trim() || undefined,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        dateOfBirth: dob ? dob.toISOString().slice(0, 10) : undefined,
        country: country || undefined,
        city: city.trim() || undefined,
        state: stateVal.trim() || undefined,
      });
      if (profileImageUri) {
        await usersApi.uploadProfileImage(profileImageUri).catch(() => {
          // profile saved — a failed photo upload shouldn't block onboarding
        });
      }

      if (isMentor) {
        // Already inside the mentor stack — continue to the plan screen
        navigation.replace('MentorSubscription');
      } else {
        // refresh() sees role=Mentor and swaps the tree to MentorNavigator
        await refresh();
      }
    } catch (err: any) {
      setAlert({ title: 'Error', message: err.response?.data?.message ?? 'Failed to save profile. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const fullName = `${firstName} ${lastName}`.trim() || user?.email || '';

  const handleBack = () => {
    // Reached from "Become a Spiritual Guru" (not yet a mentor) → just pop.
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    // Already a mentor with no profile: this is the mentor stack's first
    // screen, so leaving means continuing without a finished profile.
    setAlert({
      title: 'Finish Later?',
      message:
        'Your guru profile is not complete yet. You can leave this step and finish it later from Edit Profile.',
      buttons: [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => navigation.replace('MentorMain'),
        },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* This screen is the mentor stack's initial route right after the
          upgrade, so there is usually nothing to pop. Offer a way back to the
          rest of the app instead of a dead arrow. */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={handleBack} hitSlop={8}>
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.container} extraHeight={80}>
        <Text style={styles.title}>Ready To Begin?</Text>
        <Text style={styles.subtitle}>
          Before you can guide others, your own presence must be clear. Complete
          your profile to ensure seekers can feel your resonance and begin their
          journey with you.
        </Text>

        {/* Avatar */}
        <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} activeOpacity={0.8}>
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={styles.avatar} />
          ) : (
            <Image source={require('../../assets/profile.png')} style={styles.avatar} />
          )}
          <View style={styles.avatarBadge}>
            <Icon name="camera" size={13} color={Colors.white} />
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarName}>{fullName}</Text>
        {!!user?.email && <Text style={styles.avatarEmail}>{user.email}</Text>}

        {/* Name */}
        <View style={styles.row}>
          <AppInput label="First Name*" placeholder="Enter first name" value={firstName}
            onChangeText={(v) => { setFirstName(v); clearError('firstName'); }}
            error={errors.firstName} maxLength={50} containerStyle={styles.rowField} />
          <AppInput label="Last Name*" placeholder="Enter last name" value={lastName}
            onChangeText={(v) => { setLastName(v); clearError('lastName'); }}
            error={errors.lastName} maxLength={50} containerStyle={styles.rowField} />
        </View>

        <AppInput label="Your Title*" placeholder="Enter your title here" value={title}
          onChangeText={(v) => { setTitle(v); clearError('title'); }}
          error={errors.title} maxLength={150} />

        <AppInput label="Phone Number*" placeholder="Enter your phone number here" value={phone}
          onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />

        <AppInput label="About You*" placeholder="Enter you spiritual journey" value={about}
          onChangeText={(v) => { setAbout(v); clearError('about'); }}
          error={errors.about} maxLength={1000} multiline numberOfLines={5}
          style={styles.aboutInput} />

        {/* Date of Birth */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Date of Birth*</Text>
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
                  <Text style={styles.iosPickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dob ?? MAX_DOB}
                mode="date"
                display="spinner"
                maximumDate={MAX_DOB}
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
          <Text style={styles.label}>Where do You Live?*</Text>
          <TouchableOpacity style={styles.selectBox} onPress={() => setShowCountryPicker(true)}>
            <Text style={country ? styles.selectText : styles.selectPlaceholder}>
              {country || 'Select your country'}
            </Text>
            <Text style={styles.selectChevron}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* City / State */}
        <View style={styles.row}>
          <AppInput label="City*" placeholder="Enter your city" value={city}
            onChangeText={setCity} maxLength={50} containerStyle={styles.rowField} />
          <AppInput label="State*" placeholder="Enter your state" value={stateVal}
            onChangeText={setStateVal} maxLength={50} containerStyle={styles.rowField} />
        </View>

        <AppButton title="Save and Subscribe" onPress={handleSave} loading={loading} style={styles.btn} />
      </KeyboardAwareScrollView>

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
        buttons={alert?.buttons}
        onClose={() => setAlert(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  headerBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  container: { padding: 24, paddingTop: 8, paddingBottom: 40 },

  title: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 20 },

  avatarWrap: { alignSelf: 'center', width: 84, height: 84, marginBottom: 10 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: Colors.surface },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.mentor, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  avatarName: { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  avatarEmail: { fontSize: 13, color: Colors.mentor, textAlign: 'center', marginTop: 2, marginBottom: 20 },

  row: { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1, marginBottom: 16 },

  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: Colors.text, marginBottom: 6 },
  selectBox: {
    height: 52, borderRadius: 12, backgroundColor: Colors.surface, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectText: { fontSize: 15, color: Colors.text, flex: 1 },
  selectPlaceholder: { fontSize: 15, color: Colors.textMuted, flex: 1 },
  selectChevron: { fontSize: 13, color: Colors.textMuted },
  calendarIcon: { width: 20, height: 20 },

  aboutInput: { height: 120, textAlignVertical: 'top', paddingTop: 12, flex: 1, fontSize: 15, color: Colors.text },

  iosPicker: { backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  iosPickerBar: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iosPickerDone: { fontSize: 16, fontWeight: '700', color: Colors.mentor },

  btn: { marginTop: 8, backgroundColor: Colors.mentor },
});
