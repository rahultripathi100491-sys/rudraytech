import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';

import {
  BehaviorSubject,
  Observable,
  Subject
} from 'rxjs';

import { ChatMessage } from '../models/chat-message';
import { HUB_URL } from '../app.config';


// =========================================================
// USER ONLINE
// =========================================================

export interface UserOnlineEvent {
  userId: string;
  userName?: string;
  connectedAtUtc?: string;
}


// =========================================================
// USER OFFLINE
// =========================================================

export interface UserOfflineEvent {
  userId: string;
  userName?: string;
  lastSeen?: string;
}


// =========================================================
// MESSAGE STATUS
// =========================================================

export type MessageStatus =
  | 'Sent'
  | 'Delivered'
  | 'Read';


// =========================================================
// MESSAGE STATUS EVENT
// =========================================================

export interface MessageStatusChangedEvent {

  messageId: string;

  status:
    | 'Sent'
    | 'Delivered'
    | 'Read';

  deliveredAtUtc?: string | null;

  readAtUtc?: string | null;

}


// =========================================================
// INCOMING CALL EVENT
// =========================================================

export interface IncomingCallEvent {

  senderId: string;

  callerName: string;

  callType: string;

}


// =========================================================
// SERVICE
// =========================================================

@Injectable({
  providedIn: 'root'
})
export class SignalRService {

  private hubConnection:
    signalR.HubConnection | null = null;

  private connectionPromise:
    Promise<void> | null = null;

  private manuallyStopped = false;


  // =========================================================
  // MESSAGE RECEIVED
  // =========================================================

  private messageReceivedSubject =
    new Subject<ChatMessage>();

  public messageReceived$:
    Observable<ChatMessage> =
    this.messageReceivedSubject.asObservable();


  // =========================================================
  // MESSAGE STATUS CHANGED
  // =========================================================

  private messageStatusChangedSubject =
    new Subject<MessageStatusChangedEvent>();

  public messageStatusChanged$:
    Observable<MessageStatusChangedEvent> =
    this.messageStatusChangedSubject.asObservable();


  // Alias if your component uses messageStatus$
  public messageStatus$:
    Observable<MessageStatusChangedEvent> =
    this.messageStatusChanged$;


  // =========================================================
  // USER ONLINE
  // =========================================================

  private userOnlineSubject =
    new Subject<UserOnlineEvent>();

  public userOnline$:
    Observable<UserOnlineEvent> =
    this.userOnlineSubject.asObservable();


  // =========================================================
  // USER OFFLINE
  // =========================================================

  private userOfflineSubject =
    new Subject<UserOfflineEvent>();

  public userOffline$:
    Observable<UserOfflineEvent> =
    this.userOfflineSubject.asObservable();


  // =========================================================
  // ONLINE USERS
  // =========================================================

  private onlineUsersSubject =
    new BehaviorSubject<UserOnlineEvent[]>([]);

  public onlineUsers$:
    Observable<UserOnlineEvent[]> =
    this.onlineUsersSubject.asObservable();


  // =========================================================
  // INCOMING CALL
  // =========================================================

  private incomingCallSubject =
    new Subject<IncomingCallEvent>();

  public incomingCall$:
    Observable<IncomingCallEvent> =
    this.incomingCallSubject.asObservable();


  // =========================================================
  // START CONNECTION
  // =========================================================

  public startConnection(
    token?: string
  ): Promise<void> {

    const jwtToken =
      token ||
      localStorage.getItem('token') ||
      '';


    if (!jwtToken) {

      console.error(
        'Cannot connect to SignalR: JWT token missing.'
      );

      return Promise.reject(
        new Error('JWT token missing')
      );

    }


    // =======================================================
    // ALREADY CONNECTED
    // =======================================================

    if (
      this.hubConnection &&
      this.hubConnection.state ===
        signalR.HubConnectionState.Connected
    ) {

      return Promise.resolve();

    }


    // =======================================================
    // ALREADY CONNECTING
    // =======================================================

    if (this.connectionPromise) {

      return this.connectionPromise;

    }


    this.manuallyStopped = false;


    // =======================================================
    // CREATE HUB CONNECTION
    // =======================================================

    this.hubConnection =
      new signalR.HubConnectionBuilder()

        .withUrl(
          `${HUB_URL}/chatHub`,
          {
            accessTokenFactory: () => {

              return (
                localStorage.getItem('token') ||
                jwtToken
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


    // =======================================================
    // REGISTER LISTENERS
    // =======================================================

    this.registerSignalRListeners();


    // =======================================================
    // START
    // =======================================================

    this.connectionPromise =
      this.hubConnection
        .start()

        .then(
          async () => {

            console.log(
              'SignalR Connection Started Successfully'
            );

            await this.loadOnlineUsers();

          }
        )

        .catch(
          (error) => {

            console.error(
              'Error starting SignalR connection:',
              error
            );

            this.hubConnection =
              null;

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


  // =========================================================
  // SIGNALR LISTENERS
  // =========================================================

  private registerSignalRListeners(): void {

    if (!this.hubConnection) {

      return;

    }


    // =======================================================
    // RECEIVE MESSAGE
    // =======================================================

    this.hubConnection.on(
      'ReceiveMessage',
      (data: any) => {

        console.log(
          'Raw SignalR payload received:',
          data
        );


        const currentUserId =
          localStorage.getItem('userId') || '';


        const normalizedMessage:
          ChatMessage = {

          id:
            data?.id ??
            data?.Id,

          senderUserId:
            data?.senderUserId ??
            data?.SenderUserId ??
            data?.senderId ??
            data?.SenderId,

          receiverUserId:
            data?.receiverUserId ??
            data?.ReceiverUserId ??
            data?.receiverId ??
            data?.ReceiverId ??
            currentUserId,

          content:
            data?.content ??
            data?.Content ??
            data?.message ??
            data?.Message ??
            '',

          sentAt:
            data?.sentAtUtc ??
            data?.SentAtUtc ??
            data?.sentAt ??
            data?.SentAt ??
            data?.createdAtUtc ??
            data?.CreatedAtUtc ??
            new Date().toISOString()

        };


        this.messageReceivedSubject.next(
          normalizedMessage
        );

      }
    );


    // =======================================================
    // INCOMING CALL
    // =======================================================

    this.hubConnection.on(
      'IncomingCall',
      (data: any) => {

        console.log(
          'Incoming call received:',
          data
        );


        const senderId =
          data?.senderId ??
          data?.SenderId ??
          '';


        const callerName =
          data?.callerName ??
          data?.CallerName ??
          '';


        const callType =
          data?.callType ??
          data?.CallType ??
          '';


        if (!senderId) {

          console.warn(
            'Invalid IncomingCall event:',
            data
          );

          return;

        }


        const event:
          IncomingCallEvent = {

          senderId:
            String(senderId),

          callerName:
            callerName ||
            'Unknown caller',

          callType:
            String(callType)

        };


        console.log(
          'Normalized IncomingCall event:',
          event
        );


        this.incomingCallSubject.next(
          event
        );

      }
    );


    // =======================================================
    // MESSAGE STATUS CHANGED
    // =======================================================

    this.hubConnection.on(
      'MessageStatusChanged',
      (data: any) => {

        console.log(
          'MessageStatusChanged:',
          data
        );


        const status =
          this.normalizeStatus(
            data?.status ??
            data?.Status
          );


        const messageId =
          data?.messageId ??
          data?.MessageId ??
          data?.id ??
          data?.Id;


        if (!messageId || !status) {

          console.warn(
            'Invalid MessageStatusChanged event:',
            data
          );

          return;

        }


        const event:
          MessageStatusChangedEvent = {

          messageId:
            String(messageId),

          status,

          deliveredAtUtc:
            data?.deliveredAtUtc ??
            data?.DeliveredAtUtc ??
            data?.deliveredAt ??
            data?.DeliveredAt ??
            null,

          readAtUtc:
            data?.readAtUtc ??
            data?.ReadAtUtc ??
            data?.readAt ??
            data?.ReadAt ??
            null

        };


        this.messageStatusChangedSubject.next(
          event
        );

      }
    );


    // =======================================================
    // USER ONLINE
    // =======================================================

    this.hubConnection.on(
      'UserOnline',
      (data: string | UserOnlineEvent | any) => {

        console.log(
          'User Online:',
          data
        );


        let user:
          UserOnlineEvent;


        if (
          typeof data ===
          'string'
        ) {

          user = {

            userId:
              data

          };

        } else {

          user = {

            userId:
              data?.userId ??
              data?.UserId ??
              '',

            userName:
              data?.userName ??
              data?.UserName ??
              '',

            connectedAtUtc:
              data?.connectedAtUtc ??
              data?.ConnectedAtUtc

          };

        }


        if (!user.userId) {

          return;

        }


        this.addOnlineUser(
          user
        );


        this.userOnlineSubject.next(
          user
        );

      }
    );


    // =======================================================
    // USER OFFLINE
    // =======================================================

    this.hubConnection.on(
      'UserOffline',
      (data: UserOfflineEvent | any) => {

        console.log(
          'User Offline:',
          data
        );


        const event:
          UserOfflineEvent = {

          userId:
            data?.userId ??
            data?.UserId ??
            '',

          userName:
            data?.userName ??
            data?.UserName,

          lastSeen:
            data?.lastSeen ??
            data?.LastSeen ??
            new Date().toISOString()

        };


        if (!event.userId) {

          return;

        }


        this.removeOnlineUser(
          event.userId
        );


        this.userOfflineSubject.next(
          event
        );

      }
    );


    // =======================================================
    // RECONNECTING
    // =======================================================

    this.hubConnection.onreconnecting(
      (error) => {

        console.warn(
          'SignalR reconnecting...',
          error
        );

      }
    );


    // =======================================================
    // RECONNECTED
    // =======================================================

    this.hubConnection.onreconnected(
      async (connectionId) => {

        console.log(
          'SignalR reconnected:',
          connectionId
        );


        try {

          await this.loadOnlineUsers();

        } catch (error) {

          console.error(
            'Failed to reload online users:',
            error
          );

        }

      }
    );


    // =======================================================
    // CONNECTION CLOSED
    // =======================================================

    this.hubConnection.onclose(
      (error) => {

        console.error(
          'SignalR connection closed:',
          error
        );


        if (!this.manuallyStopped) {

          console.warn(
            'SignalR connection closed unexpectedly.'
          );

        }

      }
    );

  }


  // =========================================================
  // NORMALIZE STATUS
  // =========================================================

  private normalizeStatus(
    status: unknown
  ): MessageStatus | null {

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


  // =========================================================
  // CONNECTION CHECK
  // =========================================================

  private ensureConnection(): void {

    if (
      !this.hubConnection ||
      this.hubConnection.state !==
        signalR.HubConnectionState.Connected
    ) {

      throw new Error(
        'SignalR connection is not initialized or connected.'
      );

    }

  }


  // =========================================================
  // SEND MESSAGE
  // =========================================================

  public async sendMessage(
    receiverUserId: string,
    message: string
  ): Promise<void> {

    if (!receiverUserId) {

      throw new Error(
        'Receiver user ID is required.'
      );

    }


    if (!message?.trim()) {

      throw new Error(
        'Message content cannot be empty.'
      );

    }


    this.ensureConnection();


    await this.hubConnection!.invoke(
      'SendMessage',
      receiverUserId,
      message
    );

  }


  // =========================================================
  // RING USER
  // =========================================================

  public async ringUser(
    targetUserId: string,
    callerName: string,
    callType: string
  ): Promise<void> {

    if (!targetUserId) {

      throw new Error(
        'Target user ID is required.'
      );

    }


    if (!callerName?.trim()) {

      throw new Error(
        'Caller name is required.'
      );

    }


    if (!callType?.trim()) {

      throw new Error(
        'Call type is required.'
      );

    }


    this.ensureConnection();


    console.log(
      'Ringing user:',
      {
        targetUserId,
        callerName,
        callType
      }
    );


    await this.hubConnection!.invoke(
      'RingUser',
      targetUserId,
      callerName,
      callType
    );

  }


  // =========================================================
  // MARK DELIVERED
  // =========================================================

  public async markDelivered(
    messageId: string
  ): Promise<void> {

    if (!messageId) {

      return;

    }


    this.ensureConnection();


    console.log(
      'Marking message as Delivered:',
      messageId
    );


    await this.hubConnection!.invoke(
      'MarkMessageDelivered',
      messageId
    );

  }


  // =========================================================
  // MARK READ
  // =========================================================

  public async markRead(
    messageId: string
  ): Promise<void> {

    if (!messageId) {

      return;

    }


    this.ensureConnection();


    console.log(
      'Marking message as Read:',
      messageId
    );


    await this.hubConnection!.invoke(
      'MarkMessageRead',
      messageId
    );

  }


  // =========================================================
  // BACKWARD COMPATIBILITY
  // =========================================================

  public async markMessageDelivered(
    messageId: string
  ): Promise<void> {

    await this.markDelivered(
      messageId
    );

  }


  public async markMessageRead(
    messageId: string
  ): Promise<void> {

    await this.markRead(
      messageId
    );

  }


  // =========================================================
  // LOAD ONLINE USERS
  // =========================================================

  public async loadOnlineUsers(): Promise<void> {

    if (
      !this.hubConnection ||
      this.hubConnection.state !==
        signalR.HubConnectionState.Connected
    ) {

      return;

    }


    try {

      const userIds =
        await this.hubConnection.invoke<string[]>(
          'GetOnlineUsers'
        );


      console.log(
        'Current online users:',
        userIds
      );


      const users:
        UserOnlineEvent[] =
        (userIds || [])
          .map(
            userId => ({
              userId
            })
          );


      this.onlineUsersSubject.next(
        users
      );

    } catch (error) {

      console.error(
        'Error loading online users:',
        error
      );

    }

  }


  // =========================================================
  // ADD ONLINE USER
  // =========================================================

  private addOnlineUser(
    user: UserOnlineEvent
  ): void {

    const currentUsers =
      this.onlineUsersSubject.value;


    const exists =
      currentUsers.some(
        x =>
          x.userId ===
          user.userId
      );


    if (exists) {

      return;

    }


    this.onlineUsersSubject.next([
      ...currentUsers,
      user
    ]);

  }


  // =========================================================
  // REMOVE ONLINE USER
  // =========================================================

  private removeOnlineUser(
    userId: string
  ): void {

    const currentUsers =
      this.onlineUsersSubject.value;


    const users =
      currentUsers.filter(
        x =>
          x.userId !==
          userId
      );


    this.onlineUsersSubject.next(
      users
    );

  }


  // =========================================================
  // CHECK USER ONLINE
  // =========================================================

  public isUserOnline(
    userId: string
  ): boolean {

    return this.onlineUsersSubject.value
      .some(
        x =>
          x.userId ===
          userId
      );

  }


  // =========================================================
  // STOP CONNECTION
  // =========================================================

  public async stopConnection(): Promise<void> {

    this.manuallyStopped =
      true;


    if (!this.hubConnection) {

      return;

    }


    try {

      await this.hubConnection.stop();

    } catch (error) {

      console.error(
        'Error stopping SignalR:',
        error
      );

    } finally {

      this.hubConnection =
        null;

      this.onlineUsersSubject.next([]);

    }

  }

}
