import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PenpalStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { penpalApi } from '../../api/penpal';

type Props = NativeStackScreenProps<PenpalStackParamList, 'PenpalCompose'>;

const TITLE_MAX = 100;
const CONTENT_MAX = 5000;

export default function PenpalComposeScreen({ route, navigation }: Props) {
  const { receiverId, receiverPseudoName } = route.params;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!title.trim()) { e.title = 'Subject is required'; }
    if (!content.trim()) { e.content = 'Letter content is required'; }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSend = async () => {
    if (!validate()) { return; }
    setLoading(true);
    try {
      await penpalApi.sendLetter(receiverId, title.trim(), content.trim());
      Alert.alert('Letter Sent!', `Your letter to ${receiverPseudoName} has been delivered.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Failed to send letter. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.toRow}>
          <Text style={styles.toLabel}>To:</Text>
          <Text style={styles.toName}>{receiverPseudoName}</Text>
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Subject</Text>
            <Text style={[styles.counter, title.length >= TITLE_MAX * 0.85 && styles.counterNear]}>
              {title.length}/{TITLE_MAX}
            </Text>
          </View>
          <TextInput
            style={[styles.input, errors.title ? styles.inputError : null]}
            placeholder="What's your letter about?"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={(v) => { setTitle(v); setErrors((e) => ({ ...e, title: '' })); }}
            maxLength={TITLE_MAX}
          />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Your Letter</Text>
            <Text style={[styles.counter, content.length >= CONTENT_MAX * 0.85 && styles.counterNear]}>
              {content.length}/{CONTENT_MAX}
            </Text>
          </View>
          <TextInput
            style={[styles.contentInput, errors.content ? styles.inputError : null]}
            placeholder="Write your letter here..."
            placeholderTextColor={Colors.textMuted}
            value={content}
            onChangeText={(v) => { setContent(v); setErrors((e) => ({ ...e, content: '' })); }}
            multiline
            textAlignVertical="top"
            maxLength={CONTENT_MAX}
          />
          {errors.content ? <Text style={styles.errorText}>{errors.content}</Text> : null}
        </View>

        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.sendBtnText}>Send Letter ✉️</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 24 },
  toRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.primaryMuted,
  },
  toLabel: { fontSize: 14, color: Colors.textSecondary, marginRight: 10, fontWeight: '600' },
  toName: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  field: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  counter: { fontSize: 11, color: Colors.textMuted },
  counterNear: { color: Colors.error },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14,
    fontSize: 15, color: Colors.text, backgroundColor: Colors.surface,
  },
  contentInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14,
    fontSize: 15, color: Colors.text, backgroundColor: Colors.surface,
    minHeight: 220,
  },
  inputError: { borderColor: Colors.error },
  errorText: { fontSize: 12, color: Colors.error, marginTop: 4 },
  sendBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 16,
  },
  sendBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
