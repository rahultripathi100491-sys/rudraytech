import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { SignalRService } from './signalr.service';

export interface ChatMessage {
  id?: string;
  senderUserId: string;
  receiverUserId: string;
  content: string;
  sentAt: string;
}

export interface Conversation {
  id: string;
  participantUserId: string;
  participantName: string;
  lastMessage?: string;
  unreadCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private signalRService = inject(SignalRService);

  private readonly apiUrl = 'https://localhost:7100/api/messages';

  private activeMessagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public activeMessages$ = this.activeMessagesSubject.asObservable();

  constructor() {
    this.listenForIncomingMessages();
  }

  // Subscribe to incoming SignalR events and append to active stream
  private listenForIncomingMessages(): void {
    this.signalRService.messageReceived$.subscribe((data) => {
      const currentMessages = this.activeMessagesSubject.getValue();
      this.activeMessagesSubject.next([
        ...currentMessages,
        {
          senderUserId: data.senderUserId,
          receiverUserId: '', // Set appropriately based on current user context
          content: data.message,
          sentAt: data.sentAt
        }
      ]);
    });
  }

  // Fetch past conversations list via REST API
  getConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.apiUrl}/conversations`);
  }

  // Fetch message history with a specific user
  getMessageHistory(targetUserId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/history/${targetUserId}`);
  }

  // Load history into active Subject stream
  loadConversationHistory(targetUserId: string): void {
    this.getMessageHistory(targetUserId).subscribe({
      next: (messages) => this.activeMessagesSubject.next(messages),
      error: (err) => console.error('Failed to load message history', err)
    });
  }

  // Send message real-time through SignalR
  async sendMessage(receiverUserId: string, message: string): Promise<void> {
    await this.signalRService.sendMessage(receiverUserId, message);

    // Append locally for sender view
    const currentMessages = this.activeMessagesSubject.getValue();
    this.activeMessagesSubject.next([
      ...currentMessages,
      {
        senderUserId: 'me',
        receiverUserId,
        content: message,
        sentAt: new Date().toISOString()
      }
    ]);
  }
}