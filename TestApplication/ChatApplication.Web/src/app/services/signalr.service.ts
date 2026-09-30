import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { ChatMessage } from '../models/chat-message';
import { HUB_URL } from '../app.config';

export interface UserOnlineEvent {
  userId: string;
  userName?: string;
  connectedAtUtc?: string;
}

export interface UserOfflineEvent {
  userId: string;
  userName?: string;
  lastSeen?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SignalRService {

  private hubConnection: signalR.HubConnection | null = null;

  private connectionPromise: Promise<void> | null = null;

  private manuallyStopped = false;


  // =========================================================
  // CHAT MESSAGE
  // =========================================================

  private messageReceivedSubject =
    new Subject<ChatMessage>();

  public messageReceived$:
    Observable<ChatMessage> =
    this.messageReceivedSubject.asObservable();


  // =========================================================
  // USER ONLINE EVENT
  // =========================================================

  private userOnlineSubject =
    new Subject<UserOnlineEvent>();

  public userOnline$:
    Observable<UserOnlineEvent> =
    this.userOnlineSubject.asObservable();


  // =========================================================
  // USER OFFLINE EVENT
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
  // START CONNECTION
  // =========================================================

  public startConnection(token?: string): Promise<void> {

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


    // Already connected
    if (
      this.hubConnection &&
      this.hubConnection.state ===
        signalR.HubConnectionState.Connected
    ) {
      return Promise.resolve();
    }


    // Already connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }


    this.manuallyStopped = false;


    // =====================================================
    // CREATE CONNECTION
    // =====================================================

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


    // =====================================================
    // REGISTER LISTENERS
    // =====================================================

    this.registerSignalRListeners();


    // =====================================================
    // START
    // =====================================================

    this.connectionPromise =
      this.hubConnection
        .start()

        .then(async () => {

          console.log(
            'SignalR Connection Started Successfully'
          );

          // Get users already online
          await this.loadOnlineUsers();

        })

        .catch((error) => {

          console.error(
            'Error starting SignalR connection:',
            error
          );

          this.hubConnection = null;

          throw error;

        })

        .finally(() => {

          this.connectionPromise = null;

        });


    return this.connectionPromise;
  }


  // =========================================================
  // SIGNALR LISTENERS
  // =========================================================

  private registerSignalRListeners(): void {

    if (!this.hubConnection) {
      return;
    }


    // =====================================================
    // RECEIVE MESSAGE
    // =====================================================

    this.hubConnection.on(
      'ReceiveMessage',
      (data: any) => {

        console.log(
          'Raw SignalR payload received:',
          data
        );


        const currentUserId =
          localStorage.getItem('userId') || '';


        const normalizedMessage: ChatMessage = {

          id:
            data.id ??
            data.Id,

          senderUserId:
            data.senderUserId ??
            data.SenderUserId,

          receiverUserId:
            data.receiverUserId ??
            data.ReceiverUserId ??
            currentUserId,

          content:
            data.content ??
            data.Content ??
            data.message ??
            data.Message ??
            '',

          sentAt:
            data.sentAtUtc ??
            data.SentAtUtc ??
            data.sentAt ??
            data.SentAt ??
            new Date().toISOString()
        };


        this.messageReceivedSubject.next(
          normalizedMessage
        );
      }
    );


    // =====================================================
    // USER ONLINE
    // =====================================================

    this.hubConnection.on(
      'UserOnline',
      (data: string | UserOnlineEvent | any) => {

        console.log(
          '🟢 User Online:',
          data
        );


        /*
         * Your C# Hub sends:
         *
         * Clients.Others.SendAsync(
         *     "UserOnline",
         *     userId
         * );
         *
         * Therefore data is normally just a string.
         */


        let user: UserOnlineEvent;


        if (typeof data === 'string') {

          user = {
            userId: data
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


        // Add to local online users
        this.addOnlineUser(user);


        // Notify subscribers
        this.userOnlineSubject.next(user);
      }
    );


    // =====================================================
    // USER OFFLINE
    // =====================================================

    this.hubConnection.on(
      'UserOffline',
      (data: UserOfflineEvent | any) => {

        console.log(
          '🔴 User Offline:',
          data
        );


        const event: UserOfflineEvent = {

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


        // Remove from online users
        this.removeOnlineUser(
          event.userId
        );


        // Notify subscribers
        this.userOfflineSubject.next(event);
      }
    );


    // =====================================================
    // RECONNECTING
    // =====================================================

    this.hubConnection.onreconnecting(
      (error) => {

        console.warn(
          'SignalR reconnecting...',
          error
        );
      }
    );


    // =====================================================
    // RECONNECTED
    // =====================================================

    this.hubConnection.onreconnected(
      async (connectionId) => {

        console.log(
          'SignalR reconnected:',
          connectionId
        );


        /*
         * The connection may have changed.
         *
         * Refresh the complete online-user list.
         */

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


    // =====================================================
    // CONNECTION CLOSED
    // =====================================================

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

      /*
       * C#:
       *
       * public Task<string[]> GetOnlineUsers()
       */

      const userIds =
        await this.hubConnection.invoke<string[]>(
          'GetOnlineUsers'
        );


      console.log(
        '🟢 Current online users:',
        userIds
      );


      const users: UserOnlineEvent[] =
        (userIds || [])
          .map(userId => ({
            userId
          }));


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
        x => x.userId === user.userId
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
        x => x.userId !== userId
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
        x => x.userId === userId
      );
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


    if (
      !this.hubConnection ||
      this.hubConnection.state !==
        signalR.HubConnectionState.Connected
    ) {

      throw new Error(
        'SignalR connection is not initialized or connected.'
      );
    }


    await this.hubConnection.invoke(
      'SendMessage',
      receiverUserId,
      message
    );
  }


  // =========================================================
  // STOP CONNECTION
  // =========================================================

  public async stopConnection(): Promise<void> {

    this.manuallyStopped = true;


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

      this.hubConnection = null;

      this.onlineUsersSubject.next([]);

    }
  }
}
