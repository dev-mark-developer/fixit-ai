import * as signalR from '@microsoft/signalr';
import { getToken } from '../store/auth';
import { API_ORIGIN } from '../api/axios';
import { MAX_CHAT_ATTACHMENTS } from '../api/dating';
import type { ChatAttachment, ChatFileType, ChatMessage } from '../api/dating';

/**
 * The hub lives on the same host as the REST API — deriving it from
 * `API_ORIGIN` keeps chat pointed at whichever environment `api/axios.ts`
 * is currently built against (local dev needs `adb reverse tcp:5143 tcp:5143`).
 */
const HUB_URL = `${API_ORIGIN}/hubs/chat`;

export type MessageHandler = (message: ChatMessage) => void;
export type ReadHandler = (matchId: number) => void;
export type OnlineHandler = (userId: number) => void;
export type ErrorHandler = (message: string) => void;

export type ChatConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export type StateHandler = (state: ChatConnectionState) => void;

type Listener<T> = (payload: T) => void;

/** Minimal add/emit list — one handler blowing up must not stop the others. */
function createEmitter<T>() {
  let listeners: Listener<T>[] = [];
  return {
    add(listener: Listener<T>): () => void {
      listeners.push(listener);
      return () => { listeners = listeners.filter((l) => l !== listener); };
    },
    emit(payload: T) {
      listeners.forEach((l) => {
        try { l(payload); } catch { /* a bad subscriber shouldn't break delivery */ }
      });
    },
  };
}

/**
 * Some server→client events are documented as a bare value but shipped as an
 * object (`143` vs `{ userId: 143 }`). Read both so a backend tweak can't
 * silently stop presence or read-receipts from working.
 */
function readNumber(payload: unknown, ...keys: string[]): number | null {
  if (typeof payload === 'number') return payload;
  if (typeof payload === 'string' && payload.trim() !== '') {
    const parsed = Number(payload);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (payload && typeof payload === 'object') {
    for (const key of keys) {
      const value = Number((payload as Record<string, unknown>)[key]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

class ChatHubService {
  private connection: signalR.HubConnection | null = null;
  private startPromise: Promise<void> | null = null;
  /** Screens acquire/release the shared connection; only the last one stops it. */
  private refCount = 0;
  private state: ChatConnectionState = 'disconnected';

  private messages = createEmitter<ChatMessage>();
  private reads = createEmitter<number>();
  private online = createEmitter<number>();
  private offline = createEmitter<number>();
  private errors = createEmitter<string>();
  private states = createEmitter<ChatConnectionState>();

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Acquires the shared connection. The count is bumped **synchronously and
   * unconditionally**, so a caller that unmounts mid-connect still balances
   * out with exactly one `disconnect()`, whether or not this resolves.
   */
  async connect(): Promise<void> {
    this.refCount += 1;
    if (!this.startPromise) {
      this.startPromise = this.open().catch((err) => {
        // Clear it so the next acquire retries instead of reusing a rejection.
        this.startPromise = null;
        throw err;
      });
    }
    await this.startPromise;
  }

  /** Releases this screen's hold; the socket closes once nobody holds it. */
  async disconnect(): Promise<void> {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount > 0) return;

    const connection = this.connection;
    this.connection = null;
    this.startPromise = null;
    this.setState('disconnected');
    if (connection) {
      await connection.stop().catch(() => { /* already closing */ });
    }
  }

  private async open(): Promise<void> {
    this.setState('connecting');
    try {
      try {
        // Raw WebSockets, no /negotiate round-trip — the fast path the API supports.
        await this.start(true);
      } catch {
        // Hosts behind a proxy that rejects a bare upgrade still work negotiated.
        await this.start(false);
      }
    } catch (err) {
      this.connection = null;
      this.setState('disconnected');
      throw err;
    }

    if (this.refCount === 0) {
      // Everyone let go while the socket was still opening — don't leave it up.
      const orphan = this.connection;
      this.connection = null;
      this.startPromise = null;
      this.setState('disconnected');
      await orphan?.stop().catch(() => { /* already closing */ });
      return;
    }

    this.setState('connected');
  }

  private async start(skipNegotiation: boolean): Promise<void> {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: async () => (await getToken()) ?? '',
        // API CORS is AllowAnyOrigin, so credentials must stay off (docs/CHAT_API.md).
        withCredentials: false,
        ...(skipNegotiation
          ? { transport: signalR.HttpTransportType.WebSockets, skipNegotiation: true }
          : {}),
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.registerHandlers(connection);
    await connection.start();
    this.connection = connection;
  }

  private registerHandlers(connection: signalR.HubConnection): void {
    connection.on('ReceiveMessage', (message: ChatMessage) => {
      if (message && typeof message === 'object') this.messages.emit(message);
    });

    connection.on('MessagesRead', (payload: unknown) => {
      const matchId = readNumber(payload, 'matchId');
      if (matchId !== null) this.reads.emit(matchId);
    });

    connection.on('UserOnline', (payload: unknown) => {
      const userId = readNumber(payload, 'userId');
      if (userId !== null) this.online.emit(userId);
    });

    connection.on('UserOffline', (payload: unknown) => {
      const userId = readNumber(payload, 'userId');
      if (userId !== null) this.offline.emit(userId);
    });

    // A rejected invoke comes back as an `Error` frame, not a thrown promise.
    connection.on('Error', (payload: unknown) => {
      const message = typeof payload === 'string'
        ? payload
        : (payload as { message?: string })?.message;
      this.errors.emit(message || 'Your message could not be sent.');
    });

    connection.onreconnecting(() => this.setState('reconnecting'));
    connection.onreconnected(() => this.setState('connected'));
    connection.onclose(() => {
      if (this.connection === connection) this.setState('disconnected');
    });
  }

  private setState(state: ChatConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.states.emit(state);
  }

  // ── client → server ────────────────────────────────────────────────────────

  /** Text-only message. */
  async sendMessage(matchId: number, receiverId: number, content: string): Promise<void> {
    await this.invoke('SendMessage', matchId, receiverId, content, 'Text');
  }

  /**
   * Text, files, or both — as one message. `content` may be null as long as
   * there is at least one attachment.
   */
  async sendMessageWithAttachments(
    matchId: number,
    receiverId: number,
    content: string | null,
    attachments: ChatAttachment[],
  ): Promise<void> {
    if (attachments.length === 0 && !content?.trim()) {
      throw new Error('A message must have text, at least one attachment, or both.');
    }
    if (attachments.length > MAX_CHAT_ATTACHMENTS) {
      throw new Error(`A message may carry at most ${MAX_CHAT_ATTACHMENTS} attachments.`);
    }
    if (attachments.some((a) => !a.fileUrl)) {
      throw new Error('Every attachment must have a fileUrl.');
    }

    // Send only the four fields the hub reads — `id`/`sortOrder` are server-assigned.
    const payload = attachments.map((a) => ({
      fileUrl: a.fileUrl,
      fileType: a.fileType,
      fileName: a.fileName ?? null,
      fileSizeBytes: a.fileSizeBytes ?? null,
    }));

    await this.invoke(
      'SendMessageWithAttachments',
      matchId,
      receiverId,
      content?.trim() ? content.trim() : null,
      payload,
    );
  }

  /** Legacy single-file send — pairs with `POST /dating/matches/{id}/upload`. */
  async sendChatFile(
    matchId: number,
    receiverId: number,
    fileUrl: string,
    messageType: ChatFileType,
  ): Promise<void> {
    await this.invoke('SendChatFile', matchId, receiverId, fileUrl, messageType);
  }

  /** `senderId` is the **peer** — they're the one who receives `MessagesRead`. */
  async markAsRead(matchId: number, senderId: number): Promise<void> {
    await this.invoke('MarkAsRead', matchId, senderId);
  }

  private async invoke(method: string, ...args: unknown[]): Promise<void> {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Not connected to chat.');
    }
    await this.connection.invoke(method, ...args);
  }

  // ── server → client ────────────────────────────────────────────────────────

  onMessage(handler: MessageHandler): () => void { return this.messages.add(handler); }
  onRead(handler: ReadHandler): () => void { return this.reads.add(handler); }
  onUserOnline(handler: OnlineHandler): () => void { return this.online.add(handler); }
  onUserOffline(handler: OnlineHandler): () => void { return this.offline.add(handler); }
  onError(handler: ErrorHandler): () => void { return this.errors.add(handler); }

  /** Fires on every transition; also call `connectionState` for the current one. */
  onStateChange(handler: StateHandler): () => void { return this.states.add(handler); }

  get connectionState(): ChatConnectionState { return this.state; }

  get isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }
}

export const chatHub = new ChatHubService();
