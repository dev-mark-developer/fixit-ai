import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!title.trim()) {
      Alert.alert('Add a title', 'Please give your letter a title.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Write something', 'Your letter is empty.');
      return;
    }
    setLoading(true);
    try {
      await penpalApi.sendLetter(receiverId, title.trim(), content.trim());
      Alert.alert(
        'Letter Sent!',
        `Your letter to ${receiverPseudoName} has been delivered.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.response?.data?.message ?? 'Failed to send letter. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSend} disabled={loading} hitSlop={8}>
          {loading ? (
            <ActivityIndicator color={Colors.penpal} />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.toLine}>To: {receiverPseudoName}</Text>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextInput
            style={styles.titleInput}
            placeholder="Title Here"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={TITLE_MAX}
          />
          <TextInput
            style={styles.contentInput}
            placeholder="Your message here"
            placeholderTextColor={Colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            maxLength={CONTENT_MAX}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backArrow: { fontSize: 24, color: Colors.text, fontWeight: '600' },
  sendText: { fontSize: 16, fontWeight: '700', color: Colors.penpal },
  toLine: {
    fontSize: 13,
    color: Colors.textMuted,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  body: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
  titleInput: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    paddingVertical: 10,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.text,
    paddingTop: 6,
    minHeight: 320,
  },
});
