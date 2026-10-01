import { Injectable } from '@angular/core';

import * as signalR from '@microsoft/signalr';

import {
  BehaviorSubject,
  Observable,
  Subject
} from 'rxjs';

import { HUB_URL } from '../app.config';


// =========================================================
// MESSAGE
// =========================================================

export interface Message {

  id: string;

  senderId: string;

  receiverId: string;

  content: string;

  status:
    | 'Sent'
    | 'Delivered'
    | 'Read';

  createdAt: string;

  deliveredAt?: string | null;

  readAt?: string | null;
}


// =========================================================
// MESSAGE STATUS
// =========================================================

export interface MessageStatusChanged {

  messageId: string;

  status:
    | 'Sent'
    | 'Delivered'
    | 'Read';

  deliveredAt?: string | null;

  readAt?: string | null;
}


// =========================================================
// OFFLINE
// =========================================================

export interface UserOfflineEvent {

  userId: string;

  lastSeen: string;
}


// =========================================================
// SERVICE
// =========================================================

@Injectable({
  providedIn: 'root'
})
export class ChatSignalRService {

  // =======================================================
  // CONNECTION
  // =======================================================

  private hubConnection:
    signalR.HubConnection | null = null;

  private connectionPromise:
    Promise<void> | null = null;

  private manuallyStopped =
    false;


  // =======================================================
  // MESSAGE STORAGE
  // =======================================================

  private messagesSubject =
    new BehaviorSubject<Message[]>([]);


  // =======================================================
  // SUBJECTS
  // =======================================================

  private messageSubject =
    new Subject<Message>();

  private statusSubject =
    new Subject<MessageStatusChanged>();

  private typingSubject =
    new Subject<string>();

  private onlineSubject =
    new Subject<string>();

  private offlineSubject =
    new Subject<UserOfflineEvent>();


  // =======================================================
  // OBSERVABLES
  // =======================================================

  readonly message$:
    Observable<Message> =
    this.messageSubject.asObservable();


  readonly messageStatus$:
    Observable<MessageStatusChanged> =
    this.statusSubject.asObservable();


  readonly messages$:
    Observable<Message[]> =
    this.messagesSubject.asObservable();


  readonly typing$:
    Observable<string> =
    this.typingSubject.asObservable();


  readonly online$:
    Observable<string> =
    this.onlineSubject.asObservable();


  readonly offline$:
    Observable<UserOfflineEvent> =
    this.offlineSubject.asObservable();


  // =======================================================
  // START CONNECTION
  // =======================================================

  async start(): Promise<void> {

    const token =
      localStorage.getItem('token') || '';


    // -------------------------------------------------------
    // Token required
    // -------------------------------------------------------

    if (!token) {

      console.error(
        'Cannot connect to SignalR: JWT token missing.'
      );

      throw new Error(
        'JWT token missing.'
      );
    }


    // -------------------------------------------------------
    // Already connected
    // -------------------------------------------------------

    if (
      this.hubConnection &&
      this.hubConnection.state ===
        signalR.HubConnectionState.Connected
    ) {

      return;
    }


    // -------------------------------------------------------
    // Already connecting
    // -------------------------------------------------------

    if (this.connectionPromise) {

      return this.connectionPromise;
    }


    this.manuallyStopped =
      false;


    // -------------------------------------------------------
    // If an old connection exists, stop it first
    // -------------------------------------------------------

    if (this.hubConnection) {

      try {

        await this.hubConnection.stop();

      } catch (error) {

        console.warn(
          'Error stopping previous SignalR connection:',
          error
        );

      }

      this.hubConnection =
        null;
    }


    // =======================================================
    // CREATE CONNECTION
    // =======================================================

    /*
     * IMPORTANT:
     *
     * Use the SAME URL pattern as your working SignalRService.
     *
     * Your working service uses:
     *
     *     `${HUB_URL}/chatHub`
     *
     * Therefore this service does the same.
     */

    const connection =
      new signalR.HubConnectionBuilder()

        .withUrl(
          `${HUB_URL}/chatHub`,
          {
            accessTokenFactory: () => {

              return (
                localStorage.getItem('token') ||
                token
              );

            }
          }
        )

        .withAutomaticReconnect([
          0,
          2000,
          5000,
          10000,
          30000
        ])

        .configureLogging(
          signalR.LogLevel.Information
        )

        .build();


    this.hubConnection =
      connection;


    // =======================================================
    // REGISTER LISTENERS
    // =======================================================

    this.registerSignalRListeners(
      connection
    );


    // =======================================================
    // START CONNECTION
    // =======================================================

    this.connectionPromise =
      connection
        .start()

        .then(
          () => {

            console.log(
              'Chat SignalR connection started successfully.'
            );

            console.log(
              'Chat SignalR URL:',
              `${HUB_URL}/chatHub`
            );

          }
        )

        .catch(
          error => {

            console.error(
              'Chat SignalR connection failed:',
              error
            );


            if (
              this.hubConnection ===
              connection
            ) {

              this.hubConnection =
                null;
            }


            throw error;

          }
        )

        .finally(
          () => {

            this.connectionPromise =
              null;

          }
        );


    return this.connectionPromise;
  }


  // =======================================================
  // REGISTER SIGNALR LISTENERS
  // =======================================================

  private registerSignalRListeners(
    connection: signalR.HubConnection
  ): void {


    // =====================================================
    // RECEIVE MESSAGE
    // =====================================================

    connection.on(
      'ReceiveMessage',
      (message: any) => {

        console.log(
          'SignalR ReceiveMessage:',
          message
        );


        if (!message) {
          return;
        }


        const normalizedMessage:
          Message = {

          id:
            message?.id ??
            message?.Id,

          senderId:
            message?.senderId ??
            message?.SenderId ??
            message?.senderUserId ??
            message?.SenderUserId,

          receiverId:
            message?.receiverId ??
            message?.ReceiverId ??
            message?.receiverUserId ??
            message?.ReceiverUserId,

          content:
            message?.content ??
            message?.Content ??
            '',

          status:
            this.normalizeStatus(
              message?.status ??
              message?.Status
            ) ?? 'Sent',

          createdAt:
            message?.createdAt ??
            message?.CreatedAt ??
            message?.createdAtUtc ??
            message?.CreatedAtUtc ??
            message?.sentAtUtc ??
            message?.SentAtUtc ??
            new Date().toISOString(),

          deliveredAt:
            message?.deliveredAt ??
            message?.DeliveredAt ??
            message?.deliveredAtUtc ??
            message?.DeliveredAtUtc ??
            null,

          readAt:
            message?.readAt ??
            message?.ReadAt ??
            message?.readAtUtc ??
            message?.ReadAtUtc ??
            null

        };


        // Store message

        this.addMessage(
          normalizedMessage
        );


        // Notify component

        this.messageSubject.next(
          normalizedMessage
        );

      }
    );


    // =====================================================
    // MESSAGE STATUS
    // =====================================================

    /*
     * YOUR C# HUB SENDS:
     *
     *     "MessageStatusUpdated"
     *
     * NOT:
     *
     *     "MessageStatusChanged"
     *
     * Therefore listen to MessageStatusUpdated.
     */

    connection.on(
      'MessageStatusUpdated',
      (data: any) => {

        console.log(
          'SignalR MessageStatusUpdated:',
          data
        );


        if (!data) {
          return;
        }


        const messageId =
          data?.messageId ??
          data?.MessageId ??
          data?.id ??
          data?.Id;


        const status =
          this.normalizeStatus(
            data?.status ??
            data?.Status
          );


        if (
          !messageId ||
          !status
        ) {

          console.warn(
            'Invalid MessageStatusUpdated event:',
            data
          );

          return;
        }


        const event:
          MessageStatusChanged = {

          messageId:
            String(messageId),

          status,

          deliveredAt:
            data?.deliveredAt ??
            data?.DeliveredAt ??
            data?.deliveredAtUtc ??
            data?.DeliveredAtUtc ??
            null,

          readAt:
            data?.readAt ??
            data?.ReadAt ??
            data?.readAtUtc ??
            data?.ReadAtUtc ??
            null

        };


        // Update local message

        this.updateMessageStatus(
          event
        );


        // Notify subscribers

        this.statusSubject.next(
          event
        );

      }
    );


    // =====================================================
    // ALSO SUPPORT MessageStatusChanged
    // =====================================================

    /*
     * Keeping this listener makes the service compatible
     * if the backend is later changed to MessageStatusChanged.
     */

    connection.on(
      'MessageStatusChanged',
      (data: any) => {

        console.log(
          'SignalR MessageStatusChanged:',
          data
        );


        this.handleMessageStatus(
          data
        );

      }
    );


    // =====================================================
    // TYPING
    // =====================================================

    connection.on(
      'UserTyping',
      (userId: string) => {

        console.log(
          'SignalR UserTyping:',
          userId
        );


        if (!userId) {
          return;
        }


        this.typingSubject.next(
          userId
        );

      }
    );


    // =====================================================
    // ONLINE
    // =====================================================

    connection.on(
      'UserOnline',
      (userId: string) => {

        console.log(
          'SignalR UserOnline:',
          userId
        );


        if (!userId) {
          return;
        }


        this.onlineSubject.next(
          userId
        );

      }
    );


    // =====================================================
    // OFFLINE
    // =====================================================

    connection.on(
      'UserOffline',
      (data: UserOfflineEvent | any) => {

        console.log(
          'SignalR UserOffline:',
          data
        );


        if (!data) {
          return;
        }


        const event:
          UserOfflineEvent = {

          userId:
            data?.userId ??
            data?.UserId ??
            '',

          lastSeen:
            data?.lastSeen ??
            data?.LastSeen ??
            new Date().toISOString()

        };


        if (!event.userId) {
          return;
        }


        this.offlineSubject.next(
          event
        );

      }
    );


    // =====================================================
    // RECONNECTING
    // =====================================================

    connection.onreconnecting(
      error => {

        console.warn(
          'Chat SignalR reconnecting...',
          error
        );

      }
    );


    // =====================================================
    // RECONNECTED
    // =====================================================

    connection.onreconnected(
      connectionId => {

        console.log(
          'Chat SignalR reconnected:',
          connectionId
        );

      }
    );


    // =====================================================
    // CLOSED
    // =====================================================

    connection.onclose(
      error => {

        console.warn(
          'Chat SignalR connection closed:',
          error
        );


        if (
          this.hubConnection ===
          connection
        ) {

          this.hubConnection =
            null;
        }

      }
    );
  }


  // =======================================================
  // HANDLE STATUS
  // =======================================================

  private handleMessageStatus(
    data: any
  ): void {

    if (!data) {
      return;
    }


    const messageId =
      data?.messageId ??
      data?.MessageId ??
      data?.id ??
      data?.Id;


    const status =
      this.normalizeStatus(
        data?.status ??
        data?.Status
      );


    if (
      !messageId ||
      !status
    ) {

      console.warn(
        'Invalid message status:',
        data
      );

      return;
    }


    const event:
      MessageStatusChanged = {

      messageId:
        String(messageId),

      status,

      deliveredAt:
        data?.deliveredAt ??
        data?.DeliveredAt ??
        data?.deliveredAtUtc ??
        data?.DeliveredAtUtc ??
        null,

      readAt:
        data?.readAt ??
        data?.ReadAt ??
        data?.readAtUtc ??
        data?.ReadAtUtc ??
        null

    };


    this.updateMessageStatus(
      event
    );


    this.statusSubject.next(
      event
    );
  }


  // =======================================================
  // NORMALIZE STATUS
  // =======================================================

  private normalizeStatus(
    status: unknown
  ):
    | 'Sent'
    | 'Delivered'
    | 'Read'
    | null {

    if (
      typeof status !==
      'string'
    ) {

      return null;
    }


    switch (
      status.toLowerCase()
    ) {

      case 'sent':
        return 'Sent';

      case 'delivered':
        return 'Delivered';

      case 'read':
        return 'Read';

      default:
        return null;
    }
  }


  // =======================================================
  // ENSURE CONNECTION
  // =======================================================

  private async ensureConnection():
    Promise<signalR.HubConnection> {

    // -------------------------------------------------------
    // Already connected
    // -------------------------------------------------------

    if (
      this.hubConnection &&
      this.hubConnection.state ===
        signalR.HubConnectionState.Connected
    ) {

      return this.hubConnection;
    }


    // -------------------------------------------------------
    // Start connection
    // -------------------------------------------------------

    await this.start();


    // -------------------------------------------------------
    // Check again
    // -------------------------------------------------------

    if (
      this.hubConnection &&
      this.hubConnection.state ===
        signalR.HubConnectionState.Connected
    ) {

      return this.hubConnection;
    }


    throw new Error(
      'Chat SignalR connection is not connected.'
    );
  }


  // =======================================================
  // SEND MESSAGE
  // =======================================================

  async sendMessage(
    receiverUserId: string,
    content: string
  ): Promise<void> {

    if (!receiverUserId) {

      throw new Error(
        'Receiver user id is required.'
      );
    }


    if (!content?.trim()) {

      throw new Error(
        'Message content is required.'
      );
    }


    const connection =
      await this.ensureConnection();


    await connection.invoke(
      'SendMessage',
      receiverUserId,
      content.trim()
    );
  }


  // =======================================================
  // ADD MESSAGE
  // =======================================================

  addMessage(
    message: Message
  ): void {

    if (!message) {
      return;
    }


    const current =
      this.messagesSubject.value;


    const exists =
      current.some(
        x =>
          String(x.id) ===
          String(message.id)
      );


    if (exists) {
      return;
    }


    const updated = [
      ...current,
      message
    ];


    updated.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
    );


    this.messagesSubject.next(
      updated
    );
  }


  // =======================================================
  // UPDATE MESSAGE STATUS
  // =======================================================

  updateMessageStatus(
    data: MessageStatusChanged
  ): void {

    if (!data) {
      return;
    }


    const current =
      this.messagesSubject.value;


    const updated =
      current.map(
        message => {

          if (
            String(message.id) !==
            String(data.messageId)
          ) {

            return message;
          }


          return {

            ...message,

            status:
              data.status,

            deliveredAt:
              data.deliveredAt ??
              message.deliveredAt ??
              null,

            readAt:
              data.readAt ??
              message.readAt ??
              null

          };

        }
      );


    this.messagesSubject.next(
      updated
    );
  }


  // =======================================================
  // GET MESSAGES
  // =======================================================

  getMessages(): Message[] {

    return this.messagesSubject.value;
  }


  // =======================================================
  // GET MESSAGE
  // =======================================================

  getMessage(
    messageId: string
  ): Message | undefined {

    return this.messagesSubject.value.find(
      message =>
        String(message.id) ===
        String(messageId)
    );
  }


  // =======================================================
  // CLEAR MESSAGES
  // =======================================================

  clearMessages(): void {

    this.messagesSubject.next(
      []
    );
  }


  // =======================================================
  // SET MESSAGES
  // =======================================================

  setMessages(
    messages: Message[]
  ): void {

    if (!messages) {

      this.messagesSubject.next(
        []
      );

      return;
    }


    const unique =
      messages.filter(
        (
          message,
          index,
          array
        ) =>
          index ===
          array.findIndex(
            x =>
              String(x.id) ===
              String(message.id)
          )
      );


    unique.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
    );


    this.messagesSubject.next(
      unique
    );
  }


  // =======================================================
  // MARK MESSAGE DELIVERED
  // =======================================================

  async markMessageDelivered(
    messageId: string
  ): Promise<void> {

    if (!messageId) {

      throw new Error(
        'Message id is required.'
      );
    }


    const connection =
      await this.ensureConnection();


    console.log(
      'Marking message Delivered:',
      messageId
    );


    await connection.invoke(
      'MarkMessageDelivered',
      messageId
    );


    console.log(
      'MarkMessageDelivered invoked successfully:',
      messageId
    );
  }


  // =======================================================
  // MARK MESSAGE READ
  // =======================================================

  async markMessageRead(messageId: string): Promise<void> {

    if (!messageId) {

      throw new Error(
        'Message id is required.'
      );
    }


    const connection =
      await this.ensureConnection();


    console.log(
      'Marking message Read:',
      messageId
    );


    await connection.invoke(
      'MarkMessageRead',
      messageId
    );


    console.log(
      'MarkMessageRead invoked successfully:',
      messageId
    );
  }


  // =======================================================
  // BACKWARD COMPATIBILITY
  // =======================================================

  async markDelivered(
    messageId: string
  ): Promise<void> {

    await this.markMessageDelivered(
      messageId
    );
  }


  async markRead(
    messageId: string
  ): Promise<void> {

    await this.markMessageRead(
      messageId
    );
  }


  // =======================================================
  // JOIN CONVERSATION
  // =======================================================

  async joinConversation(
    conversationId: string
  ): Promise<void> {

    if (!conversationId) {

      throw new Error(
        'Conversation id is required.'
      );
    }


    const connection =
      await this.ensureConnection();


    await connection.invoke(
      'JoinConversation',
      conversationId
    );
  }


  // =======================================================
  // LEAVE CONVERSATION
  // =======================================================

  async leaveConversation(
    conversationId: string
  ): Promise<void> {

    if (!conversationId) {

      throw new Error(
        'Conversation id is required.'
      );
    }


    const connection =
      await this.ensureConnection();


    await connection.invoke(
      'LeaveConversation',
      conversationId
    );
  }


  // =======================================================
  // TYPING
  // =======================================================

  async sendTyping(
    conversationId: string,
    userId: string
  ): Promise<void> {

    if (!conversationId) {

      throw new Error(
        'Conversation id is required.'
      );
    }


    if (!userId) {

      throw new Error(
        'User id is required.'
      );
    }


    const connection =
      await this.ensureConnection();


    await connection.invoke(
      'SendTyping',
      conversationId,
      userId
    );
  }


  // =======================================================
  // CONNECTION STATE
  // =======================================================

  isConnected(): boolean {

    return !!(
      this.hubConnection &&
      this.hubConnection.state ===
        signalR.HubConnectionState.Connected
    );
  }


  // =======================================================
  // GET CONNECTION STATE
  // =======================================================

  getConnectionState():
    signalR.HubConnectionState {

    return (
      this.hubConnection?.state ??
      signalR.HubConnectionState.Disconnected
    );
  }


  // =======================================================
  // STOP
  // =======================================================

  async stop(): Promise<void> {

    this.manuallyStopped =
      true;


    const connection =
      this.hubConnection;


    this.hubConnection =
      null;


    this.connectionPromise =
      null;


    if (!connection) {

      return;
    }


    try {

      await connection.stop();

    } catch (error) {

      console.warn(
        'Error stopping Chat SignalR:',
        error
      );

    }
  }
}
