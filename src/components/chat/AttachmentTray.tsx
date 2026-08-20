import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { StagedAttachment } from '../../services/chatAttachments';
import { MAX_CHAT_ATTACHMENTS } from '../../api/dating';
import { formatDuration, formatFileSize } from '../../utils/chatMedia';
import { Colors } from '../../utils/colors';

interface Props {
  items: StagedAttachment[];
  accent: string;
  /** Blocks removal while the multipart request is in flight. */
  uploading: boolean;
  onRemove: (key: string) => void;
  onClear: () => void;
}

/**
 * The staging strip above the composer. Everything here is still local —
 * nothing has been uploaded or sent until the user hits send.
 */
export default function AttachmentTray({ items, accent, uploading, onRemove, onClear }: Props) {
  if (items.length === 0) return null;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.count}>
          {items.length} of {MAX_CHAT_ATTACHMENTS} attached
        </Text>
        {uploading ? (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color={accent} />
            <Text style={[styles.uploadingText, { color: accent }]}>Uploading…</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Text style={styles.clear}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {items.map((item) => (
          <View key={item.key} style={styles.thumb}>
            {item.fileType === 'Image' ? (
              // Local picker previews are file:// URIs — no spinner needed.
              <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={[styles.nonImage, item.fileType === 'VoiceNote' && { backgroundColor: accent }]}>
                <Icon
                  name={item.fileType === 'Video' ? 'videocam' : 'mic'}
                  size={20}
                  color={Colors.white}
                />
                <Text style={styles.nonImageLabel} numberOfLines={1}>
                  {item.durationMs
                    ? formatDuration(item.durationMs)
                    : formatFileSize(item.sizeBytes) || item.fileType}
                </Text>
              </View>
            )}

            {!uploading && (
              <TouchableOpacity
                style={styles.remove}
                onPress={() => onRemove(item.key)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Remove attachment"
              >
                <Icon name="close" size={13} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** RN 0.85's types no longer expose `StyleSheet.absoluteFillObject`. */
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  root: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  count: { fontSize: 12, color: Colors.textSecondary },
  clear: { fontSize: 12, fontWeight: '600', color: Colors.error },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  uploadingText: { fontSize: 12, fontWeight: '600' },

  strip: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  nonImage: {
    ...FILL,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  nonImageLabel: { fontSize: 10, color: Colors.white, fontWeight: '600' },

  remove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
