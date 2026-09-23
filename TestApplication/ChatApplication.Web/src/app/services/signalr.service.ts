import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject, Observable } from 'rxjs';
import { ChatMessage } from '../models/chat-message';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection: signalR.HubConnection | null = null;

  private messageReceivedSubject = new Subject<ChatMessage>();
  public messageReceived$: Observable<ChatMessage> = this.messageReceivedSubject.asObservable();

  private connectionPromise: Promise<void> | null = null;

  public startConnection(token?: string): Promise<void> {
    const jwtToken = token || localStorage.getItem('token') || '';

    if (!jwtToken) {
      console.error('Cannot connect to SignalR: JWT token missing.');
      return Promise.reject('JWT token missing');
    }

    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('https://localhost:7072/chatHub', {
        accessTokenFactory: () => jwtToken
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.registerSignalRListeners();

    this.connectionPromise = this.hubConnection
      .start()
      .then(() => console.log('SignalR Connection Started Successfully'))
      .catch((error) => {
        console.error('Error starting SignalR connection:', error);
        this.hubConnection = null;
        throw error;
      })
      .finally(() => {
        this.connectionPromise = null;
      });

    return this.connectionPromise;
  }

  private registerSignalRListeners(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on('ReceiveMessage', (data: any) => {
      console.log('Raw SignalR payload received:', data);

      const currentUserId = localStorage.getItem('userId') || '';

      const normalizedMessage: ChatMessage = {
        id: data.id || data.Id,
        senderUserId: data.senderUserId || data.SenderUserId,
        receiverUserId: data.receiverUserId || data.ReceiverUserId || currentUserId,
        content: data.content ?? data.Content ?? data.message ?? data.Message ?? '',
        sentAt: data.sentAtUtc ?? data.SentAtUtc ?? data.sentAt ?? data.SentAt ?? new Date().toISOString()
      };

      console.log('Normalized message emitted:', normalizedMessage);
      this.messageReceivedSubject.next(normalizedMessage);
    });

    this.hubConnection.onreconnecting((error) => console.warn('SignalR reconnecting...', error));
    this.hubConnection.onreconnected((connectionId) => console.log('SignalR reconnected:', connectionId));
    this.hubConnection.onclose((error) => console.error('SignalR connection closed:', error));
  }

  public async sendMessage(receiverUserId: string, message: string): Promise<void> {
    if (!receiverUserId) throw new Error('Receiver user ID is required.');
    if (!message?.trim()) throw new Error('Message content cannot be empty.');

    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR connection is not initialized or connected.');
    }

    await this.hubConnection.invoke('SendMessage', receiverUserId, message);
  }
}