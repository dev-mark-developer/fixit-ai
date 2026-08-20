import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { ChatAttachment } from '../../api/dating';
import { formatDuration } from '../../utils/chatMedia';
import { knownVoiceDuration, voicePlayer, VoicePlaybackState } from '../../services/voiceNote';
import { Colors } from '../../utils/colors';

// Kept low enough that play button + waveform + timer fit the bubble's
// max width on a small screen — otherwise the timer gets clipped.
const BAR_COUNT = 20;

/**
 * A stable pseudo-waveform derived from the file URL. Real amplitude data
 * would need the audio decoded up front; this keeps each note visually
 * distinct and, crucially, identical on every re-render.
 */
/* eslint-disable no-bitwise -- a cheap deterministic PRNG, not arithmetic */
function barsFor(seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Array.from({ length: BAR_COUNT }, () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return 0.3 + ((hash >> 9) % 100) / 100 * 0.7; // 0.3 – 1.0 of full height
  });
}
/* eslint-enable no-bitwise */

interface Props {
  attachment: ChatAttachment;
  isMine: boolean;
  accent: string;
}

export default function VoiceNoteBubble({ attachment, isMine, accent }: Props) {
  const uri = attachment.fileUrl;
  const [playback, setPlayback] = useState<VoicePlaybackState>(voicePlayer.current);
  const [busy, setBusy] = useState(false);

  useEffect(() => voicePlayer.subscribe(setPlayback), []);

  const isActive = playback.uri === uri;
  const isPlaying = isActive && playback.isPlaying;
  const durationMs = (isActive && playback.durationMs) || knownVoiceDuration(uri);
  const positionMs = isActive ? playback.positionMs : 0;
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  const bars = useMemo(() => barsFor(uri), [uri]);

  const onToggle = useCallback(async () => {
    setBusy(true);
    try {
      await voicePlayer.toggle(uri, durationMs);
    } catch {
      // A dead URL or an audio-focus refusal shouldn't take the bubble down.
    } finally {
      setBusy(false);
    }
  }, [uri, durationMs]);

  const onSurface = isMine ? Colors.white : accent;
  const trackColor = isMine ? 'rgba(255,255,255,0.45)' : Colors.border;
  // Always timer-shaped: this slot is only as wide as "0:00", so a word would
  // be clipped. Length is unknown until the clip has been played once —
  // attachments carry no duration (gap #15).
  const label = isActive
    ? formatDuration(positionMs)
    : durationMs > 0 ? formatDuration(durationMs) : '--:--';

  return (
    <View
      style={[
        styles.bubble,
        isMine ? { backgroundColor: accent, borderBottomRightRadius: 4 } : styles.theirs,
      ]}
    >
      <TouchableOpacity
        onPress={onToggle}
        disabled={busy}
        hitSlop={8}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause voice note' : 'Play voice note'}
        style={[styles.playBtn, { backgroundColor: isMine ? 'rgba(255,255,255,0.22)' : accent }]}
      >
        <Icon
          name={isPlaying ? 'pause' : 'play'}
          size={16}
          color={isMine ? Colors.white : Colors.white}
          style={isPlaying ? undefined : styles.playGlyph}
        />
      </TouchableOpacity>

      <View style={styles.waveform}>
        {bars.map((height, i) => {
          const played = i / BAR_COUNT <= progress;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: Math.round(height * 22),
                  backgroundColor: played ? onSurface : trackColor,
                },
              ]}
            />
          );
        })}
      </View>

      <Text
        style={[styles.time, { color: isMine ? Colors.white : Colors.textSecondary }]}
        numberOfLines={1}
        accessibilityLabel={`Voice note, ${durationMs > 0 ? label : 'length unknown'}`}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '78%',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  theirs: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4 },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The play triangle reads as off-centre when centred on its bounding box.
  playGlyph: { marginLeft: 2 },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
    // Give up space before the timer does, so the label is never squeezed out.
    flexShrink: 1,
    overflow: 'hidden',
  },
  bar: { width: 2.5, borderRadius: 1.5 },
  time: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    minWidth: 38,
    textAlign: 'right',
    flexShrink: 0,
  },
});
