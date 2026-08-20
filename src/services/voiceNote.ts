import { PermissionsAndroid, Platform } from 'react-native';
import Sound, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  OutputFormatAndroidType,
} from 'react-native-nitro-sound';
import type { AudioSet } from 'react-native-nitro-sound';
import type { ChatUploadFile } from '../api/dating';
import { resolveMediaUrl } from '../utils/imageUrl';

/**
 * AAC inside an MPEG-4 container on both platforms, so the captured file is a
 * genuine `.m4a` regardless of where it was recorded. Mono at 44.1kHz/64kbps —
 * speech-grade, and small enough that a one-minute note uploads quickly.
 */
const AUDIO_SET: AudioSet = {
  AudioSourceAndroid: AudioSourceAndroidType.MIC,
  OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  AVFormatIDKeyIOS: 'aac',
  AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
  AVNumberOfChannelsKeyIOS: 1,
  AVSampleRateKeyIOS: 44100,
  AudioChannels: 1,
  AudioSamplingRate: 44100,
  AudioEncodingBitRate: 64000,
};

/** Anything shorter than this is a mis-tap, not a message. */
export const MIN_VOICE_NOTE_MS = 1000;
/** Hard stop so a stuck recorder can't fill the disk. */
export const MAX_VOICE_NOTE_MS = 5 * 60 * 1000;

export interface VoiceRecording {
  /** `file://` URI of the captured audio. */
  uri: string;
  durationMs: number;
}

export interface RecorderProgress {
  positionMs: number;
  /** dB level when metering is on — drives the live waveform. */
  metering?: number;
}

/** RN's file APIs want a scheme; Android hands back a bare path. */
function toFileUri(path: string): string {
  if (!path) return path;
  return /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : `file://${path}`;
}

class VoiceRecorderService {
  private recording = false;
  private positionMs = 0;

  /** Android needs RECORD_AUDIO at runtime; iOS prompts on first use. */
  async ensurePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
    if (await PermissionsAndroid.check(permission)) return true;
    const result = await PermissionsAndroid.request(permission, {
      title: 'Microphone access',
      message: 'Allow access to your microphone to record a voice note.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  /**
   * Begins capture. `onProgress` fires ~10x/sec with the elapsed position, and
   * `onLimit` fires once if the recording hits {@link MAX_VOICE_NOTE_MS}.
   */
  async start(onProgress?: (progress: RecorderProgress) => void, onLimit?: () => void): Promise<void> {
    if (this.recording) return;

    this.positionMs = 0;
    this.recording = true;
    Sound.setSubscriptionDuration(0.1);
    Sound.addRecordBackListener((meta) => {
      this.positionMs = meta.currentPosition ?? 0;
      onProgress?.({ positionMs: this.positionMs, metering: meta.currentMetering });
      if (this.positionMs >= MAX_VOICE_NOTE_MS) onLimit?.();
    });

    try {
      // No path argument — the library picks a writable app-private location
      // per platform, and `stopRecorder()` reports where it actually landed.
      await Sound.startRecorder(undefined, AUDIO_SET, true);
    } catch (err) {
      this.recording = false;
      Sound.removeRecordBackListener();
      throw err;
    }
  }

  /** Stops and returns the file, or null if nothing usable was captured. */
  async stop(): Promise<VoiceRecording | null> {
    if (!this.recording) return null;
    const durationMs = this.positionMs;
    this.recording = false;
    try {
      const path = await Sound.stopRecorder();
      Sound.removeRecordBackListener();
      if (!path) return null;
      return { uri: toFileUri(path), durationMs };
    } catch {
      Sound.removeRecordBackListener();
      return null;
    }
  }

  /**
   * Stops and throws the take away. The file stays in the app's private cache
   * until the OS reclaims it — harmless, and avoids pulling in a filesystem
   * dependency just to unlink it.
   */
  async cancel(): Promise<void> {
    if (!this.recording) return;
    this.recording = false;
    try {
      await Sound.stopRecorder();
    } catch { /* nothing was open */ }
    Sound.removeRecordBackListener();
  }

  get isRecording(): boolean { return this.recording; }
}

export const voiceRecorder = new VoiceRecorderService();

/** Turns a finished recording into the multipart part the upload endpoint wants. */
export function recordingToUpload(recording: VoiceRecording): ChatUploadFile {
  return {
    uri: recording.uri,
    // Normalised name/MIME so the API classifies it as a VoiceNote regardless
    // of the container extension the platform recorder chose.
    name: `voice-note-${Date.now()}.m4a`,
    type: 'audio/m4a',
  };
}

// ── Playback ────────────────────────────────────────────────────────────────

export interface VoicePlaybackState {
  /** The attachment URL currently loaded, or null when nothing is playing. */
  uri: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
}

const IDLE: VoicePlaybackState = { uri: null, isPlaying: false, positionMs: 0, durationMs: 0 };

/**
 * Attachments don't carry a duration, so a note's length is unknown until the
 * player reports it. Remember what we learn to keep the label stable when the
 * bubble goes back to idle.
 */
const durationCache = new Map<string, number>();

/** Length of a previously-played note, or 0 if it hasn't been played yet. */
export function knownVoiceDuration(uri: string): number {
  return durationCache.get(uri) ?? 0;
}

/**
 * One shared player: nitro-sound exposes a single playback listener, and only
 * one voice note should ever be audible at a time. Bubbles subscribe and
 * compare `state.uri` against their own to know whether they're the active one.
 */
class VoicePlayerService {
  private state: VoicePlaybackState = IDLE;
  private listeners: Array<(state: VoicePlaybackState) => void> = [];
  private listening = false;

  subscribe(listener: (state: VoicePlaybackState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  private update(patch: Partial<VoicePlaybackState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => {
      try { l(this.state); } catch { /* keep notifying the rest */ }
    });
  }

  private attachListeners(): void {
    if (this.listening) return;
    this.listening = true;
    Sound.setSubscriptionDuration(0.1);
    Sound.addPlayBackListener((meta) => {
      // The native duration only becomes known after the first frame.
      const durationMs = meta.duration || this.state.durationMs;
      if (this.state.uri && meta.duration > 0) {
        durationCache.set(this.state.uri, meta.duration);
      }
      this.update({ positionMs: meta.currentPosition ?? 0, durationMs });
    });
    Sound.addPlaybackEndListener(() => { this.reset(); });
  }

  private detachListeners(): void {
    if (!this.listening) return;
    this.listening = false;
    Sound.removePlayBackListener();
    Sound.removePlaybackEndListener();
  }

  private reset(): void {
    this.detachListeners();
    this.state = IDLE;
    this.listeners.forEach((l) => {
      try { l(this.state); } catch { /* keep notifying the rest */ }
    });
  }

  /** Play/pause/resume the note at `uri`, stopping whatever else was playing. */
  async toggle(uri: string, fallbackDurationMs = 0): Promise<void> {
    if (this.state.uri === uri) {
      if (this.state.isPlaying) {
        await Sound.pausePlayer();
        this.update({ isPlaying: false });
      } else {
        await Sound.resumePlayer();
        this.update({ isPlaying: true });
      }
      return;
    }

    await this.stop();
    const source = resolveMediaUrl(uri);
    if (!source) return;

    this.attachListeners();
    this.state = { uri, isPlaying: true, positionMs: 0, durationMs: fallbackDurationMs };
    this.update({});
    try {
      await Sound.startPlayer(source);
    } catch (err) {
      this.reset();
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.state.uri) return;
    try { await Sound.stopPlayer(); } catch { /* already stopped */ }
    this.reset();
  }

  get current(): VoicePlaybackState { return this.state; }
}

export const voicePlayer = new VoicePlayerService();
