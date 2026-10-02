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
  UserOfflineEvent
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
// RAW MESSAGE STATUS
// =========================================================

type RawMessageStatus =
  | string
  | number
  | null
  | undefined;


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

  status?: RawMessageStatus;

  isDelivered?: boolean;
  isRead?: boolean;

  deliveredAt?: string | null;
  deliveredAtUtc?: string | null;

  readAt?: string | null;
  readAtUtc?: string | null;

  [key: string]: unknown;
}


// =========================================================
// MESSAGE HISTORY RESPONSE
// =========================================================

interface MessageHistoryResponse {

  items: ChatMessage[];

  pageNumber: number;

  pageSize: number;

  totalCount: number;

  totalPages: number;

  hasPreviousPage: boolean;

  hasNextPage: boolean;

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

  protected signalRService =
    inject(SignalRService);

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

  public isCallActive$: Observable<boolean> =
    this.callService.isCallActive$;

  public localStream: MediaStream | null = null;

  public remoteStream: MediaStream | null = null;

  public isStartingCall = false;

  public callStatus = '';

  public isMicrophoneMuted = false;

  public isCameraOff = false;


  // =========================================================
  // MEDIA TRACKING
  // =========================================================

  private lastLocalStream: MediaStream | null = null;

  private lastRemoteStream: MediaStream | null = null;


  // =========================================================
  // GENERAL STATE
  // =========================================================

  private shouldScrollToBottom = false;

  private isDestroyed = false;

  private initialScrollPending = false;

  private bottomScrollScheduled = false;


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
  // MESSAGE PAGINATION
  // =========================================================

  /**
   * Current page already loaded.
   *
   * Initial page = 1.
   *
   * When user reaches the top:
   *
   * nextPage = messagePageNumber + 1
   */
  public messagePageNumber = 1;

  public messagePageSize = 20;

  /**
   * True while older messages are being loaded.
   */
  public isLoadingOlderMessages = false;

  /**
   * This controls whether another page can be loaded.
   *
   * API response:
   *
   * hasNextPage = true
   *     -> continue loading
   *
   * hasNextPage = false
   *     -> STOP loading
   */
  public hasMoreMessages = true;

  /**
   * Prevent automatic scroll events immediately
   * after opening a conversation.
   */
  private ignoreScrollUntil = 0;

  /**
   * Distance from top before loading older messages.
   */
  private readonly scrollThreshold = 80;

  /**
   * True while restoring scroll position after
   * older messages are inserted.
   */
  private restoringScrollPosition = false;


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
    // START SIGNALR
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
    // ACTIVE MESSAGES
    // =======================================================

    this.subscriptions.add(

      this.chatService
        .activeMessages$
        .subscribe(
          (messages: ChatMessage[]) => {

            if (this.isDestroyed) {
              return;
            }


            const statusMessages =
              messages as unknown as MessageWithStatus[];


            /*
             * If a conversation was just opened,
             * request a forced bottom scroll.
             */
            if (
              this.shouldScrollToBottom &&
              !this.restoringScrollPosition
            ) {

              this.initialScrollPending =
                true;

              this.shouldScrollToBottom =
                false;

            }


            /*
             * Wait for Angular to render the messages.
             */
            setTimeout(() => {

              if (this.isDestroyed) {
                return;
              }


              if (
                this.initialScrollPending &&
                !this.restoringScrollPosition
              ) {

                this.initialScrollPending =
                  false;

                this.forceScrollToBottom();

              }


              void this.markIncomingMessagesAsDelivered(
                statusMessages
              );


              void this.markActiveConversationAsRead();

            }, 0);

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
  // AFTER VIEW CHECKED
  // =========================================================

  ngAfterViewChecked(): void {

    /*
     * Do NOT scroll to bottom on every
     * ngAfterViewChecked().
     *
     * This would break pagination.
     */

    this.attachMedia();


    if (
      this.initialScrollPending &&
      !this.restoringScrollPosition &&
      this.scrollContainer
    ) {

      this.initialScrollPending =
        false;

      this.forceScrollToBottom();

    }

  }


  // =========================================================
  // MESSAGE SCROLL
  // =========================================================

  public onMessageScroll(
    event: Event
  ): void {

    if (this.isDestroyed) {
      return;
    }


    if (!this.activeTargetUserId) {
      return;
    }


    /*
     * IMPORTANT:
     *
     * If the API returned:
     *
     * hasNextPage: false
     *
     * we stop here.
     *
     * No more API calls will happen.
     */
    if (!this.hasMoreMessages) {

      console.log(
        'Scrolling stopped: no more messages available.'
      );

      return;

    }


    if (this.isLoadingOlderMessages) {
      return;
    }


    if (this.restoringScrollPosition) {
      return;
    }


    /*
     * Ignore scroll events caused by our
     * initial scroll-to-bottom.
     */
    if (
      Date.now() <
      this.ignoreScrollUntil
    ) {

      return;

    }


    const element =
      event.target as HTMLElement | null;


    if (!element) {
      return;
    }


    /*
     * Only load older messages when user
     * reaches the top.
     */
    if (
      element.scrollTop >
      this.scrollThreshold
    ) {

      return;

    }


    console.log(
      'Reached top. Loading older messages...'
    );


    void this.loadNextMessagePage();

  }


  // =========================================================
  // LOAD NEXT MESSAGE PAGE
  // =========================================================

  private async loadNextMessagePage(): Promise<void> {

    if (!this.activeTargetUserId) {
      return;
    }


    if (this.isLoadingOlderMessages) {
      return;
    }


    /*
     * IMPORTANT:
     *
     * If previous API response returned:
     *
     * hasNextPage = false
     *
     * stop immediately.
     */
    if (!this.hasMoreMessages) {

      console.log(
        'No more older messages available.'
      );

      return;

    }


    const element =
      this.scrollContainer?.nativeElement;


    if (!element) {

      console.warn(
        'scrollContainer not found.'
      );

      return;

    }


    this.isLoadingOlderMessages =
      true;

    this.restoringScrollPosition =
      true;


    /*
     * Current loaded page.
     */
    const currentPage =
      this.messagePageNumber;


    /*
     * Load current page + 1.
     */
    const nextPage =
      currentPage + 1;


    console.log(
      'Current page:',
      currentPage
    );


    console.log(
      'Loading next page:',
      nextPage
    );


    /*
     * Save exact scroll position BEFORE
     * inserting older messages.
     */
    const oldScrollHeight =
      element.scrollHeight;

    const oldScrollTop =
      element.scrollTop;


    try {

      const response =
        await this.loadConversationPage(
          this.activeTargetUserId,
          nextPage,
          this.messagePageSize
        );


      // =====================================================
      // UPDATE PAGINATION FROM API RESPONSE
      // =====================================================

      if (response) {

        console.log(
          'Message history response:',
          response
        );


        /*
         * IMPORTANT:
         *
         * Use the page number returned by the API.
         */
        this.messagePageNumber =
          response.pageNumber;


        /*
         * THIS CONTROLS THE STOPPING.
         *
         * Example:
         *
         * hasNextPage: true
         *
         * -> continue
         *
         * hasNextPage: false
         *
         * -> stop
         */
        this.hasMoreMessages =
          response.hasNextPage;


        console.log(
          'Updated pagination:',
          {
            currentPage:
              this.messagePageNumber,

            hasMoreMessages:
              this.hasMoreMessages,

            hasNextPage:
              response.hasNextPage,

            totalPages:
              response.totalPages,

            totalCount:
              response.totalCount
          }
        );


        if (!response.hasNextPage) {

          console.log(
            'Reached last message page. Further scrolling is disabled.'
          );

        }

      } else {

        /*
         * If your service doesn't return the API response,
         * keep the page number moving forward.
         */
        this.messagePageNumber =
          nextPage;

      }


      // =====================================================
      // RESTORE SCROLL POSITION
      // =====================================================

      setTimeout(() => {

        if (
          this.isDestroyed ||
          !this.scrollContainer
        ) {

          this.isLoadingOlderMessages =
            false;

          this.restoringScrollPosition =
            false;

          return;

        }


        const container =
          this.scrollContainer.nativeElement;


        const newScrollHeight =
          container.scrollHeight;


        const heightDifference =
          newScrollHeight -
          oldScrollHeight;


        /*
         * Preserve the message that was visible
         * before loading older messages.
         */
        container.scrollTop =
          oldScrollTop +
          heightDifference;


        console.log(
          'Scroll restored:',
          {
            oldScrollTop,
            oldScrollHeight,
            newScrollHeight,
            heightDifference,
            newScrollTop:
              container.scrollTop,

            hasMoreMessages:
              this.hasMoreMessages
          }
        );


        this.restoringScrollPosition =
          false;

        this.isLoadingOlderMessages =
          false;


      }, 100);

    } catch (error: unknown) {

      console.error(
        'Failed to load older messages:',
        error
      );


      this.restoringScrollPosition =
        false;

      this.isLoadingOlderMessages =
        false;

    }

  }


  // =========================================================
  // LOAD CONVERSATION PAGE
  // =========================================================

  private async loadConversationPage(
    targetUserId: string,
    pageNumber: number,
    pageSize: number
  ): Promise<MessageHistoryResponse | null> {

    const service =
      this.chatService as unknown as {

        loadConversationHistory?: (
          targetUserId: string,
          pageNumber?: number,
          pageSize?: number
        ) => unknown;

      };


    if (
      typeof service.loadConversationHistory !==
      'function'
    ) {

      throw new Error(
        'ChatService.loadConversationHistory() is not available.'
      );

    }


    const result =
      service.loadConversationHistory(
        targetUserId,
        pageNumber,
        pageSize
      );


    // =======================================================
    // OBSERVABLE
    // =======================================================

    if (
      result &&
      typeof (
        result as {
          subscribe?: unknown;
        }
      ).subscribe === 'function'
    ) {

      return await new Promise<MessageHistoryResponse | null>(
        (
          resolve,
          reject
        ) => {

          let resolved = false;


          (
            result as {
              subscribe: (
                handlers: {
                  next?: (
                    value: unknown
                  ) => void;

                  error?: (
                    error: unknown
                  ) => void;

                  complete?: () => void;
                }
              ) => unknown;
            }
          ).subscribe({

            next: (
              value: unknown
            ) => {

              if (resolved) {
                return;
              }


              resolved = true;


              if (
                value &&
                typeof value === 'object'
              ) {

                resolve(
                  value as MessageHistoryResponse
                );

              } else {

                resolve(null);

              }

            },

            error: (
              error: unknown
            ) => {

              if (resolved) {
                return;
              }


              resolved = true;


              reject(error);

            },

            complete: () => {

              /*
               * If next() already returned a response,
               * do nothing.
               */
              if (resolved) {
                return;
              }


              resolved = true;


              resolve(null);

            }

          });

        }
      );

    }


    // =======================================================
    // PROMISE
    // =======================================================

    if (
      result &&
      typeof (
        result as {
          then?: unknown;
        }
      ).then === 'function'
    ) {

      const response =
        await (
          result as Promise<unknown>
        );


      if (
        response &&
        typeof response === 'object'
      ) {

        return response as MessageHistoryResponse;

      }


      return null;

    }


    return null;

  }


  // =========================================================
  // RESET PAGINATION
  // =========================================================

  private resetMessagePagination(): void {

    /*
     * Every new conversation starts from page 1.
     */
    this.messagePageNumber =
      1;


    /*
     * Initially assume more messages may exist.
     *
     * The API response will update this:
     *
     * this.hasMoreMessages = response.hasNextPage;
     */
    this.hasMoreMessages =
      true;


    this.isLoadingOlderMessages =
      false;


    this.restoringScrollPosition =
      false;


    /*
     * Ignore automatic scroll events while
     * initial conversation is being rendered.
     */
    this.ignoreScrollUntil =
      Date.now() + 1200;

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


            if (
              event.messageId === null ||
              event.messageId === undefined ||
              String(event.messageId).trim() === ''
            ) {

              console.warn(
                'MessageStatusChanged without messageId:',
                event
              );

              return;

            }


            const messageId =
              String(event.messageId);


            const status =
              this.normalizeMessageStatus(
                event.status as RawMessageStatus
              );


            if (!status) {

              console.warn(
                'Unknown message status:',
                event.status,
                event
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
  // NORMALIZE MESSAGE STATUS
  // =========================================================

  private normalizeMessageStatus(
    status: RawMessageStatus
  ): MessageStatus | null {

    if (
      status === null ||
      status === undefined
    ) {

      return null;

    }


    if (
      typeof status === 'number'
    ) {

      switch (status) {

        case 0:
          return 'sent';

        case 1:
          return 'delivered';

        case 2:
          return 'read';

        default:
          return null;

      }

    }


    const normalized =
      status
        .trim()
        .toLowerCase();


    if (!normalized) {
      return null;
    }


    switch (normalized) {

      case '0':
        return 'sent';

      case '1':
        return 'delivered';

      case '2':
        return 'read';

      case 'sent':
      case 'send':
      case 'sending':
        return 'sent';

      case 'delivered':
      case 'delivery':
        return 'delivered';

      case 'read':
      case 'seen':
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


    if (
      Array.isArray(
        service.activeMessages
      )
    ) {

      return (
        service.activeMessages as MessageWithStatus[]
      );

    }


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
      return;
    }


    const currentStatus =
      this.getMessageStatus(message);


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


    message.status =
      status;


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


    if (
      typeof service.setActiveMessages ===
      'function'
    ) {

      service.setActiveMessages(
        updatedMessages
      );

      return;

    }


    if (
      typeof service.updateActiveMessages ===
      'function'
    ) {

      service.updateActiveMessages(
        updatedMessages
      );

      return;

    }


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


    const id =
      String(message.id).trim();


    return id || null;

  }


  // =========================================================
  // GET MESSAGE STATUS
  // =========================================================

  public getMessageStatus(
    message: MessageWithStatus
  ): MessageStatus {

    if (
      message.isRead === true ||
      !!message.readAt ||
      !!message.readAtUtc
    ) {

      return 'read';

    }


    const normalizedStatus =
      this.normalizeMessageStatus(
        message.status
      );


    if (
      normalizedStatus === 'read'
    ) {

      return 'read';

    }


    if (
      message.isDelivered === true ||
      !!message.deliveredAt ||
      !!message.deliveredAtUtc ||
      normalizedStatus === 'delivered'
    ) {

      return 'delivered';

    }


    return 'sent';

  }


  // =========================================================
  // STATUS TEXT
  // =========================================================

  public getMessageStatusText(
    message: MessageWithStatus
  ): string {

    switch (
      this.getMessageStatus(message)
    ) {

      case 'read':
        return 'Read';

      case 'delivered':
        return 'Delivered';

      default:
        return 'Sent';

    }

  }


  // =========================================================
  // STATUS ICON
  // =========================================================

  public getMessageStatusIcon(
    message: MessageWithStatus
  ): string {

    switch (
      this.getMessageStatus(message)
    ) {

      case 'read':
      case 'delivered':
        return '✓✓';

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

    return this.getMessageStatusText(
      message
    );

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


    if (
      !senderId ||
      !this.currentUserId
    ) {

      return false;

    }


    return (
      String(senderId).toLowerCase() ===
      String(this.currentUserId).toLowerCase()
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
      String(receiverId).toLowerCase() ===
      String(this.currentUserId).toLowerCase()
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
      String(this.activeTargetUserId).toLowerCase();

    const currentId =
      String(this.currentUserId).toLowerCase();


    return (

      (
        String(senderId).toLowerCase() === targetId &&
        String(receiverId).toLowerCase() === currentId
      )

      ||

      (
        String(senderId).toLowerCase() === currentId &&
        String(receiverId).toLowerCase() === targetId
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


    if (
      !messageId ||
      !this.isMessageForCurrentUser(message)
    ) {

      return;

    }


    const status =
      this.getMessageStatus(message);


    if (
      status === 'delivered' ||
      status === 'read'
    ) {

      return;

    }


    try {

      await this.chatSignalRService
        .markMessageDelivered(
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
  // MARK INCOMING DELIVERED
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
            this.isMessageForCurrentUser(message) &&
            this.getMessageStatus(message) === 'sent'
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


    if (
      !messageId ||
      !this.isMessageForCurrentUser(message)
    ) {

      return;

    }


    if (
      this.getMessageStatus(message) === 'read'
    ) {

      return;

    }


    try {

      await this.chatSignalRService
        .markMessageRead(
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
  // MARK ACTIVE CONVERSATION READ
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

          return (
            this.isMessageForCurrentUser(message) &&
            this.belongsToActiveConversation(message) &&
            this.getMessageStatus(message) !== 'read'
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


      if (
        result &&
        typeof result.then ===
        'function'
      ) {

        this.users =
          (await result) || [];

        return;

      }


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
          String(x.id) === String(userId)
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
          String(x.id) === String(userId)
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
  // SCHEDULE BOTTOM SCROLL
  // =========================================================

  private scheduleScrollToBottom(): void {

    if (this.isDestroyed) {
      return;
    }


    if (this.bottomScrollScheduled) {
      return;
    }


    this.bottomScrollScheduled =
      true;


    setTimeout(() => {

      if (this.isDestroyed) {

        this.bottomScrollScheduled =
          false;

        return;

      }


      this.forceScrollToBottom();


      setTimeout(() => {

        if (!this.isDestroyed) {

          this.forceScrollToBottom();

        }

        this.bottomScrollScheduled =
          false;

      }, 150);

    }, 0);

  }


  // =========================================================
  // FORCE SCROLL TO BOTTOM
  // =========================================================

  private forceScrollToBottom(): void {

    if (this.isDestroyed) {
      return;
    }


    const scroll = (
      behavior: ScrollBehavior = 'auto'
    ): void => {

      if (this.isDestroyed) {
        return;
      }


      const element =
        this.scrollContainer?.nativeElement;


      if (!element) {
        return;
      }


      const bottom =
        Math.max(
          0,
          element.scrollHeight -
          element.clientHeight
        );


      element.scrollTo({
        top: bottom,
        behavior
      });


      element.scrollTop =
        bottom;

    };


    /*
     * Attempt 1
     */
    scroll('auto');


    /*
     * Attempt 2
     */
    requestAnimationFrame(() => {

      scroll('auto');


      /*
       * Attempt 3
       */
      requestAnimationFrame(() => {

        scroll('auto');


        /*
         * Attempt 4
         */
        setTimeout(() => {

          scroll('auto');

        }, 50);


        /*
         * Attempt 5
         */
        setTimeout(() => {

          scroll('auto');

        }, 150);


        /*
         * Attempt 6
         */
        setTimeout(() => {

          scroll('auto');

        }, 300);

      });

    });

  }


  // =========================================================
  // SIMPLE SCROLL TO BOTTOM
  // =========================================================

  private scrollToBottom(): void {

    if (this.isDestroyed) {
      return;
    }


    const element =
      this.scrollContainer?.nativeElement;


    if (!element) {
      return;
    }


    const bottom =
      Math.max(
        0,
        element.scrollHeight -
        element.clientHeight
      );


    element.scrollTop =
      bottom;

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


    if (
      this.localVideo?.nativeElement
    ) {

      const video =
        this.localVideo.nativeElement;

      video.pause();

      video.srcObject =
        null;

    }


    if (
      this.remoteVideo?.nativeElement
    ) {

      const video =
        this.remoteVideo.nativeElement;

      video.pause();

      video.srcObject =
        null;

    }


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


    /*
     * Reset pagination.
     */
    this.resetMessagePagination();


    /*
     * Initial page should scroll to bottom.
     */
    this.shouldScrollToBottom =
      true;

    this.initialScrollPending =
      true;


    console.log(
      'Opening conversation:',
      targetUserId
    );


    this.chatService
      .loadConversationHistory(
        targetUserId,
        1,
        this.messagePageSize
      );


    this.forceScrollAfterConversationLoad();


    setTimeout(() => {

      void this.markActiveConversationAsRead();

    }, 300);

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


    this.resetMessagePagination();


    this.shouldScrollToBottom =
      true;

    this.initialScrollPending =
      true;


    console.log(
      'Opening conversation:',
      targetUserId
    );


    this.chatService
      .loadConversationHistory(
        targetUserId,
        1,
        this.messagePageSize
      );


    this.forceScrollAfterConversationLoad();


    setTimeout(() => {

      void this.markActiveConversationAsRead();

    }, 300);

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


    this.resetMessagePagination();


    this.shouldScrollToBottom =
      true;

    this.initialScrollPending =
      true;


    console.log(
      'Opening conversation:',
      user.id
    );


    this.chatService
      .loadConversationHistory(
        user.id,
        1,
        this.messagePageSize
      );


    this.forceScrollAfterConversationLoad();


    setTimeout(() => {

      void this.markActiveConversationAsRead();

    }, 300);

  }


  // =========================================================
  // FORCE AFTER CONVERSATION LOAD
  // =========================================================

  private forceScrollAfterConversationLoad(): void {

    if (this.isDestroyed) {
      return;
    }


    this.forceScrollToBottom();


    setTimeout(() => {

      if (this.isDestroyed) {
        return;
      }


      this.forceScrollToBottom();

    }, 50);


    setTimeout(() => {

      if (this.isDestroyed) {
        return;
      }


      this.forceScrollToBottom();

    }, 150);


    setTimeout(() => {

      if (this.isDestroyed) {
        return;
      }


      this.forceScrollToBottom();

    }, 400);

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


      /*
       * New message belongs at bottom.
       */
      this.shouldScrollToBottom =
        true;


      this.scheduleScrollToBottom();

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
