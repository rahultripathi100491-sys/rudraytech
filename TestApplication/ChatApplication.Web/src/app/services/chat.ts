import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { SignalRService } from './signalr.service';
import { ChatMessage, Conversation, MessageNotification } from '../models/chat-message';
import { BASE_URL } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private http = inject(HttpClient);
  private signalRService = inject(SignalRService);

  private readonly apiUrl = `${BASE_URL}/messages`;

  // =========================================================
  // ACTIVE CHAT MESSAGES
  // =========================================================
  private activeMessagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public activeMessages$ = this.activeMessagesSubject.asObservable();

  // =========================================================
  // CURRENTLY OPEN CHAT
  // =========================================================
  private activeTargetUserId: string | null = null;
  private cachedConversations: Conversation[] = [];

  // =========================================================
  // UNREAD MESSAGE COUNTS
  // =========================================================
  private unreadMessagesSubject = new BehaviorSubject<Record<string, number>>({});
  public unreadMessages$ = this.unreadMessagesSubject.asObservable();

  // =========================================================
  // NOTIFICATIONS
  // =========================================================
  private notificationsSubject = new BehaviorSubject<MessageNotification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  constructor() {
    const token = localStorage.getItem('token') || '';

    if (token) {
      this.signalRService.startConnection(token);
    }

    this.listenForIncomingMessages();
    this.refreshConversationsCache();
  }

  private refreshConversationsCache(): void {
    this.getConversations().subscribe({
      next: (convs) => {
        this.cachedConversations = convs;
      },
      error: () => {}
    });
  }

  public addMessageNotification(
    senderUserId: string,
    senderUserName: string,
    message: string
  ): void {
    const current = this.notificationsSubject.getValue();

    let resolvedName = senderUserName;
    if (!resolvedName) {
      const match = this.cachedConversations.find(
        c => c.participantUserId?.toLowerCase() === senderUserId.toLowerCase()
      );
      resolvedName = match?.participantName || 'User';
    }

    const notification: MessageNotification = {
      id: crypto.randomUUID(),
      senderUserId,
      senderUserName: resolvedName,
      message,
      receivedAt: new Date().toISOString()
    };

    this.notificationsSubject.next([notification, ...current]);
  }

  // =========================================================
  // LISTEN FOR SIGNALR MESSAGES
  // =========================================================
  private listenForIncomingMessages(): void {
    this.signalRService.messageReceived$.subscribe(
      (incomingMessage: ChatMessage) => {
        console.log('New SignalR message:', incomingMessage);
        this.receiveLiveMessage(incomingMessage);
      }
    );
  }

  // =========================================================
  // GET CONVERSATIONS & HISTORY
  // =========================================================
  public getConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.apiUrl}/conversation`);
  }

  public getMessageHistory(targetUserId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(
      `${this.apiUrl}/history/?targetUserId=${targetUserId}`
    );
  }

  // =========================================================
  // OPEN CHAT
  // =========================================================
  public loadConversationHistory(targetUserId: string): void {
    this.activeTargetUserId = targetUserId;
    this.clearUnreadMessages(targetUserId);

    this.getMessageHistory(targetUserId).subscribe({
      next: (messages) => {
        this.activeMessagesSubject.next(messages);
      },
      error: (err) => {
        console.error('Failed to load message history', err);
      }
    });
  }

  // =========================================================
  // SEND MESSAGE
  // =========================================================
  public async sendMessage(
    receiverUserId: string,
    message: string
  ): Promise<void> {
    const currentUserId = localStorage.getItem('userId');

    if (!currentUserId || !message?.trim()) {
      return;
    }

    const currentMessages = this.activeMessagesSubject.getValue() || [];
    const tempId = `temp-${crypto.randomUUID()}`;

    const optimisticMessage: ChatMessage = {
      id: tempId,
      senderUserId: currentUserId,
      receiverUserId: receiverUserId,
      content: message,
      sentAt: new Date().toISOString()
    };

    this.activeMessagesSubject.next([...currentMessages, optimisticMessage]);

    try {
      await this.signalRService.sendMessage(receiverUserId, message);
    } catch (error) {
      console.error('Failed to send message via SignalR:', error);
      const reverted = this.activeMessagesSubject
        .getValue()
        .filter(m => m.id !== tempId);

      this.activeMessagesSubject.next(reverted);
      throw error;
    }
  }

  // =========================================================
  // RECEIVE LIVE MESSAGE
  // =========================================================
  public receiveLiveMessage(incomingMessage: ChatMessage): void {
    const currentUserId = (localStorage.getItem('userId') || '').toLowerCase();
    const activeTargetId = (this.activeTargetUserId || '').toLowerCase();
    const senderId = (incomingMessage.senderUserId || '').toLowerCase();
    const receiverId = (incomingMessage.receiverUserId || '').toLowerCase();

    const isSelf = senderId === currentUserId;
    const isFromActiveTarget = senderId === activeTargetId && activeTargetId !== '';
    const isToActiveTarget = receiverId === activeTargetId && activeTargetId !== '';

    if (isFromActiveTarget || isToActiveTarget || isSelf) {
      const currentMessages = this.activeMessagesSubject.getValue() || [];

      const cleanedMessages = currentMessages.filter(
        (m) =>
          !(
            m.id?.startsWith('temp-') &&
            m.content === incomingMessage.content
          )
      );

      const exists = cleanedMessages.some(
        (m) => m.id && incomingMessage.id && m.id === incomingMessage.id
      );

      if (!exists) {
        this.activeMessagesSubject.next([...cleanedMessages, incomingMessage]);
      }

      if (isSelf || isFromActiveTarget) {
        return;
      }
    }

    if (!isSelf) {
      this.incrementUnreadMessages(incomingMessage.senderUserId);

      // Safely access senderUserName to prevent TS2339 compiler error
      const senderUserName = (incomingMessage as Record<string, any>)['senderUserName'] || '';

      this.addMessageNotification(
        incomingMessage.senderUserId,
        senderUserName,
        incomingMessage.content
      );

      this.showBrowserNotification(incomingMessage);
    }
  }

  // =========================================================
  // UNREAD & NOTIFICATION UTILITIES
  // =========================================================
  private incrementUnreadMessages(userId: string): void {
    const current = this.unreadMessagesSubject.value;
    const currentCount = current[userId] || 0;

    this.unreadMessagesSubject.next({
      ...current,
      [userId]: currentCount + 1
    });
  }

  public clearUnreadMessages(userId: string): void {
    const current = { ...this.unreadMessagesSubject.value };
    if (current[userId] === undefined) return;

    delete current[userId];
    this.unreadMessagesSubject.next(current);
  }

  public getUnreadCount(userId: string): number {
    return this.unreadMessagesSubject.value[userId] || 0;
  }

  public getTotalUnreadCount(): number {
    return Object.values(this.unreadMessagesSubject.value).reduce(
      (total, count) => total + count,
      0
    );
  }

  public removeNotification(id: string): void {
    const current = this.notificationsSubject.getValue();
    this.notificationsSubject.next(current.filter(x => x.id !== id));
  }

  public clearNotifications(): void {
    this.notificationsSubject.next([]);
  }

  public getNotifications(): MessageNotification[] {
    return this.notificationsSubject.getValue();
  }

  // =========================================================
  // BROWSER NOTIFICATIONS & SYSTEM
  // =========================================================
  private showBrowserNotification(message: ChatMessage): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    const notification = new Notification('New Message', {
      body: message.content,
      icon: 'assets/icons/chat.png'
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  public async requestNotificationPermission(): Promise<void> {
    if (typeof Notification === 'undefined') return;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  public closeChat(): void {
    this.activeTargetUserId = null;
    this.activeMessagesSubject.next([]);
  }

  public searchUsers(query: string): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>(
      `${BASE_URL}/user/SearchUsers/search?q=${query}`
    );
  }
}

export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
}