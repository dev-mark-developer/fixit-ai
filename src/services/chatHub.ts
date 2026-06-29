import * as signalR from '@microsoft/signalr';
import { getToken } from '../store/auth';
import { ChatMessage } from '../api/dating';

// Local dev: requires adb reverse tcp:5143 tcp:5143
const HUB_URL = 'http://localhost:5143/hubs/chat';

export type MessageHandler = (message: ChatMessage) => void;
export type ReadHandler = (matchId: number) => void;
export type OnlineHandler = (userId: number) => void;

class ChatHubService {
  private connection: signalR.HubConnection | null = null;
  private messageHandlers: MessageHandler[] = [];
  private readHandlers: ReadHandler[] = [];
  private onlineHandlers: OnlineHandler[] = [];
  private offlineHandlers: OnlineHandler[] = [];

  async connect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: async () => (await getToken()) ?? '',
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: true,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on('ReceiveMessage', (msg: ChatMessage) => {
      this.messageHandlers.forEach((h) => h(msg));
    });

    this.connection.on('MessagesRead', (matchId: number) => {
      this.readHandlers.forEach((h) => h(matchId));
    });

    this.connection.on('UserOnline', (userId: number) => {
      this.onlineHandlers.forEach((h) => h(userId));
    });

    this.connection.on('UserOffline', (userId: number) => {
      this.offlineHandlers.forEach((h) => h(userId));
    });

    await this.connection.start();
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }

  async sendMessage(matchId: number, receiverId: number, content: string): Promise<void> {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('SendMessage', matchId, receiverId, content, 'Text');
  }

  async markAsRead(matchId: number, senderId: number): Promise<void> {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('MarkAsRead', matchId, senderId);
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => { this.messageHandlers = this.messageHandlers.filter((h) => h !== handler); };
  }

  onRead(handler: ReadHandler): () => void {
    this.readHandlers.push(handler);
    return () => { this.readHandlers = this.readHandlers.filter((h) => h !== handler); };
  }

  onUserOnline(handler: OnlineHandler): () => void {
    this.onlineHandlers.push(handler);
    return () => { this.onlineHandlers = this.onlineHandlers.filter((h) => h !== handler); };
  }

  onUserOffline(handler: OnlineHandler): () => void {
    this.offlineHandlers.push(handler);
    return () => { this.offlineHandlers = this.offlineHandlers.filter((h) => h !== handler); };
  }

  get isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }
}

export const chatHub = new ChatHubService();
