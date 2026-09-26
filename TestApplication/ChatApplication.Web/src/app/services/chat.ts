import { Injectable, inject, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map } from 'rxjs';

import { SignalRService } from './signalr.service';
import {
  ChatMessage,
  Conversation,
  MessageNotification
} from '../models/chat-message';

import { BASE_URL } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private http = inject(HttpClient);
  private signalRService = inject(SignalRService);
  private ngZone = inject(NgZone);

  private readonly apiUrl = `${BASE_URL}/messages`;

  // =========================================================
  // ACTIVE CHAT MESSAGES
  // =========================================================

  private activeMessagesSubject =
    new BehaviorSubject<ChatMessage[]>([]);

  public activeMessages$ =
    this.activeMessagesSubject.asObservable();


  // =========================================================
  // CURRENTLY OPEN CHAT
  // =========================================================

  private activeTargetUserId: string | null = null;

  private cachedConversations: Conversation[] = [];


  // =========================================================
  // UNREAD MESSAGE COUNTS
  // =========================================================

  private unreadMessagesSubject =
    new BehaviorSubject<Record<string, number>>({});

  public unreadMessages$ =
    this.unreadMessagesSubject.asObservable();


  // =========================================================
  // NOTIFICATIONS
  // =========================================================

  private notificationsSubject =
    new BehaviorSubject<MessageNotification[]>([]);

  public notifications$ =
    this.notificationsSubject.asObservable();


  // Notification count
  public notificationCount$ =
    this.notifications$.pipe(
      map(notifications => notifications.length)
    );


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor() {

    const token =
      localStorage.getItem('token') || '';

    if (token) {
      this.signalRService.startConnection(token);
    }

    this.listenForIncomingMessages();

    this.refreshConversationsCache();
  }


  // =========================================================
  // REFRESH CONVERSATION CACHE
  // =========================================================

  public refreshConversationsCache(): void {

    this.getConversations().subscribe({

      next: (conversations) => {

        console.log(
          'Conversation cache refreshed:',
          conversations
        );

        this.cachedConversations = conversations || [];
      },

      error: (error) => {

        console.error(
          'Failed to refresh conversation cache:',
          error
        );

      }

    });
  }


  // =========================================================
  // ADD NOTIFICATION
  // =========================================================

  public addMessageNotification(
    senderUserId: string,
    senderUserName: string,
    message: string
  ): void {

    console.log('================================');
    console.log('ADD MESSAGE NOTIFICATION');
    console.log('================================');

    console.log('Sender ID:', senderUserId);
    console.log('Sender Name:', senderUserName);
    console.log('Message:', message);


    const current =
      this.notificationsSubject.getValue();

    console.log(
      'Notifications BEFORE:',
      current
    );


    // ---------------------------------------------------------
    // Resolve sender name if SignalR didn't send it
    // ---------------------------------------------------------

    let resolvedName =
      senderUserName?.trim();


    if (!resolvedName) {

      const match =
        this.cachedConversations.find(
          conversation =>
            conversation.participantUserId
              ?.toLowerCase() ===
            senderUserId?.toLowerCase()
        );


      resolvedName =
        match?.participantName ||
        'User';
    }


    // ---------------------------------------------------------
    // Create notification
    // ---------------------------------------------------------

    const notification: MessageNotification = {

      id: crypto.randomUUID(),

      senderUserId: senderUserId,

      senderUserName: resolvedName,

      message: message,

      receivedAt: new Date().toISOString()

    };


    // ---------------------------------------------------------
    // Add notification
    // ---------------------------------------------------------

    const updatedNotifications = [
      notification,
      ...current
    ];


    console.log(
      'Notifications AFTER:',
      updatedNotifications
    );


    this.notificationsSubject.next(
      updatedNotifications
    );


    console.log(
      'Notification subject updated.'
    );

  }


  // =========================================================
  // LISTEN FOR SIGNALR MESSAGES
  // =========================================================

  private listenForIncomingMessages(): void {

    this.signalRService.messageReceived$.subscribe(

      (incomingMessage: ChatMessage) => {

        this.ngZone.run(() => {

          console.log(
            '================================'
          );

          console.log(
            'NEW SIGNALR MESSAGE'
          );

          console.log(
            incomingMessage
          );

          console.log(
            '================================'
          );


          this.receiveLiveMessage(
            incomingMessage
          );

        });

      }

    );

  }


  // =========================================================
  // GET CONVERSATIONS
  // =========================================================

  public getConversations():
    Observable<Conversation[]> {

    return this.http.get<Conversation[]>(
      `${this.apiUrl}/conversation`
    );

  }


  // =========================================================
  // GET MESSAGE HISTORY
  // =========================================================

  public getMessageHistory(
    targetUserId: string
  ): Observable<ChatMessage[]> {

    return this.http.get<ChatMessage[]>(
      `${this.apiUrl}/history/?targetUserId=${targetUserId}`
    );

  }


  // =========================================================
  // LOAD CONVERSATION HISTORY
  // =========================================================

  public loadConversationHistory(
    targetUserId: string
  ): void {

    this.activeTargetUserId =
      targetUserId;


    // Clear unread messages when opening chat
    this.clearUnreadMessages(
      targetUserId
    );


    this.getMessageHistory(
      targetUserId
    ).subscribe({

      next: (messages) => {

        this.activeMessagesSubject.next(
          messages || []
        );

      },

      error: (error) => {

        console.error(
          'Failed to load message history:',
          error
        );

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

    const currentUserId =
      localStorage.getItem('userId');


    if (
      !currentUserId ||
      !message?.trim()
    ) {

      return;

    }


    const currentMessages =
      this.activeMessagesSubject.getValue() || [];


    const tempId =
      `temp-${crypto.randomUUID()}`;


    const optimisticMessage:
      ChatMessage = {

      id: tempId,

      senderUserId:
        currentUserId,

      receiverUserId:
        receiverUserId,

      content:
        message,

      sentAt:
        new Date().toISOString()

    };


    // ---------------------------------------------------------
    // Optimistic UI
    // ---------------------------------------------------------

    this.activeMessagesSubject.next([
      ...currentMessages,
      optimisticMessage
    ]);


    try {

      await this.signalRService.sendMessage(
        receiverUserId,
        message
      );

    }

    catch (error) {

      console.error(
        'Failed to send message via SignalR:',
        error
      );


      // Remove optimistic message
      const reverted =
        this.activeMessagesSubject
          .getValue()
          .filter(
            message =>
              message.id !== tempId
          );


      this.activeMessagesSubject.next(
        reverted
      );


      throw error;

    }

  }


  // =========================================================
  // RECEIVE LIVE MESSAGE
  // =========================================================

  public receiveLiveMessage(
    incomingMessage: ChatMessage
  ): void {

    const raw =
      incomingMessage as any;


    // =======================================================
    // NORMALIZE SIGNALR FIELD NAMES
    // =======================================================

    const senderUserId =
      raw.senderUserId ??
      raw.SenderUserId ??
      raw.senderId ??
      raw.SenderId ??
      '';


    const receiverUserId =
      raw.receiverUserId ??
      raw.ReceiverUserId ??
      raw.receiverId ??
      raw.ReceiverId ??
      '';


    const content =
      raw.content ??
      raw.Content ??
      raw.message ??
      raw.Message ??
      '';


    const senderUserName =
      raw.senderUserName ??
      raw.SenderUserName ??
      raw.senderName ??
      raw.SenderName ??
      '';


    // =======================================================
    // NORMALIZE IDS
    // =======================================================

    const currentUserId =
      (
        localStorage.getItem('userId') ||
        ''
      ).toLowerCase();


    const activeTargetId =
      (
        this.activeTargetUserId ||
        ''
      ).toLowerCase();


    const senderIdLower =
      String(senderUserId)
        .toLowerCase();


    const receiverIdLower =
      String(receiverUserId)
        .toLowerCase();


    // =======================================================
    // DEBUG
    // =======================================================

    console.log(
      '========== MESSAGE DETAILS =========='
    );

    console.log(
      'senderUserId:',
      senderUserId
    );

    console.log(
      'receiverUserId:',
      receiverUserId
    );

    console.log(
      'content:',
      content
    );

    console.log(
      'senderUserName:',
      senderUserName
    );

    console.log(
      'currentUserId:',
      currentUserId
    );

    console.log(
      'activeTargetId:',
      activeTargetId
    );


    // =======================================================
    // VALIDATE MESSAGE
    // =======================================================

    if (
      !senderUserId ||
      !content
    ) {

      console.warn(
        'Invalid incoming message:',
        incomingMessage
      );

      return;

    }


    // =======================================================
    // CHECK MESSAGE TYPE
    // =======================================================

    const isSelf =
      senderIdLower === currentUserId;


    const isFromActiveTarget =
      activeTargetId !== '' &&
      senderIdLower === activeTargetId;


    const isToActiveTarget =
      activeTargetId !== '' &&
      receiverIdLower === activeTargetId;


    console.log(
      'isSelf:',
      isSelf
    );

    console.log(
      'isFromActiveTarget:',
      isFromActiveTarget
    );

    console.log(
      'isToActiveTarget:',
      isToActiveTarget
    );


    // =======================================================
    // ADD MESSAGE TO CURRENT CHAT
    // =======================================================

    if (
      isFromActiveTarget ||
      isToActiveTarget ||
      isSelf
    ) {

      const currentMessages =
        this.activeMessagesSubject
          .getValue() || [];


      // -----------------------------------------------------
      // Remove optimistic message
      // -----------------------------------------------------

      const cleanedMessages =
        currentMessages.filter(
          message =>
            !(
              message.id?.startsWith('temp-') &&
              message.content === content
            )
        );


      // -----------------------------------------------------
      // Check duplicate
      // -----------------------------------------------------

      const exists =
        cleanedMessages.some(
          message =>
            message.id &&
            incomingMessage.id &&
            message.id === incomingMessage.id
        );


      // -----------------------------------------------------
      // Add real message
      // -----------------------------------------------------

      if (!exists) {

        const normalizedMessage:
          ChatMessage = {

          ...incomingMessage,

          senderUserId:
            senderUserId,

          receiverUserId:
            receiverUserId,

          content:
            content

        };


        this.activeMessagesSubject.next([
          ...cleanedMessages,
          normalizedMessage
        ]);

      }


      // -----------------------------------------------------
      // IMPORTANT:
      // If user is currently viewing this conversation,
      // don't show notification.
      // -----------------------------------------------------

      if (
        isFromActiveTarget ||
        isSelf
      ) {

        console.log(
          'Message belongs to active chat. No notification.'
        );

        return;

      }

    }


    // =======================================================
    // CREATE NOTIFICATION
    // =======================================================

    if (
      !isSelf &&
      senderUserId
    ) {

      console.log(
        '================================'
      );

      console.log(
        'CREATING NOTIFICATION'
      );

      console.log(
        '================================'
      );


      // -----------------------------------------------------
      // Increase unread count
      // -----------------------------------------------------

      this.incrementUnreadMessages(
        senderUserId
      );


      // -----------------------------------------------------
      // Add notification
      // -----------------------------------------------------

      this.addMessageNotification(

        senderUserId,

        senderUserName,

        content

      );


      // -----------------------------------------------------
      // Browser notification
      // -----------------------------------------------------

      this.showBrowserNotification({

        ...incomingMessage,

        senderUserId,

        receiverUserId,

        content

      });

    }

  }


  // =========================================================
  // INCREMENT UNREAD MESSAGE COUNT
  // =========================================================

  private incrementUnreadMessages(
    userId: string
  ): void {

    const normalizedId =
      String(userId).toLowerCase();


    const current =
      this.unreadMessagesSubject.value;


    const currentCount =
      current[normalizedId] || 0;


    const updated = {

      ...current,

      [normalizedId]:
        currentCount + 1

    };


    console.log(
      'Unread messages updated:',
      updated
    );


    this.unreadMessagesSubject.next(
      updated
    );

  }


  // =========================================================
  // CLEAR UNREAD MESSAGE COUNT
  // =========================================================

  public clearUnreadMessages(
    userId: string
  ): void {

    const normalizedId =
      String(userId).toLowerCase();


    const current = {
      ...this.unreadMessagesSubject.value
    };


    if (
      current[normalizedId] === undefined
    ) {

      return;

    }


    delete current[normalizedId];


    this.unreadMessagesSubject.next(
      current
    );

  }


  // =========================================================
  // GET UNREAD COUNT
  // =========================================================

  public getUnreadCount(
    userId: string
  ): number {

    const normalizedId =
      String(userId).toLowerCase();


    return (
      this.unreadMessagesSubject
        .value[normalizedId] || 0
    );

  }


  // =========================================================
  // GET TOTAL UNREAD COUNT
  // =========================================================

  public getTotalUnreadCount(): number {

    return Object
      .values(
        this.unreadMessagesSubject.value
      )
      .reduce(
        (total, count) =>
          total + count,
        0
      );

  }


  // =========================================================
  // REMOVE ONE NOTIFICATION
  // =========================================================

  public removeNotification(
    id: string
  ): void {

    const current =
      this.notificationsSubject.getValue();


    this.notificationsSubject.next(

      current.filter(
        notification =>
          notification.id !== id
      )

    );

  }


  // =========================================================
  // CLEAR ALL NOTIFICATIONS
  // =========================================================

  public clearNotifications(): void {

    this.notificationsSubject.next([]);

  }


  // =========================================================
  // GET NOTIFICATIONS
  // =========================================================

  public getNotifications():
    MessageNotification[] {

    return this.notificationsSubject
      .getValue();

  }


  // =========================================================
  // SHOW BROWSER NOTIFICATION
  // =========================================================

  private showBrowserNotification(
    message: ChatMessage
  ): void {

    if (
      typeof Notification === 'undefined'
    ) {

      return;

    }


    if (
      Notification.permission !== 'granted'
    ) {

      return;

    }


    const notification =
      new Notification(
        'New Message',
        {

          body:
            message.content,

          icon:
            'assets/icons/chat.png'

        }
      );


    notification.onclick = () => {

      window.focus();

      notification.close();

    };

  }


  // =========================================================
  // REQUEST NOTIFICATION PERMISSION
  // =========================================================

  public async requestNotificationPermission():
    Promise<void> {

    if (
      typeof Notification === 'undefined'
    ) {

      return;

    }


    if (
      Notification.permission === 'default'
    ) {

      await Notification.requestPermission();

    }

  }


  // =========================================================
  // CLOSE CHAT
  // =========================================================

  public closeChat(): void {

    this.activeTargetUserId = null;

    this.activeMessagesSubject.next([]);

  }


  // =========================================================
  // SEARCH USERS
  // =========================================================

  public searchUsers(
    query: string
  ): Observable<UserSearchResult[]> {

    return this.http.get<UserSearchResult[]>(
      `${BASE_URL}/user/SearchUsers/search?q=${query}`
    );

  }

}


// =============================================================
// USER SEARCH RESULT
// =============================================================

export interface UserSearchResult {

  id: string;

  name: string;

  email: string;

}
