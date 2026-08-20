import type { ChatAttachment, ChatFileType, ChatMessage } from '../api/dating';

/**
 * Chat timestamps arrive in two shapes (see docs/CHAT_API.md):
 *   - SignalR hub payloads end in `Z`   → "2026-08-17T13:02:18.198Z"
 *   - REST history has NO zone marker   → "2026-08-17T12:55:56.601"
 *
 * `new Date()` reads the second one as *local* time, which shifts every
 * message in the history by the device's UTC offset. Both are UTC, so tag
 * the bare ones before parsing.
 */
export function parseChatDate(value?: string | null): Date {
  if (!value) return new Date(NaN);
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
  return new Date(hasZone ? value : `${value}Z`);
}

/** "Just Now" / "12 mins ago" / "14:35" — used under every bubble. */
export function formatMessageTime(value?: string | null): string {
  const date = parseChatDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just Now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Day separator label for the message list. */
export function formatDayLabel(value?: string | null): string {
  const date = parseChatDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString();
}

/** `mm:ss` for voice-note position/duration. Input is milliseconds. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|3gp|avi|mkv|webm)$/i;
const AUDIO_EXT = /\.(m4a|mp3|aac|wav|ogg|opus|amr|caf)$/i;

/**
 * The hub only accepts these three names — anything else is rejected with
 * "Attachment fileType must be one of: Image, Video, VoiceNote."
 */
export function normalizeFileType(value?: string | null): ChatFileType | null {
  switch (value?.trim().toLowerCase()) {
    case 'image': return 'Image';
    case 'video': return 'Video';
    case 'voicenote':
    case 'voice':
    case 'audio': return 'VoiceNote';
    default: return null;
  }
}

/** Maps an upload's MIME type (or failing that, its name) onto a hub fileType. */
export function fileTypeFromMime(mime?: string | null, name?: string | null): ChatFileType {
  const m = mime?.toLowerCase() ?? '';
  if (m.startsWith('image/')) return 'Image';
  if (m.startsWith('video/')) return 'Video';
  if (m.startsWith('audio/')) return 'VoiceNote';
  if (name && IMAGE_EXT.test(name)) return 'Image';
  if (name && VIDEO_EXT.test(name)) return 'Video';
  if (name && AUDIO_EXT.test(name)) return 'VoiceNote';
  return 'Image';
}

/**
 * The one place that decides what a message's files are.
 *
 * New messages carry `attachments`; messages stored before the backend grew
 * that column only have the legacy `fileUrl` mirror, so fall back to it and
 * read the kind off `messageType`.
 */
export function messageAttachments(message: ChatMessage): ChatAttachment[] {
  const list = message.attachments;
  if (list && list.length > 0) {
    return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }
  if (message.fileUrl) {
    return [{
      fileUrl: message.fileUrl,
      fileType: normalizeFileType(message.messageType) ?? fileTypeFromMime(null, message.fileUrl),
    }];
  }
  return [];
}

/** True when the message is a single voice note and nothing else. */
export function isVoiceNoteMessage(message: ChatMessage): boolean {
  const files = messageAttachments(message);
  return files.length === 1 && files[0].fileType === 'VoiceNote';
}

/** One-line preview for the chat list / notifications. */
export function messagePreview(message: Pick<ChatMessage, 'content' | 'messageType' | 'fileUrl' | 'attachments'>): string {
  const text = message.content?.trim();
  if (text) return text;
  const files = messageAttachments(message as ChatMessage);
  if (files.length === 0) return '';
  if (files.length > 1) return `${files.length} attachments`;
  switch (files[0].fileType) {
    case 'Image': return 'Photo';
    case 'Video': return 'Video';
    case 'VoiceNote': return 'Voice note';
    default: return 'Attachment';
  }
}

/** Human-readable size for the attachment tray. */
export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
