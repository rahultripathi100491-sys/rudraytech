import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Observable,
  Subscription
} from 'rxjs';

import {
  ChatService,
  UserSearchResult
} from '../services/chat';

import {
  Conversation,
  ChatMessage
} from '../models/chat-message';

import {
  CallService,
  CallType
} from '../services/call.service';

import { User } from '../models/user';

import {
  SignalRService,
  UserOfflineEvent,
  UserOnlineEvent
} from '../services/signalr.service';

import {
  ChatSignalRService,
  MessageStatusChanged
} from '../services/chat-signalr.service';


// =========================================================
// MESSAGE STATUS
// =========================================================

export type MessageStatus =
  | 'sent'
  | 'delivered'
  | 'read';


// =========================================================
// MESSAGE TYPE
// =========================================================

interface MessageWithStatus {

  id?: string | number;

  senderUserId?: string;
  receiverUserId?: string;

  senderId?: string;
  receiverId?: string;

  content?: string;

  sentAt?: string;
  sentAtUtc?: string;

  status?: string | null;

  isDelivered?: boolean;
  isRead?: boolean;

  deliveredAt?: string | null;
  deliveredAtUtc?: string | null;

  readAt?: string | null;
  readAtUtc?: string | null;

  [key: string]: unknown;
}


// =========================================================
// COMPONENT
// =========================================================

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './chat-window.html',
  styleUrls: ['./chat-window.css']
})
export class ChatWindowComponent
  implements
    OnInit,
    OnDestroy,
    AfterViewChecked {

  // =========================================================
  // SERVICES
  // =========================================================

  protected chatService =
    inject(ChatService);

  protected callService =
    inject(CallService);

  /*
   * Existing SignalRService.
   *
   * Used for:
   * - online/offline
   * - calls
   * - other existing functionality
   */
  protected signalRService =
    inject(SignalRService);

  /*
   * ChatSignalRService.
   *
   * Used specifically for:
   * - ReceiveMessage
   * - MessageStatusChanged
   * - MarkMessageDelivered
   * - MarkMessageRead
   */
  protected chatSignalRService =
    inject(ChatSignalRService);


  // =========================================================
  // VIEW CHILDREN
  // =========================================================

  @ViewChild('localVideo')
  localVideo?: ElementRef<HTMLVideoElement>;

  @ViewChild('remoteVideo')
  remoteVideo?: ElementRef<HTMLVideoElement>;

  @ViewChild('remoteAudio')
  remoteAudio?: ElementRef<HTMLAudioElement>;

  @ViewChild('scrollContainer')
  private scrollContainer?: ElementRef<HTMLElement>;


  // =========================================================
  // CALL STATE
  // =========================================================

  public incomingCallUserId: string | null = null;

  public incomingCallName = '';

  public incomingCallType: CallType = 'video';

  public activeCallType: CallType | null = null;

  public callType: CallType | null = null;

  public isCallActive$:
    Observable<boolean> =
    this.callService.isCallActive$;

  public localStream:
    MediaStream | null = null;

  public remoteStream:
    MediaStream | null = null;

  public isStartingCall = false;

  public callStatus = '';

  public isMicrophoneMuted = false;

  public isCameraOff = false;


  // =========================================================
  // MEDIA TRACKING
  // =========================================================

  private lastLocalStream:
    MediaStream | null = null;

  private lastRemoteStream:
    MediaStream | null = null;


  // =========================================================
  // GENERAL STATE
  // =========================================================

  private shouldScrollToBottom = true;

  private isDestroyed = false;


  // =========================================================
  // CHAT STATE
  // =========================================================

  public showNewChatModal = false;

  public searchQuery = '';

  public searchResults:
    UserSearchResult[] = [];

  public activeTargetUserId:
    string | null = null;

  public activeTargetName = '';

  public currentUserId =
    localStorage.getItem('userId') || '';

  public newMessageText = '';

  public isSending = false;

  public isLogin =
    localStorage.getItem('isLogin') === 'true';


  // =========================================================
  // USERS
  // =========================================================

  public users: User[] = [];


  // =========================================================
  // CONVERSATIONS
  // =========================================================

  public conversations$:
    Observable<Conversation[]> =
    this.chatService.getConversations();


  // =========================================================
  // SUBSCRIPTIONS
  // =========================================================

  private subscriptions =
    new Subscription();


  // =========================================================
  // INIT
  // =========================================================

  async ngOnInit(): Promise<void> {

    // =======================================================
    // START EXISTING SIGNALR
    // =======================================================

    try {

      await this.signalRService
        .startConnection();

    } catch (error: unknown) {

      console.error(
        'SignalR connection failed:',
        error
      );

    }


    // =======================================================
    // START CHAT SIGNALR
    // =======================================================

    /*
     * This is the service containing:
     *
     * MessageStatusChanged
     * MarkMessageDelivered
     * MarkMessageRead
     *
     * If ChatService already starts this service,
     * calling start() again is safe because your service
     * checks the connection state.
     */

    try {

      await this.chatSignalRService
        .start();

    } catch (error: unknown) {

      console.error(
        'Chat SignalR connection failed:',
        error
      );

    }


    // =======================================================
    // LOAD USERS
    // =======================================================

    await this.loadUsers();


    // =======================================================
    // USER ONLINE
    // =======================================================

    this.subscriptions.add(

      this.signalRService
        .userOnline$
        .subscribe(
          (event: UserOnlineEvent) => {

            this.setUserOnline(
              event.userId
            );

          }
        )

    );


    // =======================================================
    // USER OFFLINE
    // =======================================================

    this.subscriptions.add(

      this.signalRService
        .userOffline$
        .subscribe(
          (event: UserOfflineEvent) => {

            this.setUserOffline(
              event.userId,
              event.lastSeen
            );

          }
        )

    );


    // =======================================================
    // MESSAGE STATUS
    // =======================================================

    this.subscribeToMessageStatusChanged();


    // =======================================================
    // ACTIVE MESSAGES
    // =======================================================

    this.subscriptions.add(

      this.chatService
        .activeMessages$
        .subscribe(
          (messages: ChatMessage[]) => {

            const statusMessages =
              messages as unknown as MessageWithStatus[];


            this.shouldScrollToBottom =
              true;


            setTimeout(() => {

              if (this.isDestroyed) {
                return;
              }


              this.scrollToBottom();


              // ------------------------------------------------
              // DELIVERED
              // ------------------------------------------------

              void this.markIncomingMessagesAsDelivered(
                statusMessages
              );


              // ------------------------------------------------
              // READ
              // ------------------------------------------------

              void this.markActiveConversationAsRead();

            });

          }
        )

    );


    // =======================================================
    // INCOMING CALL
    // =======================================================

    this.subscriptions.add(

      this.callService
        .incomingCall$
        .subscribe(
          (userId: string | null) => {

            this.incomingCallUserId =
              userId;


            if (userId) {

              this.callStatus =
                'Incoming call...';

            }

          }
        )

    );


    // =======================================================
    // INCOMING CALL NAME
    // =======================================================

    this.subscriptions.add(

      this.callService
        .incomingCallName$
        .subscribe(
          (name: string) => {

            this.incomingCallName =
              name || 'Unknown user';

          }
        )

    );


    // =======================================================
    // INCOMING CALL TYPE
    // =======================================================

    this.subscriptions.add(

      this.callService
        .incomingCallType$
        .subscribe(
          (type: CallType | null) => {

            if (!type) {
              return;
            }


            this.incomingCallType =
              type;


            if (this.incomingCallUserId) {

              this.activeCallType =
                type;

              this.callType =
                type;

            }

          }
        )

    );


    // =======================================================
    // LOCAL STREAM
    // =======================================================

    this.subscriptions.add(

      this.callService
        .localStream$
        .subscribe(
          (stream: MediaStream | null) => {

            this.localStream =
              stream;


            if (!stream) {

              this.lastLocalStream =
                null;

            }


            setTimeout(() => {

              this.attachMedia();

            });

          }
        )

    );


    // =======================================================
    // REMOTE STREAM
    // =======================================================

    this.subscriptions.add(

      this.callService
        .remoteStream$
        .subscribe(
          (stream: MediaStream | null) => {

            this.remoteStream =
              stream;


            if (!stream) {

              this.lastRemoteStream =
                null;

            }


            setTimeout(() => {

              this.attachMedia();

            });

          }
        )

    );


    // =======================================================
    // CALL ACTIVE
    // =======================================================

    this.subscriptions.add(

      this.callService
        .isCallActive$
        .subscribe(
          (isActive: boolean) => {

            if (!isActive) {
              return;
            }


            if (!this.callStatus) {

              this.callStatus =
                'Call connected';

            }


            setTimeout(() => {

              this.attachMedia();

            });

          }
        )

    );


    // =======================================================
    // CALL ACCEPTED
    // =======================================================

    this.subscriptions.add(

      this.callService
        .callAccepted$
        .subscribe(
          (userId: string | null) => {

            if (!userId) {
              return;
            }


            this.activeTargetUserId =
              userId;


            this.incomingCallUserId =
              null;

            this.incomingCallName =
              '';


            this.callStatus =
              this.activeCallType === 'voice'
                ? 'Voice call connecting...'
                : 'Video call connecting...';


            setTimeout(() => {

              this.attachMedia();

            });

          }
        )

    );


    // =======================================================
    // CALL REJECTED
    // =======================================================

    this.subscriptions.add(

      this.callService
        .callRejected$
        .subscribe(() => {

          this.callStatus =
            'Call declined';


          this.stopMedia();


          this.incomingCallUserId =
            null;

          this.incomingCallName =
            '';

          this.activeCallType =
            null;

          this.callType =
            null;

          this.isStartingCall =
            false;

        })

    );


    // =======================================================
    // CALL ENDED
    // =======================================================

    this.subscriptions.add(

      this.callService
        .callEnded$
        .subscribe(() => {

          this.callStatus =
            'Call ended';


          this.stopMedia();


          this.incomingCallUserId =
            null;

          this.incomingCallName =
            '';

          this.activeCallType =
            null;

          this.callType =
            null;

          this.isStartingCall =
            false;

        })

    );

  }


  // =========================================================
  // MESSAGE STATUS CHANGED
  // =========================================================

  private subscribeToMessageStatusChanged(): void {

    this.subscriptions.add(

      this.chatSignalRService
        .messageStatus$
        .subscribe(
          (event: MessageStatusChanged) => {

            console.log(
              'MessageStatusChanged:',
              event
            );


            const messageId =
              String(event.messageId);


            const status =
              this.normalizeMessageStatus(
                event.status
              );


            if (!messageId) {

              return;

            }


            if (!status) {

              console.warn(
                'Unknown message status:',
                event.status
              );

              return;

            }


            this.updateMessageStatus(
              messageId,
              status,
              event.deliveredAt,
              event.readAt
            );

          }
        )

    );

  }


  // =========================================================
  // NORMALIZE STATUS
  // =========================================================

  private normalizeMessageStatus(
    status: string | null | undefined
  ): MessageStatus | null {

    if (!status) {

      return null;

    }


    switch (
      status.toLowerCase()
    ) {

      case 'sent':
        return 'sent';

      case 'delivered':
        return 'delivered';

      case 'read':
        return 'read';

      default:
        return null;

    }

  }


  // =========================================================
  // GET ACTIVE MESSAGES
  // =========================================================

  private getActiveMessages():
    MessageWithStatus[] {

    const service =
      this.chatService as unknown as {

        activeMessagesSubject?: {
          getValue?: () => unknown;
        };

        activeMessages?: unknown;

        messages?: unknown;

      };


    // =======================================================
    // BEHAVIOR SUBJECT
    // =======================================================

    if (
      service.activeMessagesSubject &&
      typeof service.activeMessagesSubject.getValue ===
        'function'
    ) {

      const value =
        service.activeMessagesSubject.getValue();


      if (Array.isArray(value)) {

        return value as MessageWithStatus[];

      }

    }


    // =======================================================
    // ACTIVE MESSAGES
    // =======================================================

    if (
      Array.isArray(
        service.activeMessages
      )
    ) {

      return (
        service.activeMessages as MessageWithStatus[]
      );

    }


    // =======================================================
    // MESSAGES
    // =======================================================

    if (
      Array.isArray(
        service.messages
      )
    ) {

      return (
        service.messages as MessageWithStatus[]
      );

    }


    return [];

  }


  // =========================================================
  // UPDATE MESSAGE STATUS
  // =========================================================

  private updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    deliveredAt?: string | null,
    readAt?: string | null
  ): void {

    const messages =
      this.getActiveMessages();


    if (!messages.length) {

      return;

    }


    const message =
      messages.find(
        (msg: MessageWithStatus) =>
          this.getMessageId(msg) ===
          String(messageId)
      );


    if (!message) {

      console.warn(
        'Message not found:',
        messageId
      );

      return;

    }


    const currentStatus =
      this.getMessageStatus(message);


    // =======================================================
    // NEVER DOWNGRADE
    // =======================================================

    if (
      currentStatus === 'read'
    ) {

      return;

    }


    if (
      currentStatus === 'delivered' &&
      status === 'sent'
    ) {

      return;

    }


    // =======================================================
    // STATUS
    // =======================================================

    message.status =
      status;


    // =======================================================
    // DELIVERED
    // =======================================================

    if (
      status === 'delivered' ||
      status === 'read'
    ) {

      message.isDelivered =
        true;


      if (deliveredAt) {

        message.deliveredAt =
          deliveredAt;

        message.deliveredAtUtc =
          deliveredAt;

      }

    }


    // =======================================================
    // READ
    // =======================================================

    if (
      status === 'read'
    ) {

      message.isRead =
        true;


      if (readAt) {

        message.readAt =
          readAt;

        message.readAtUtc =
          readAt;

      }

    }


    // =======================================================
    // REFRESH
    // =======================================================

    this.refreshActiveMessages(
      messages
    );

  }


  // =========================================================
  // REFRESH ACTIVE MESSAGES
  // =========================================================

  private refreshActiveMessages(
    messages: MessageWithStatus[]
  ): void {

    const service =
      this.chatService as unknown as {

        setActiveMessages?: (
          messages: unknown[]
        ) => void;

        updateActiveMessages?: (
          messages: unknown[]
        ) => void;

        activeMessagesSubject?: {
          next?: (
            messages: unknown[]
          ) => void;
        };

      };


    const updatedMessages =
      [...messages] as unknown[];


    // =======================================================
    // setActiveMessages
    // =======================================================

    if (
      typeof service.setActiveMessages ===
      'function'
    ) {

      service.setActiveMessages(
        updatedMessages
      );

      return;

    }


    // =======================================================
    // updateActiveMessages
    // =======================================================

    if (
      typeof service.updateActiveMessages ===
      'function'
    ) {

      service.updateActiveMessages(
        updatedMessages
      );

      return;

    }


    // =======================================================
    // SUBJECT
    // =======================================================

    if (
      service.activeMessagesSubject &&
      typeof service.activeMessagesSubject.next ===
        'function'
    ) {

      service.activeMessagesSubject.next(
        updatedMessages
      );

    }

  }


  // =========================================================
  // GET MESSAGE ID
  // =========================================================

  private getMessageId(
    message: MessageWithStatus
  ): string | null {

    if (
      message.id === undefined ||
      message.id === null
    ) {

      return null;

    }


    return String(
      message.id
    );

  }


  // =========================================================
  // GET MESSAGE STATUS
  // =========================================================

  public getMessageStatus(
    message: MessageWithStatus
  ): MessageStatus {

    // =======================================================
    // READ
    // =======================================================

    if (
      message.isRead === true ||
      !!message.readAt ||
      !!message.readAtUtc ||
      message.status?.toLowerCase() ===
        'read'
    ) {

      return 'read';

    }


    // =======================================================
    // DELIVERED
    // =======================================================

    if (
      message.isDelivered === true ||
      !!message.deliveredAt ||
      !!message.deliveredAtUtc ||
      message.status?.toLowerCase() ===
        'delivered'
    ) {

      return 'delivered';

    }


    // =======================================================
    // SENT
    // =======================================================

    return 'sent';

  }


  // =========================================================
  // CHECK OWN MESSAGE
  // =========================================================

  public isOwnMessage(
    message: MessageWithStatus
  ): boolean {

    const senderId =
      message.senderUserId ??
      message.senderId;


    if (!senderId) {

      return false;

    }


    if (!this.currentUserId) {

      return false;

    }


    return (
      String(senderId)
        .toLowerCase() ===
      String(this.currentUserId)
        .toLowerCase()
    );

  }


  // =========================================================
  // MESSAGE FOR CURRENT USER
  // =========================================================

  private isMessageForCurrentUser(
    message: MessageWithStatus
  ): boolean {

    const receiverId =
      message.receiverUserId ??
      message.receiverId;


    if (!receiverId) {

      return false;

    }


    return (
      String(receiverId)
        .toLowerCase() ===
      String(this.currentUserId)
        .toLowerCase()
    );

  }


  // =========================================================
  // BELONGS TO ACTIVE CONVERSATION
  // =========================================================

  private belongsToActiveConversation(
    message: MessageWithStatus
  ): boolean {

    if (!this.activeTargetUserId) {

      return false;

    }


    const senderId =
      message.senderUserId ??
      message.senderId;

    const receiverId =
      message.receiverUserId ??
      message.receiverId;


    if (!senderId || !receiverId) {

      return false;

    }


    const targetId =
      String(this.activeTargetUserId)
        .toLowerCase();

    const currentId =
      String(this.currentUserId)
        .toLowerCase();


    return (

      (
        String(senderId)
          .toLowerCase() === targetId &&

        String(receiverId)
          .toLowerCase() === currentId
      )

      ||

      (
        String(senderId)
          .toLowerCase() === currentId &&

        String(receiverId)
          .toLowerCase() === targetId
      )

    );

  }


  // =========================================================
  // MARK MESSAGE DELIVERED
  // =========================================================

  private async markMessageDelivered(
    message: MessageWithStatus
  ): Promise<void> {

    const messageId =
      this.getMessageId(message);


    if (!messageId) {

      return;

    }


    // =======================================================
    // ONLY RECEIVER CAN MARK DELIVERED
    // =======================================================

    if (
      !this.isMessageForCurrentUser(
        message
      )
    ) {

      return;

    }


    const status =
      this.getMessageStatus(
        message
      );


    // =======================================================
    // ALREADY DELIVERED / READ
    // =======================================================

    if (
      status === 'delivered' ||
      status === 'read'
    ) {

      return;

    }


    try {

      /*
       * IMPORTANT:
       *
       * ChatSignalRService contains:
       *
       * markMessageDelivered()
       *
       * and internally invokes:
       *
       * MarkMessageDelivered
       */

      await this.chatSignalRService
        .markMessageDelivered(
          messageId
        );


      console.log(
        'Message marked delivered:',
        messageId
      );

    } catch (error: unknown) {

      console.error(
        'Failed to mark message as delivered:',
        error
      );

    }

  }


  // =========================================================
  // MARK INCOMING MESSAGES DELIVERED
  // =========================================================

  private async markIncomingMessagesAsDelivered(
    messages: MessageWithStatus[]
  ): Promise<void> {

    if (!messages?.length) {

      return;

    }


    const incomingMessages =
      messages.filter(
        (message: MessageWithStatus) => {

          return (
            this.isMessageForCurrentUser(
              message
            ) &&

            this.getMessageStatus(
              message
            ) === 'sent'
          );

        }
      );


    for (
      const message of incomingMessages
    ) {

      await this.markMessageDelivered(
        message
      );

    }

  }


  // =========================================================
  // MARK MESSAGE READ
  // =========================================================

  private async markMessageRead(
    message: MessageWithStatus
  ): Promise<void> {

    const messageId =
      this.getMessageId(message);


    if (!messageId) {

      return;

    }


    // =======================================================
    // ONLY RECEIVER CAN MARK READ
    // =======================================================

    if (
      !this.isMessageForCurrentUser(
        message
      )
    ) {

      return;

    }


    const status =
      this.getMessageStatus(
        message
      );


    // =======================================================
    // ALREADY READ
    // =======================================================

    if (
      status === 'read'
    ) {

      return;

    }


    try {

      /*
       * ChatSignalRService contains:
       *
       * markMessageRead()
       *
       * which invokes:
       *
       * MarkMessageRead
       */

      await this.chatSignalRService
        .markMessageRead(
          messageId
        );


      console.log(
        'Message marked read:',
        messageId
      );

    } catch (error: unknown) {

      console.error(
        'Failed to mark message as read:',
        error
      );

    }

  }


  // =========================================================
  // MARK ACTIVE CONVERSATION AS READ
  // =========================================================

  private async markActiveConversationAsRead(): Promise<void> {

    if (!this.activeTargetUserId) {

      return;

    }


    const messages =
      this.getActiveMessages();


    if (!messages.length) {

      return;

    }


    const unreadMessages =
      messages.filter(
        (message: MessageWithStatus) => {

          const isIncoming =
            this.isMessageForCurrentUser(
              message
            );


          const belongsToConversation =
            this.belongsToActiveConversation(
              message
            );


          const status =
            this.getMessageStatus(
              message
            );


          return (
            isIncoming &&
            belongsToConversation &&
            status !== 'read'
          );

        }
      );


    for (
      const message of unreadMessages
    ) {

      await this.markMessageRead(
        message
      );

    }

  }


  // =========================================================
  // STATUS ICON
  // =========================================================

  public getMessageStatusIcon(
    message: MessageWithStatus
  ): string {

    const status =
      this.getMessageStatus(
        message
      );


    switch (status) {

      case 'read':

        return '✓✓';

      case 'delivered':

        return '✓✓';

      case 'sent':

      default:

        return '✓';

    }

  }


  // =========================================================
  // STATUS TITLE
  // =========================================================

  public getMessageStatusTitle(
    message: MessageWithStatus
  ): string {

    const status =
      this.getMessageStatus(
        message
      );


    switch (status) {

      case 'read':

        return 'Read';

      case 'delivered':

        return 'Delivered';

      case 'sent':

      default:

        return 'Sent';

    }

  }


  // =========================================================
  // LOAD USERS
  // =========================================================

  private async loadUsers(): Promise<void> {

    const service =
      this.chatService as any;


    try {

      if (
        typeof service.getUsers !==
        'function'
      ) {

        this.users = [];

        return;

      }


      const result =
        service.getUsers();


      // =====================================================
      // OBSERVABLE
      // =====================================================

      if (
        result &&
        typeof result.subscribe ===
          'function'
      ) {

        await new Promise<void>(
          (resolve) => {

            result.subscribe({

              next: (users: User[]) => {

                this.users =
                  users || [];

              },

              error: (error: unknown) => {

                console.error(
                  'Loading users failed:',
                  error
                );

                this.users =
                  [];

                resolve();

              },

              complete: () => {

                resolve();

              }

            });

          }
        );

        return;

      }


      // =====================================================
      // PROMISE
      // =====================================================

      if (
        result &&
        typeof result.then ===
          'function'
      ) {

        this.users =
          (await result) || [];

        return;

      }


      // =====================================================
      // ARRAY
      // =====================================================

      if (Array.isArray(result)) {

        this.users =
          result;

        return;

      }


      this.users = [];

    } catch (error: unknown) {

      console.error(
        'Loading users failed:',
        error
      );

      this.users = [];

    }

  }


  // =========================================================
  // USER ONLINE
  // =========================================================

  private setUserOnline(
    userId: string
  ): void {

    if (!userId) {

      return;

    }


    const user =
      this.users.find(
        (x: User) =>
          String(x.id) ===
          String(userId)
      );


    if (user) {

      user.isOnLine =
        true;

    }

  }


  // =========================================================
  // USER OFFLINE
  // =========================================================

  private setUserOffline(
    userId: string,
    lastSeen?: string
  ): void {

    if (!userId) {

      return;

    }


    const user =
      this.users.find(
        (x: User) =>
          String(x.id) ===
          String(userId)
      );


    if (user) {

      user.isOnLine =
        false;


      if (lastSeen) {

        user.lastSeen =
          lastSeen;

      }

    }

  }


  // =========================================================
  // CHECK USER ONLINE
  // =========================================================

  public isUserOnline(
    userId:
      string |
      null |
      undefined
  ): boolean {

    if (!userId) {

      return false;

    }


    return this.signalRService
      .isUserOnline(
        userId
      );

  }


  // =========================================================
  // ACTIVE USER ONLINE
  // =========================================================

  public isActiveUserOnline(): boolean {

    if (!this.activeTargetUserId) {

      return false;

    }


    return this.signalRService
      .isUserOnline(
        this.activeTargetUserId
      );

  }


  // =========================================================
  // AFTER VIEW CHECKED
  // =========================================================

  ngAfterViewChecked(): void {

    if (
      this.shouldScrollToBottom
    ) {

      this.scrollToBottom();

      this.shouldScrollToBottom =
        false;

    }


    this.attachMedia();

  }


  // =========================================================
  // ATTACH MEDIA
  // =========================================================

  private attachMedia(): void {

    if (this.isDestroyed) {

      return;

    }


    // =======================================================
    // LOCAL VIDEO
    // =======================================================

    if (
      this.localVideo?.nativeElement &&
      this.localStream &&
      this.activeCallType === 'video'
    ) {

      const video =
        this.localVideo.nativeElement;


      if (
        video.srcObject !==
        this.localStream
      ) {

        video.srcObject =
          this.localStream;

      }


      video.muted =
        true;

      video.autoplay =
        true;

      video.playsInline =
        true;


      if (
        this.lastLocalStream !==
        this.localStream
      ) {

        this.lastLocalStream =
          this.localStream;

        video.play()
          .catch(() => {});

      }

    }


    // =======================================================
    // REMOTE VIDEO
    // =======================================================

    if (
      this.remoteVideo?.nativeElement &&
      this.remoteStream &&
      this.activeCallType === 'video'
    ) {

      const video =
        this.remoteVideo.nativeElement;


      if (
        video.srcObject !==
        this.remoteStream
      ) {

        video.srcObject =
          this.remoteStream;

      }


      video.autoplay =
        true;

      video.playsInline =
        true;

      video.muted =
        false;


      if (
        this.lastRemoteStream !==
        this.remoteStream
      ) {

        this.lastRemoteStream =
          this.remoteStream;

        video.play()
          .catch(() => {});

      }

    }


    // =======================================================
    // REMOTE AUDIO
    // =======================================================

    if (
      this.remoteAudio?.nativeElement &&
      this.remoteStream &&
      this.activeCallType === 'voice'
    ) {

      const audio =
        this.remoteAudio.nativeElement;


      if (
        audio.srcObject !==
        this.remoteStream
      ) {

        audio.srcObject =
          this.remoteStream;

      }


      audio.autoplay =
        true;

      audio.controls =
        false;

      audio.volume =
        1;


      if (
        this.lastRemoteStream !==
        this.remoteStream
      ) {

        this.lastRemoteStream =
          this.remoteStream;

        audio.play()
          .catch(
            (error: unknown) => {

              console.warn(
                'Remote audio autoplay blocked:',
                error
              );

            }
          );

      }

    }

  }


  // =========================================================
  // START VIDEO CALL
  // =========================================================

  public async startCall(): Promise<void> {

    if (!this.activeTargetUserId) {

      console.warn(
        'Cannot start video call: no target user selected.'
      );

      return;

    }


    if (this.isStartingCall) {

      return;

    }


    this.isStartingCall =
      true;

    this.activeCallType =
      'video';

    this.callType =
      'video';

    this.callStatus =
      'Calling...';

    this.isMicrophoneMuted =
      false;

    this.isCameraOff =
      false;


    try {

      await this.callService
        .startCall(
          this.activeTargetUserId
        );


      setTimeout(() => {

        this.attachMedia();

      });

    } catch (error: unknown) {

      console.error(
        'Video call failed:',
        error
      );


      this.stopMedia();

      this.activeCallType =
        null;

      this.callType =
        null;

      this.callStatus =
        'Unable to start video call.';

    } finally {

      this.isStartingCall =
        false;

    }

  }


  // =========================================================
  // START VOICE CALL
  // =========================================================

  public async startVoiceCall(): Promise<void> {

    if (!this.activeTargetUserId) {

      console.warn(
        'Cannot start voice call: no target user selected.'
      );

      return;

    }


    if (this.isStartingCall) {

      return;

    }


    this.isStartingCall =
      true;

    this.activeCallType =
      'voice';

    this.callType =
      'voice';

    this.callStatus =
      'Calling...';

    this.isMicrophoneMuted =
      false;

    this.isCameraOff =
      false;


    try {

      await this.callService
        .startVoiceCall(
          this.activeTargetUserId
        );


      setTimeout(() => {

        this.attachMedia();

      });

    } catch (error: unknown) {

      console.error(
        'Voice call failed:',
        error
      );


      this.stopMedia();

      this.activeCallType =
        null;

      this.callType =
        null;

      this.callStatus =
        'Unable to start voice call.';

    } finally {

      this.isStartingCall =
        false;

    }

  }


  // =========================================================
  // ACCEPT INCOMING CALL
  // =========================================================

  public async acceptIncomingCall(): Promise<void> {

    if (!this.incomingCallUserId) {

      return;

    }


    const callerId =
      this.incomingCallUserId;


    this.activeTargetUserId =
      callerId;

    this.activeTargetName =
      this.incomingCallName ||
      'Caller';

    this.activeCallType =
      this.incomingCallType;

    this.callType =
      this.incomingCallType;


    try {

      this.callStatus =
        this.activeCallType === 'voice'
          ? 'Connecting voice call...'
          : 'Connecting video call...';


      await this.callService
        .acceptCall(
          callerId
        );


      this.incomingCallUserId =
        null;

      this.incomingCallName =
        '';


      setTimeout(() => {

        this.attachMedia();

      });

    } catch (error: unknown) {

      console.error(
        'Accept call failed:',
        error
      );


      this.callStatus =
        'Unable to accept call.';

    }

  }


  // =========================================================
  // REJECT INCOMING CALL
  // =========================================================

  public async rejectIncomingCall(): Promise<void> {

    if (!this.incomingCallUserId) {

      return;

    }


    const callerId =
      this.incomingCallUserId;


    try {

      await this.callService
        .rejectCall(
          callerId
        );

    } catch (error: unknown) {

      console.error(
        'Reject call failed:',
        error
      );

    }


    this.incomingCallUserId =
      null;

    this.incomingCallName =
      '';

    this.activeCallType =
      null;

    this.callType =
      null;

    this.callStatus =
      '';

  }


  // =========================================================
  // TOGGLE MICROPHONE
  // =========================================================

  public toggleMicrophone(): void {

    if (!this.activeCallType) {

      return;

    }


    try {

      const enabled =
        this.callService
          .toggleMicrophone();


      this.isMicrophoneMuted =
        !enabled;

    } catch (error: unknown) {

      console.error(
        'Microphone toggle failed:',
        error
      );

    }

  }


  // =========================================================
  // TOGGLE CAMERA
  // =========================================================

  public toggleCamera(): void {

    if (
      !this.activeCallType ||
      this.activeCallType === 'voice'
    ) {

      return;

    }


    try {

      const enabled =
        this.callService
          .toggleCamera();


      this.isCameraOff =
        !enabled;

    } catch (error: unknown) {

      console.error(
        'Camera toggle failed:',
        error
      );

    }

  }


  // =========================================================
  // END CALL
  // =========================================================

  public async endCall(): Promise<void> {

    try {

      await this.callService
        .endCall();

    } catch (error: unknown) {

      console.error(
        'End call failed:',
        error
      );

    } finally {

      this.stopMedia();

      this.activeCallType =
        null;

      this.callType =
        null;

      this.incomingCallUserId =
        null;

      this.incomingCallName =
        '';

      this.isStartingCall =
        false;

      this.callStatus =
        '';

    }

  }


  // =========================================================
  // STOP MEDIA
  // =========================================================

  private stopMedia(): void {

    // =======================================================
    // LOCAL
    // =======================================================

    if (this.localStream) {

      this.localStream
        .getTracks()
        .forEach(
          (track: MediaStreamTrack) => {

            try {

              track.stop();

            } catch {
              // Ignore
            }

          }
        );


      this.localStream =
        null;

    }


    // =======================================================
    // REMOTE
    // =======================================================

    if (this.remoteStream) {

      this.remoteStream
        .getTracks()
        .forEach(
          (track: MediaStreamTrack) => {

            try {

              track.stop();

            } catch {
              // Ignore
            }

          }
        );


      this.remoteStream =
        null;

    }


    // =======================================================
    // LOCAL VIDEO
    // =======================================================

    if (
      this.localVideo?.nativeElement
    ) {

      const video =
        this.localVideo.nativeElement;


      video.pause();

      video.srcObject =
        null;

    }


    // =======================================================
    // REMOTE VIDEO
    // =======================================================

    if (
      this.remoteVideo?.nativeElement
    ) {

      const video =
        this.remoteVideo.nativeElement;


      video.pause();

      video.srcObject =
        null;

    }


    // =======================================================
    // REMOTE AUDIO
    // =======================================================

    if (
      this.remoteAudio?.nativeElement
    ) {

      const audio =
        this.remoteAudio.nativeElement;


      audio.pause();

      audio.srcObject =
        null;

    }


    this.lastLocalStream =
      null;

    this.lastRemoteStream =
      null;

    this.isMicrophoneMuted =
      false;

    this.isCameraOff =
      false;

  }


  // =========================================================
  // NEW CHAT
  // =========================================================

  public openNewChatModal(): void {

    this.showNewChatModal =
      true;

    this.searchQuery =
      '';

    this.searchResults =
      [];

  }


  // =========================================================
  // CLOSE NEW CHAT
  // =========================================================

  public closeNewChatModal(): void {

    this.showNewChatModal =
      false;

    this.searchQuery =
      '';

    this.searchResults =
      [];

  }


  // =========================================================
  // SEARCH USERS
  // =========================================================

  public onSearchUsers(): void {

    const query =
      this.searchQuery.trim();


    if (!query) {

      this.searchResults =
        [];

      return;

    }


    this.chatService
      .searchUsers(query)
      .subscribe({

        next: (
          results: UserSearchResult[]
        ) => {

          this.searchResults =
            results || [];

        },

        error: (error: unknown) => {

          console.error(
            'User search failed:',
            error
          );

          this.searchResults =
            [];

        }

      });

  }


  // =========================================================
  // SELECT CONVERSATION
  // =========================================================

  public selectConversation(
    targetUserId: string,
    targetName?: string
  ): void {

    if (!targetUserId) {

      return;

    }


    this.activeTargetUserId =
      targetUserId;


    if (targetName) {

      this.activeTargetName =
        targetName;

    }


    this.shouldScrollToBottom =
      true;


    this.chatService
      .loadConversationHistory(
        targetUserId
      );


    setTimeout(() => {

      void this.markActiveConversationAsRead();

    });

  }


  // =========================================================
  // START CONVERSATION
  // =========================================================

  public startConversation(
    targetUserId: string,
    targetName: string
  ): void {

    if (!targetUserId) {

      return;

    }


    this.activeTargetUserId =
      targetUserId;

    this.activeTargetName =
      targetName ||
      'Chat';


    this.shouldScrollToBottom =
      true;


    this.chatService
      .loadConversationHistory(
        targetUserId
      );


    setTimeout(() => {

      void this.markActiveConversationAsRead();

    });

  }


  // =========================================================
  // SELECT USER AND START CHAT
  // =========================================================

  public selectUserAndStartChat(
    user: UserSearchResult
  ): void {

    if (!user?.id) {

      return;

    }


    this.activeTargetUserId =
      user.id;

    this.activeTargetName =
      user.name ||
      'User';


    this.closeNewChatModal();


    this.shouldScrollToBottom =
      true;


    this.chatService
      .loadConversationHistory(
        user.id
      );


    setTimeout(() => {

      void this.markActiveConversationAsRead();

    });

  }


  // =========================================================
  // SEND MESSAGE
  // =========================================================

  public async onSendMessage(): Promise<void> {

    const message =
      this.newMessageText.trim();


    if (
      !message ||
      !this.activeTargetUserId ||
      this.isSending
    ) {

      return;

    }


    const targetUserId =
      this.activeTargetUserId;


    this.newMessageText =
      '';

    this.isSending =
      true;


    try {

      await this.chatService
        .sendMessage(
          targetUserId,
          message
        );


      this.shouldScrollToBottom =
        true;

    } catch (error: unknown) {

      console.error(
        'Send message failed:',
        error
      );


      this.newMessageText =
        message;

    } finally {

      this.isSending =
        false;


      setTimeout(() => {

        this.scrollToBottom();

      });

    }

  }


  // =========================================================
  // MESSAGE KEYDOWN
  // =========================================================

  public onMessageKeydown(
    event: KeyboardEvent
  ): void {

    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {

      event.preventDefault();

      void this.onSendMessage();

    }

  }


  // =========================================================
  // SCROLL
  // =========================================================

  private scrollToBottom(): void {

    try {

      if (!this.scrollContainer) {

        return;

      }


      const element =
        this.scrollContainer.nativeElement;


      element.scrollTop =
        element.scrollHeight;

    } catch {
      // Ignore
    }

  }


  // =========================================================
  // AVATAR COLOR
  // =========================================================

  public getAvatarColor(
    text: string
  ): string {

    if (!text) {

      return '#e5e7eb';

    }


    const colors = [

      '#EF4444',
      '#F97316',
      '#F59E0B',
      '#EAB308',
      '#84CC16',
      '#22C55E',
      '#10B981',
      '#14B8A6',
      '#06B6D4',
      '#0EA5E9',
      '#3B82F6',
      '#6366F1',
      '#8B5CF6',
      '#A855F7',
      '#D946EF',
      '#EC4899',
      '#F43F5E'

    ];


    let hash = 0;


    for (
      let i = 0;
      i < text.length;
      i++
    ) {

      hash =
        text.charCodeAt(i) +
        ((hash << 5) - hash);

    }


    const index =
      Math.abs(hash) %
      colors.length;


    return colors[index];

  }


  // =========================================================
  // DESTROY
  // =========================================================

  ngOnDestroy(): void {

    this.isDestroyed =
      true;


    this.stopMedia();


    this.subscriptions
      .unsubscribe();

  }

}
