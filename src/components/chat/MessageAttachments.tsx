import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { ChatAttachment } from '../../api/dating';
import RemoteImage from '../common/RemoteImage';
import { Colors } from '../../utils/colors';

/** Tiles beyond this collapse into a "+N" badge on the last visible one. */
const MAX_TILES = 4;

interface Props {
  attachments: ChatAttachment[];
  accent: string;
  /** Opens the full-screen viewer at this position within `attachments`. */
  onPressAttachment: (index: number) => void;
}

/**
 * The image/video part of a message. Voice notes are rendered separately by
 * `VoiceNoteBubble` — they need their own transport controls.
 */
export default function MessageAttachments({ attachments, accent, onPressAttachment }: Props) {
  if (attachments.length === 0) return null;

  const visible = attachments.slice(0, MAX_TILES);
  const overflow = attachments.length - visible.length;
  const single = visible.length === 1;

  return (
    <View style={[styles.grid, single && styles.gridSingle]}>
      {visible.map((attachment, index) => {
        const isVideo = attachment.fileType === 'Video';
        const isLast = index === visible.length - 1;

        return (
          <TouchableOpacity
            key={`${attachment.fileUrl}-${index}`}
            style={single ? styles.tileSingle : styles.tile}
            activeOpacity={0.85}
            onPress={() => onPressAttachment(index)}
            accessibilityRole="imagebutton"
            accessibilityLabel={isVideo ? 'Open video' : 'Open photo'}
          >
            {isVideo ? (
              // No video decoder is linked, so show a poster tile — tapping it
              // hands the file to the OS player.
              <View style={styles.videoTile}>
                <Icon name="videocam" size={26} color={Colors.white} />
                {!!attachment.fileName && (
                  <Text style={styles.videoName} numberOfLines={1}>{attachment.fileName}</Text>
                )}
              </View>
            ) : (
              <RemoteImage
                uri={attachment.fileUrl}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                indicatorColor={accent}
                fallback={
                  <View style={styles.brokenTile}>
                    <Icon name="image-outline" size={22} color={Colors.textMuted} />
                  </View>
                }
              />
            )}

            {isVideo && (
              <View style={styles.playOverlay} pointerEvents="none">
                <Icon name="play" size={18} color={Colors.white} style={styles.playGlyph} />
              </View>
            )}

            {isLast && overflow > 0 && (
              <View style={styles.overflowOverlay} pointerEvents="none">
                <Text style={styles.overflowText}>+{overflow}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const TILE = 104;

/** RN 0.85's types no longer expose `StyleSheet.absoluteFillObject`. */
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: TILE * 2 + 4,
  },
  gridSingle: { maxWidth: 212 },

  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  tileSingle: {
    width: 212,
    height: 212,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },

  videoTile: {
    ...FILL,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 6,
  },
  videoName: { fontSize: 10, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  brokenTile: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },

  playOverlay: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 40,
    paddingLeft: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },

  overflowOverlay: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overflowText: { fontSize: 22, fontWeight: '700', color: Colors.white },
});
