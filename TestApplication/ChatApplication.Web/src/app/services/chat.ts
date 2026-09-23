import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { SignalRService } from './signalr.service';
import { ChatMessage, Conversation } from '../models/chat-message';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private signalRService = inject(SignalRService);

  private readonly apiUrl = 'http://testapplication.somee.com/api/messages';

  private activeMessagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public activeMessages$ = this.activeMessagesSubject.asObservable();

  private activeTargetUserId: string | null = null;

  constructor() {
    const token = localStorage.getItem('token') || '';
    if (token) {
      this.signalRService.startConnection(token);
    }
    this.listenForIncomingMessages();
  }

  private listenForIncomingMessages(): void {
    this.signalRService.messageReceived$.subscribe((incomingMessage: ChatMessage) => {
      this.receiveLiveMessage(incomingMessage);
    });
  }

  public getConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.apiUrl}/conversation`);
  }

  public getMessageHistory(targetUserId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/history/?targetUserId=${targetUserId}`);
  }

  public loadConversationHistory(targetUserId: string): void {
    this.activeTargetUserId = targetUserId;
    this.getMessageHistory(targetUserId).subscribe({
      next: (messages) => this.activeMessagesSubject.next(messages),
      error: (err) => console.error('Failed to load message history', err)
    });
  }

  public async sendMessage(receiverUserId: string, message: string): Promise<void> {
    const currentUserId = localStorage.getItem('userId');
    if (!currentUserId || !message?.trim()) return;

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
      const reverted = this.activeMessagesSubject.getValue().filter((m) => m.id !== tempId);
      this.activeMessagesSubject.next(reverted);
      throw error;
    }
  }

  public receiveLiveMessage(incomingMessage: ChatMessage): void {
    const currentUserId = (localStorage.getItem('userId') || '').toLowerCase();
    const activeTargetId = (this.activeTargetUserId || '').toLowerCase();

    const senderId = (incomingMessage.senderUserId || '').toLowerCase();
    const receiverId = (incomingMessage.receiverUserId || '').toLowerCase();

    const isFromActiveTarget = senderId === activeTargetId;
    const isToActiveTarget = receiverId === activeTargetId;
    const isSelf = senderId === currentUserId;

    if (isFromActiveTarget || isToActiveTarget || isSelf) {
      const currentMessages = this.activeMessagesSubject.getValue() || [];

      const cleanedMessages = currentMessages.filter(
        (m) => !(m.id?.startsWith('temp-') && m.content === incomingMessage.content)
      );

      const exists = cleanedMessages.some(
        (m) => m.id && incomingMessage.id && m.id === incomingMessage.id
      );

      if (!exists) {
        this.activeMessagesSubject.next([...cleanedMessages, incomingMessage]);
      }
    }
  }
}