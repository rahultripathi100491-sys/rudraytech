import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
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

type RawMessageStatus =
  | string
  | number
  | null
  | undefined;


// =========================================================
// MESSAGE
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

  items?: ChatMessage[];

  pageNumber?: number;

  pageSize?: number;

  totalCount?: number;

  totalPages?: number;

  hasPreviousPage?: boolean;

  hasNextPage?: boolean;
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

  public incomingCallType: CallType | null = null;

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
  // CALLING / RINGING DURATION
  // =========================================================

  public callingDurationSeconds = 0;

  private callingDurationTimer:
    ReturnType<typeof setInterval> | null = null;


  /**
   * Main formatted calling duration.
   *
   * Example:
   * 00:01
   * 00:02
   * 01:05
   */
  public get callingDurationText(): string {

    const totalSeconds =
      this.callingDurationSeconds;

    const minutes =
      Math.floor(
        totalSeconds / 60
      );

    const seconds =
      totalSeconds % 60;

    return (
      `${this.padTime(minutes)}:` +
      `${this.padTime(seconds)}`
    );

  }


  /**
   * Compatibility getter for chat-window.html.
   *
   * Your HTML currently references:
   *
   * {{ callDuration }}
   *
   * This getter prevents:
   *
   * TS2339: Property 'callDuration' does not exist
   *
   * while keeping callingDurationText as the
   * main formatted duration property.
   */
  public get callDuration(): string {

    return this.callingDurationText;

  }


  private padTime(
    value: number
  ): string {

    return String(value)
      .padStart(2, '0');

  }


  private startCallingDuration(): void {

    this.stopCallingDuration();

    this.callingDurationSeconds =
      0;

    this.callingDurationTimer =
      setInterval(() => {

        if (this.isDestroyed) {

          this.stopCallingDuration();

          return;

        }

        this.callingDurationSeconds++;

      }, 1000);

  }


  private stopCallingDuration(): void {

    if (
      this.callingDurationTimer !==
      null
    ) {

      clearInterval(
        this.callingDurationTimer
      );

      this.callingDurationTimer =
        null;

    }

  }


  private resetCallingDuration(): void {

    this.stopCallingDuration();

    this.callingDurationSeconds =
      0;

  }


  // =========================================================
  // CALL TYPE HELPERS
  // =========================================================

  public isVideoCall(): boolean {

    return this.activeCallType === 'video';

  }


  public isVoiceCall(): boolean {

    return this.activeCallType === 'voice';

  }


  public isIncomingVideoCall(): boolean {

    return (
      this.incomingCallUserId !== null &&
      this.incomingCallType === 'video'
    );

  }


  public isIncomingVoiceCall(): boolean {

    return (
      this.incomingCallUserId !== null &&
      this.incomingCallType === 'voice'
    );

  }


  // =========================================================
  // OUTGOING CALL SCREEN
  // =========================================================

  public showOutgoingCallScreen = false;

  public isOutgoingCall = false;

  private outgoingCallPending = false;

  public outgoingCallName = '';

  public callerCallStatus = '';

  private outgoingCallTargetUserId: string | null = null;


  // =========================================================
  // CALL DISPLAY NAME
  // =========================================================

  public get callDisplayName(): string {

    if (this.incomingCallUserId) {

      return (
        this.incomingCallName ||
        this.resolveUserName(
          this.incomingCallUserId
        ) ||
        'Caller'
      );

    }


    if (this.outgoingCallName) {

      return this.outgoingCallName;

    }


    if (this.activeTargetUserId) {

      return (
        this.activeTargetName ||
        this.resolveUserName(
          this.activeTargetUserId
        ) ||
        'User'
      );

    }


    return 'User';

  }


  // =========================================================
  // MEDIA TRACKING
  // =========================================================

  private lastLocalStream: MediaStream | null = null;

  private lastRemoteStream: MediaStream | null = null;


  // =========================================================
  // GENERAL STATE
  // =========================================================

  private isDestroyed = false;

  private initialScrollPending = false;

  private bottomScrollScheduled = false;

  private ignoreScrollUntil = 0;


  // =========================================================
  // CHAT STATE
  // =========================================================

  public showNewChatModal = false;

  public searchQuery = '';

  public searchResults: UserSearchResult[] = [];

  public activeTargetUserId: string | null = null;

  public activeTargetName = '';

  public currentUserId =
    localStorage.getItem('userId') || '';

  public newMessageText = '';

  public isSending = false;

  public isLogin =
    localStorage.getItem('isLogin') === 'true';


  // =========================================================
  // PAGINATION
  // =========================================================

  public messagePageNumber = 1;

  public messagePageSize = 20;

  public isLoadingOlderMessages = false;

  public hasMoreMessages = true;

  private restoringScrollPosition = false;

  private readonly scrollThreshold = 80;

  private requestedPages =
    new Set<number>();

  private loadingPageNumber: number | null = null;


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

    try {

      await this.signalRService.startConnection();

    } catch (error: unknown) {

      console.error(
        'SignalR connection failed:',
        error
      );

    }


    try {

      await this.chatSignalRService.start();

    } catch (error: unknown) {

      console.error(
        'Chat SignalR connection failed:',
        error
      );

    }


    await this.loadUsers();


    // =======================================================
    // ACTIVE CHAT MESSAGES
    // =======================================================

    this.subscriptions.add(

      this.chatService.activeMessages$
        .subscribe(
          (messages: ChatMessage[]) => {

            if (this.isDestroyed) {
              return;
            }


            if (this.initialScrollPending) {

              this.scheduleInitialBottomScroll();

            }


            if (
              !this.restoringScrollPosition &&
              this.isNearBottom()
            ) {

              this.scheduleScrollToBottom();

            }


            setTimeout(() => {

              if (this.isDestroyed) {
                return;
              }


              const statusMessages =
                messages as unknown as MessageWithStatus[];


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

      this.signalRService.userOffline$
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
    // INCOMING CALL USER
    // =======================================================

    this.subscriptions.add(

      this.callService.incomingCall$
        .subscribe(
          (userId: string | null) => {

            console.log(
              '[ChatWindow] Incoming call user:',
              userId
            );


            this.incomingCallUserId =
              userId;


            if (!userId) {

              this.incomingCallName = '';

              this.incomingCallType = null;

              return;

            }


            this.showOutgoingCallScreen =
              false;

            this.isOutgoingCall =
              false;

            this.outgoingCallName =
              '';

            this.outgoingCallTargetUserId =
              null;

            this.outgoingCallPending =
              false;


            this.callStatus =
              'Incoming call...';


            if (this.incomingCallType) {

              this.activeCallType =
                this.incomingCallType;

              this.callType =
                this.incomingCallType;

            }


            console.log(
              '[ChatWindow] Incoming call type currently:',
              this.incomingCallType
            );

          }
        )

    );


    // =======================================================
    // INCOMING CALL NAME
    // =======================================================

    this.subscriptions.add(

      this.callService.incomingCallName$
        .subscribe(
          (name: string) => {

            const cleanName =
              (name || '').trim();


            this.incomingCallName =
              cleanName || 'Caller';

          }
        )

    );


    // =======================================================
    // INCOMING CALL TYPE
    // =======================================================

    this.subscriptions.add(

      this.callService.incomingCallType$
        .subscribe(
          (type: CallType | null) => {

            console.log(
              '[ChatWindow] Incoming call type received:',
              type
            );


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


              this.callStatus =
                type === 'voice'
                  ? 'Incoming voice call...'
                  : 'Incoming video call...';

            }


            console.log(
              '[ChatWindow] Call type state:',
              {
                incomingCallType:
                  this.incomingCallType,

                activeCallType:
                  this.activeCallType,

                callType:
                  this.callType
              }
            );

          }
        )

    );


    // =======================================================
    // LOCAL STREAM
    // =======================================================

    this.subscriptions.add(

      this.callService.localStream$
        .subscribe(
          (stream: MediaStream | null) => {

            console.log(
              '[ChatWindow] Local stream:',
              stream
            );


            this.localStream =
              stream;


            if (!stream) {

              this.lastLocalStream =
                null;

            }


            if (
              this.activeCallType ===
              'voice'
            ) {

              this.clearVideoElements();

            }


            this.scheduleMediaAttach();

          }
        )

    );


    // =======================================================
    // REMOTE STREAM
    // =======================================================

    this.subscriptions.add(

      this.callService.remoteStream$
        .subscribe(
          (stream: MediaStream | null) => {

            console.log(
              '[ChatWindow] Remote stream:',
              stream
            );


            this.remoteStream =
              stream;


            if (!stream) {

              this.lastRemoteStream =
                null;

            }


            if (
              this.activeCallType ===
              'voice'
            ) {

              this.clearVideoElements();

            }


            this.scheduleMediaAttach();

          }
        )

    );


    // =======================================================
    // CALL ACTIVE
    // =======================================================

    this.subscriptions.add(

      this.callService.isCallActive$
        .subscribe(
          (isActive: boolean) => {

            if (this.isDestroyed) {
              return;
            }


            if (!isActive) {
              return;
            }


            this.stopCallingDuration();


            if (!this.activeCallType) {

              this.activeCallType =
                this.callType ||
                this.incomingCallType ||
                null;

            }


            if (!this.callType) {

              this.callType =
                this.activeCallType;

            }


            console.log(
              '[ChatWindow] Active call:',
              {
                activeCallType:
                  this.activeCallType,

                callType:
                  this.callType,

                incomingCallType:
                  this.incomingCallType
              }
            );


            if (
              this.activeCallType ===
              'voice'
            ) {

              this.callStatus =
                'Voice call connected';

              this.isCameraOff =
                true;

              this.clearVideoElements();

            }


            else if (
              this.activeCallType ===
              'video'
            ) {

              this.callStatus =
                'Video call connected';

              this.isCameraOff =
                false;

            }


            else {

              console.warn(
                '[ChatWindow] Call became active but call type is unknown.'
              );

            }


            this.callerCallStatus =
              'Connected';


            this.scheduleMediaAttach();

          }
        )

    );


    // =======================================================
    // CALL ACCEPTED
    // =======================================================

    this.subscriptions.add(

      this.callService.callAccepted$
        .subscribe(
          (userId: string | null) => {

            if (!userId) {
              return;
            }


            this.stopCallingDuration();


            this.activeTargetUserId =
              userId;


            const resolvedName =
              this.resolveUserName(userId);


            if (resolvedName) {

              this.activeTargetName =
                resolvedName;

            }


            this.closeOutgoingCallScreen();


            this.incomingCallUserId =
              null;

            this.incomingCallName =
              '';


            this.callerCallStatus =
              'Connected';


            if (
              this.activeCallType ===
              'voice'
            ) {

              this.callStatus =
                'Voice call connected';

              this.isCameraOff =
                true;

              this.clearVideoElements();

            }

            else if (
              this.activeCallType ===
              'video'
            ) {

              this.callStatus =
                'Video call connected';

              this.isCameraOff =
                false;

            }


            this.scheduleMediaAttach();

          }
        )

    );


    // =======================================================
    // CALL REJECTED
    // =======================================================

    this.subscriptions.add(

      this.callService.callRejected$
        .subscribe(() => {

          this.stopCallingDuration();


          this.closeOutgoingCallScreen();


          this.callStatus =
            'Call declined';

          this.callerCallStatus =
            'Call declined';


          this.stopMedia();


          this.resetCallState();

        })

    );


    // =======================================================
    // CALL ENDED
    // =======================================================

    this.subscriptions.add(

      this.callService.callEnded$
        .subscribe(() => {

          this.stopCallingDuration();


          this.closeOutgoingCallScreen();


          this.callStatus =
            'Call ended';

          this.callerCallStatus =
            'Call ended';


          this.stopMedia();


          this.resetCallState();

        })

    );

  }


  // =========================================================
  // RESET CALL STATE
  // =========================================================

  private resetCallState(): void {

    this.resetCallingDuration();


    this.incomingCallUserId =
      null;

    this.incomingCallName =
      '';

    this.incomingCallType =
      null;

    this.activeCallType =
      null;

    this.callType =
      null;

    this.isStartingCall =
      false;

    this.isMicrophoneMuted =
      false;

    this.isCameraOff =
      false;

  }


  // =========================================================
  // CLOSE OUTGOING CALL SCREEN
  // =========================================================

  private closeOutgoingCallScreen(): void {

    this.showOutgoingCallScreen =
      false;

    this.isOutgoingCall =
      false;

    this.outgoingCallPending =
      false;

    this.outgoingCallTargetUserId =
      null;

    this.isStartingCall =
      false;

  }


  // =========================================================
  // RESOLVE USER NAME
  // =========================================================

  private resolveUserName(
    userId: string | null | undefined
  ): string {

    if (!userId) {
      return '';
    }


    const normalizedId =
      String(userId)
        .trim()
        .toLowerCase();


    if (!normalizedId) {
      return '';
    }


    const user =
      this.users.find(
        (item: User) => {

          if (!item?.id) {
            return false;
          }


          return (
            String(item.id)
              .trim()
              .toLowerCase() ===
            normalizedId
          );

        }
      );


    if (user) {

      const candidate =
        user as User & {
          name?: string;
          fullName?: string;
          userName?: string;
          username?: string;
          displayName?: string;
          firstName?: string;
          lastName?: string;
        };


      const fullName =
        [
          candidate.firstName,
          candidate.lastName
        ]
          .filter(
            (value: string | undefined) =>
              !!value?.trim()
          )
          .join(' ')
          .trim();


      if (fullName) {
        return fullName;
      }


      const name =
        candidate.name?.trim();

      if (name) {
        return name;
      }


      const displayName =
        candidate.displayName?.trim();

      if (displayName) {
        return displayName;
      }


      const fullNameProperty =
        candidate.fullName?.trim();

      if (fullNameProperty) {
        return fullNameProperty;
      }


      const userName =
        candidate.userName?.trim();

      if (userName) {
        return userName;
      }


      const username =
        candidate.username?.trim();

      if (username) {
        return username;
      }

    }


    const searchUser =
      this.searchResults.find(
        (item: UserSearchResult) => {

          if (!item?.id) {
            return false;
          }


          return (
            String(item.id)
              .trim()
              .toLowerCase() ===
            normalizedId
          );

        }
      );


    if (searchUser) {

      const candidate =
        searchUser as UserSearchResult & {
          name?: string;
          fullName?: string;
          displayName?: string;
          userName?: string;
          username?: string;
        };


      const name =
        candidate.name?.trim();

      if (name) {
        return name;
      }


      const displayName =
        candidate.displayName?.trim();

      if (displayName) {
        return displayName;
      }


      const fullName =
        candidate.fullName?.trim();

      if (fullName) {
        return fullName;
      }


      const userName =
        candidate.userName?.trim();

      if (userName) {
        return userName;
      }


      const username =
        candidate.username?.trim();

      if (username) {
        return username;
      }

    }


    return '';

  }


  // =========================================================
  // GET CURRENT USER NAME
  // =========================================================

  private getCurrentUserName(): string {

    const resolvedName =
      this.resolveUserName(
        this.currentUserId
      );


    if (resolvedName) {
      return resolvedName;
    }


    const storedName =
      localStorage.getItem('userName') ||
      localStorage.getItem('username') ||
      localStorage.getItem('displayName') ||
      localStorage.getItem('name');


    if (storedName?.trim()) {

      return storedName.trim();

    }


    return 'User';

  }


  // =========================================================
  // AFTER VIEW CHECKED
  // =========================================================

  ngAfterViewChecked(): void {

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


    if (this.isLoadingOlderMessages) {
      return;
    }


    if (this.restoringScrollPosition) {
      return;
    }


    if (Date.now() < this.ignoreScrollUntil) {
      return;
    }


    if (!this.hasMoreMessages) {
      return;
    }


    const element =
      event.target as HTMLElement | null;


    if (!element) {
      return;
    }


    if (
      element.scrollTop <=
      this.scrollThreshold
    ) {

      void this.loadNextMessagePage();

    }

  }


  // =========================================================
  // LOAD NEXT MESSAGE PAGE
  // =========================================================

  private async loadNextMessagePage(): Promise<void> {

    const targetUserId =
      this.activeTargetUserId;


    if (!targetUserId) {
      return;
    }


    if (this.isLoadingOlderMessages) {
      return;
    }


    if (!this.hasMoreMessages) {
      return;
    }


    const element =
      this.scrollContainer?.nativeElement;


    if (!element) {
      return;
    }


    const nextPage =
      this.messagePageNumber + 1;


    if (
      this.requestedPages.has(nextPage)
    ) {

      return;

    }


    this.isLoadingOlderMessages =
      true;

    this.restoringScrollPosition =
      true;

    this.loadingPageNumber =
      nextPage;


    this.requestedPages.add(
      nextPage
    );


    const oldScrollHeight =
      element.scrollHeight;

    const oldScrollTop =
      element.scrollTop;

    const oldFirstVisibleMessage =
      this.getFirstVisibleMessageKey(
        element
      );


    try {

      const response =
        await this.loadConversationPage(
          targetUserId,
          nextPage,
          this.messagePageSize
        );


      if (this.isDestroyed) {
        return;
      }


      if (response) {

        this.updatePaginationFromResponse(
          response,
          nextPage
        );

      } else {

        this.messagePageNumber =
          nextPage;

        this.hasMoreMessages =
          true;

      }


      await this.waitForViewUpdate();


      if (this.isDestroyed) {
        return;
      }


      const newContainer =
        this.scrollContainer?.nativeElement;


      if (!newContainer) {
        return;
      }


      const newScrollHeight =
        newContainer.scrollHeight;

      const heightDifference =
        newScrollHeight -
        oldScrollHeight;


      newContainer.scrollTop =
        oldScrollTop +
        heightDifference;


      await this.waitForViewUpdate();


      if (this.isDestroyed) {
        return;
      }


      this.restoreScrollByMessage(
        oldFirstVisibleMessage
      );


      requestAnimationFrame(() => {

        if (this.isDestroyed) {
          return;
        }


        const container =
          this.scrollContainer?.nativeElement;


        if (!container) {
          return;
        }


        const currentHeight =
          container.scrollHeight;


        if (
          currentHeight > 0 &&
          oldScrollTop > 0 &&
          container.scrollTop <
          this.scrollThreshold
        ) {

          container.scrollTop =
            Math.min(
              oldScrollTop +
              heightDifference,
              container.scrollHeight -
              container.clientHeight
            );

        }

      });

    } catch (error: unknown) {

      this.requestedPages.delete(
        nextPage
      );


      console.error(
        `Failed to load message page ${nextPage}:`,
        error
      );

    } finally {

      this.loadingPageNumber =
        null;


      setTimeout(() => {

        if (this.isDestroyed) {
          return;
        }


        this.restoringScrollPosition =
          false;

        this.isLoadingOlderMessages =
          false;

      }, 50);

    }

  }


  // =========================================================
  // UPDATE PAGINATION
  // =========================================================

  private updatePaginationFromResponse(
    response: MessageHistoryResponse,
    requestedPage: number
  ): void {

    this.messagePageNumber =
      typeof response.pageNumber === 'number'
        ? response.pageNumber
        : requestedPage;


    if (
      typeof response.hasNextPage ===
      'boolean'
    ) {

      this.hasMoreMessages =
        response.hasNextPage;

      return;

    }


    if (
      typeof response.totalPages ===
      'number'
    ) {

      this.hasMoreMessages =
        this.messagePageNumber <
        response.totalPages;

      return;

    }


    if (
      typeof response.totalCount === 'number' &&
      typeof response.pageSize === 'number' &&
      response.pageSize > 0
    ) {

      const totalPages =
        Math.ceil(
          response.totalCount /
          response.pageSize
        );


      this.hasMoreMessages =
        this.messagePageNumber <
        totalPages;

      return;

    }


    if (
      Array.isArray(response.items)
    ) {

      this.hasMoreMessages =
        response.items.length >=
        this.messagePageSize;

      return;

    }


    this.hasMoreMessages =
      true;

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


    if (
      result &&
      typeof (
        result as {
          subscribe?: unknown;
        }
      ).subscribe === 'function'
    ) {

      return new Promise<MessageHistoryResponse | null>(
        (resolve, reject) => {

          let resolved = false;


          const observable =
            result as {
              subscribe: (
                handlers: {
                  next?: (
                    value: unknown
                  ) => void;

                  error?: (
                    error: unknown
                  ) => void;
                }
              ) => unknown;
            };


          observable.subscribe({

            next: (value: unknown) => {

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


            error: (error: unknown) => {

              if (resolved) {
                return;
              }


              resolved = true;

              reject(error);

            }

          });

        }
      );

    }


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


    if (
      result &&
      typeof result === 'object'
    ) {

      return result as MessageHistoryResponse;

    }


    return null;

  }


  // =========================================================
  // INITIAL PAGE
  // =========================================================

  private async loadInitialMessagePage(
    targetUserId: string
  ): Promise<void> {

    try {

      this.requestedPages.add(1);


      const response =
        await this.loadConversationPage(
          targetUserId,
          1,
          this.messagePageSize
        );


      if (this.isDestroyed) {
        return;
      }


      if (!response) {

        this.messagePageNumber =
          1;

        this.hasMoreMessages =
          true;

      } else {

        this.updatePaginationFromResponse(
          response,
          1
        );

      }


      this.initialScrollPending =
        true;


      await this.waitForViewUpdate();


      if (!this.isDestroyed) {

        this.forceScrollToBottom();

      }

    } catch (error: unknown) {

      console.error(
        'Failed to load initial messages:',
        error
      );


      this.hasMoreMessages =
        false;

    }

  }


  // =========================================================
  // WAIT FOR VIEW
  // =========================================================

  private waitForViewUpdate(): Promise<void> {

    return new Promise<void>(
      (resolve) => {

        setTimeout(() => {

          if (
            typeof requestAnimationFrame ===
            'function'
          ) {

            requestAnimationFrame(() => {

              resolve();

            });

          } else {

            resolve();

          }

        }, 0);

      }
    );

  }


  // =========================================================
  // RESET PAGINATION
  // =========================================================

  private resetMessagePagination(): void {

    this.messagePageNumber =
      1;

    this.hasMoreMessages =
      true;

    this.isLoadingOlderMessages =
      false;

    this.restoringScrollPosition =
      false;

    this.initialScrollPending =
      false;

    this.loadingPageNumber =
      null;

    this.requestedPages.clear();

    this.ignoreScrollUntil =
      Date.now() + 1000;

  }


  // =========================================================
  // IS NEAR BOTTOM
  // =========================================================

  private isNearBottom(): boolean {

    const element =
      this.scrollContainer?.nativeElement;


    if (!element) {
      return true;
    }


    const distanceFromBottom =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;


    return distanceFromBottom <= 120;

  }


  // =========================================================
  // GET FIRST VISIBLE MESSAGE
  // =========================================================

  private getFirstVisibleMessageKey(
    container: HTMLElement
  ): string | null {

    const messageElements =
      container.querySelectorAll(
        '[data-message-id]'
      );


    for (
      const element of Array.from(
        messageElements
      )
    ) {

      const htmlElement =
        element as HTMLElement;


      const top =
        htmlElement.offsetTop;


      if (
        top >=
        container.scrollTop - 5
      ) {

        return (
          htmlElement.dataset[
            'messageId'
          ] || null
        );

      }

    }


    return null;

  }


  // =========================================================
  // RESTORE SCROLL
  // =========================================================

  private restoreScrollByMessage(
    messageId: string | null
  ): void {

    if (!messageId) {
      return;
    }


    const container =
      this.scrollContainer?.nativeElement;


    if (!container) {
      return;
    }


    const messageElement =
      container.querySelector(
        `[data-message-id="${CSS.escape(messageId)}"]`
      ) as HTMLElement | null;


    if (!messageElement) {
      return;
    }


    const containerRect =
      container.getBoundingClientRect();

    const messageRect =
      messageElement.getBoundingClientRect();


    const difference =
      messageRect.top -
      containerRect.top;


    container.scrollTop +=
      difference;

  }


  // =========================================================
  // MESSAGE STATUS SUBSCRIPTION
  // =========================================================

  private subscribeToMessageStatusChanged(): void {

    this.subscriptions.add(

      this.chatSignalRService.messageStatus$
        .subscribe(
          (event: MessageStatusChanged) => {

            if (
              event.messageId === null ||
              event.messageId === undefined ||
              String(event.messageId).trim() === ''
            ) {

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
    status: RawMessageStatus
  ): MessageStatus | null {

    if (
      status === null ||
      status === undefined
    ) {

      return null;

    }


    if (typeof status === 'number') {

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
      status.trim().toLowerCase();


    switch (normalized) {

      case '0':
      case 'sent':
      case 'send':
      case 'sending':
        return 'sent';

      case '1':
      case 'delivered':
      case 'delivery':
        return 'delivered';

      case '2':
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

  private getActiveMessages(): MessageWithStatus[] {

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


    if (Array.isArray(service.activeMessages)) {

      return service.activeMessages as MessageWithStatus[];

    }


    if (Array.isArray(service.messages)) {

      return service.messages as MessageWithStatus[];

    }


    return [];

  }


  // =========================================================
  // UPDATE STATUS
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
        (item: MessageWithStatus) =>
          this.getMessageId(item) ===
          messageId
      );


    if (!message) {
      return;
    }


    const currentStatus =
      this.getMessageStatus(message);


    if (currentStatus === 'read') {
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


    if (status === 'read') {

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
  // REFRESH MESSAGES
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
  // MESSAGE ID
  // =========================================================

  private getMessageId(
    message: MessageWithStatus
  ): string | null {

    if (
      message.id === null ||
      message.id === undefined
    ) {

      return null;

    }


    const id =
      String(message.id).trim();


    return id || null;

  }


  // =========================================================
  // MESSAGE STATUS
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


    const status =
      this.normalizeMessageStatus(
        message.status
      );


    if (status === 'read') {
      return 'read';
    }


    if (
      message.isDelivered === true ||
      !!message.deliveredAt ||
      !!message.deliveredAtUtc ||
      status === 'delivered'
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

    return this.getMessageStatus(message) ===
      'sent'
      ? '✓'
      : '✓✓';

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
  // OWN MESSAGE
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
  // ACTIVE CONVERSATION
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
      String(
        this.activeTargetUserId
      ).toLowerCase();

    const currentId =
      String(
        this.currentUserId
      ).toLowerCase();


    return (

      (
        String(senderId).toLowerCase() ===
        targetId &&

        String(receiverId).toLowerCase() ===
        currentId
      )

      ||

      (
        String(senderId).toLowerCase() ===
        currentId &&

        String(receiverId).toLowerCase() ===
        targetId
      )

    );

  }


  // =========================================================
  // MARK DELIVERED
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
        (message: MessageWithStatus) =>
          this.isMessageForCurrentUser(message) &&
          this.getMessageStatus(message) ===
          'sent'
      );


    for (
      const message of incomingMessages
    ) {

      if (this.isDestroyed) {
        return;
      }


      await this.markMessageDelivered(
        message
      );

    }

  }


  // =========================================================
  // MARK READ
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
      this.getMessageStatus(message) ===
      'read'
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
        (message: MessageWithStatus) =>
          this.isMessageForCurrentUser(message) &&
          this.belongsToActiveConversation(message) &&
          this.getMessageStatus(message) !==
          'read'
      );


    for (
      const message of unreadMessages
    ) {

      if (this.isDestroyed) {
        return;
      }


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

                this.users = [];

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
        (item: User) =>
          String(item.id) ===
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
        (item: User) =>
          String(item.id) ===
          String(userId)
      );


    if (!user) {
      return;
    }


    user.isOnLine =
      false;


    if (lastSeen) {

      user.lastSeen =
        lastSeen;

    }

  }


  // =========================================================
  // USER ONLINE CHECK
  // =========================================================

  public isUserOnline(
    userId: string | null | undefined
  ): boolean {

    if (!userId) {
      return false;
    }


    return this.signalRService
      .isUserOnline(userId);

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
  // MEDIA ATTACH SCHEDULE
  // =========================================================

  private scheduleMediaAttach(): void {

    if (this.isDestroyed) {
      return;
    }


    setTimeout(() => {

      if (!this.isDestroyed) {

        this.attachMedia();

      }

    }, 0);

  }


  // =========================================================
  // ATTACH MEDIA
  // =========================================================

  private attachMedia(): void {

    if (this.isDestroyed) {
      return;
    }


    const callType =
      this.activeCallType ||
      this.callType;


    if (!callType) {
      return;
    }


    // =======================================================
    // VOICE CALL
    // =======================================================

    if (callType === 'voice') {

      this.clearVideoElements();


      if (this.localVideo?.nativeElement) {

        const localVideo =
          this.localVideo.nativeElement;


        localVideo.pause();

        localVideo.srcObject =
          null;

      }


      if (this.remoteVideo?.nativeElement) {

        const remoteVideo =
          this.remoteVideo.nativeElement;


        remoteVideo.pause();

        remoteVideo.srcObject =
          null;

      }


      if (
        this.remoteAudio?.nativeElement &&
        this.remoteStream
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

        audio.muted =
          false;

        audio.volume =
          1;


        void audio.play()
          .catch(
            (error: unknown) => {

              console.warn(
                '[ChatWindow] Remote voice audio play blocked:',
                error
              );

            }
          );

      }


      return;

    }


    // =======================================================
    // VIDEO CALL
    // =======================================================

    if (callType === 'video') {

      if (this.remoteAudio?.nativeElement) {

        const audio =
          this.remoteAudio.nativeElement;


        audio.pause();

        audio.srcObject =
          null;

      }


      if (
        this.localVideo?.nativeElement &&
        this.localStream
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


          void video.play()
            .catch(() => {});

        }

      }


      if (
        this.remoteVideo?.nativeElement &&
        this.remoteStream
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


          void video.play()
            .catch(
              (error: unknown) => {

                console.warn(
                  '[ChatWindow] Remote video play failed:',
                  error
                );

              }
            );

        }

      }


      return;

    }


    console.warn(
      '[ChatWindow] Unknown call type:',
      callType
    );

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


    const targetUserId =
      this.activeTargetUserId;


    const targetName =
      this.activeTargetName ||
      this.resolveUserName(targetUserId) ||
      'User';


    const callType: CallType =
      'video';


    this.outgoingCallTargetUserId =
      targetUserId;


    this.outgoingCallName =
      targetName;


    this.showOutgoingCallScreen =
      true;

    this.isOutgoingCall =
      true;

    this.outgoingCallPending =
      true;

    this.isStartingCall =
      true;


    this.activeCallType =
      callType;

    this.callType =
      callType;


    this.incomingCallType =
      null;


    this.callerCallStatus =
      `Calling ${this.outgoingCallName}...`;

    this.callStatus =
      `Calling ${this.outgoingCallName}...`;


    this.isMicrophoneMuted =
      false;

    this.isCameraOff =
      false;


    this.startCallingDuration();


    await this.waitForViewUpdate();


    try {

      await this.callService.startCall(
        targetUserId,
        callType
      );


      if (
        this.outgoingCallPending &&
        this.showOutgoingCallScreen
      ) {

        this.callerCallStatus =
          `Ringing ${this.outgoingCallName}...`;

        this.callStatus =
          `Ringing ${this.outgoingCallName}...`;

      }


      this.scheduleMediaAttach();

    } catch (error: unknown) {

      console.error(
        'Video call failed:',
        error
      );


      this.stopCallingDuration();


      this.closeOutgoingCallScreen();


      this.stopMedia();


      this.activeCallType =
        null;

      this.callType =
        null;


      this.callerCallStatus =
        '';

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


    const targetUserId =
      this.activeTargetUserId;


    const targetName =
      this.activeTargetName ||
      this.resolveUserName(targetUserId) ||
      'User';


    const callType: CallType =
      'voice';


    this.outgoingCallTargetUserId =
      targetUserId;


    this.outgoingCallName =
      targetName;


    this.showOutgoingCallScreen =
      true;

    this.isOutgoingCall =
      true;

    this.outgoingCallPending =
      true;

    this.isStartingCall =
      true;


    this.activeCallType =
      callType;

    this.callType =
      callType;


    this.incomingCallType =
      null;


    this.callerCallStatus =
      `Calling ${this.outgoingCallName}...`;

    this.callStatus =
      `Calling ${this.outgoingCallName}...`;


    this.isMicrophoneMuted =
      false;

    this.isCameraOff =
      true;


    this.clearVideoElements();


    if (this.remoteAudio?.nativeElement) {

      const audio =
        this.remoteAudio.nativeElement;


      audio.pause();

      audio.srcObject =
        null;

    }


    this.startCallingDuration();


    await this.waitForViewUpdate();


    try {

      await this.callService.startCall(
        targetUserId,
        callType
      );


      if (
        this.outgoingCallPending &&
        this.showOutgoingCallScreen
      ) {

        this.callerCallStatus =
          `Ringing ${this.outgoingCallName}...`;

        this.callStatus =
          `Ringing ${this.outgoingCallName}...`;

      }


      this.scheduleMediaAttach();

    } catch (error: unknown) {

      console.error(
        'Voice call failed:',
        error
      );


      this.stopCallingDuration();


      this.closeOutgoingCallScreen();


      this.stopMedia();


      this.activeCallType =
        null;

      this.callType =
        null;


      this.callerCallStatus =
        '';

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


    const acceptedCallType =
      this.incomingCallType;


    if (!acceptedCallType) {

      console.error(
        '[ChatWindow] Cannot accept call: incoming call type is missing.'
      );


      this.callStatus =
        'Unable to determine call type. Please try again.';

      return;

    }


    console.log(
      '[ChatWindow] Accepting incoming call:',
      {
        callerId,
        callType:
          acceptedCallType
      }
    );


    this.activeTargetUserId =
      callerId;


    const callerName =
      this.incomingCallName.trim();


    if (
      callerName &&
      callerName !== 'Caller'
    ) {

      this.activeTargetName =
        callerName;

    } else {

      const resolvedName =
        this.resolveUserName(callerId);


      this.activeTargetName =
        resolvedName ||
        'Caller';

    }


    this.activeCallType =
      acceptedCallType;

    this.callType =
      acceptedCallType;


    if (
      acceptedCallType ===
      'voice'
    ) {

      this.isCameraOff =
        true;


      this.clearVideoElements();


      if (this.remoteAudio?.nativeElement) {

        const audio =
          this.remoteAudio.nativeElement;


        audio.pause();

        audio.srcObject =
          null;

      }

    }

    else {

      this.isCameraOff =
        false;

    }


    try {

      this.callStatus =
        acceptedCallType === 'voice'
          ? `Connecting voice call with ${this.activeTargetName}...`
          : `Connecting video call with ${this.activeTargetName}...`;


      await this.callService
        .acceptCall(callerId);


      this.incomingCallUserId =
        null;

      this.incomingCallName =
        '';


      this.scheduleMediaAttach();

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
  // REJECT CALL
  // =========================================================

  public async rejectIncomingCall(): Promise<void> {

    if (!this.incomingCallUserId) {
      return;
    }


    const callerId =
      this.incomingCallUserId;


    try {

      await this.callService
        .rejectCall(callerId);

    } catch (error: unknown) {

      console.error(
        'Reject call failed:',
        error
      );

    }


    this.stopCallingDuration();


    this.incomingCallUserId =
      null;

    this.incomingCallName =
      '';

    this.incomingCallType =
      null;

    this.activeCallType =
      null;

    this.callType =
      null;


    this.showOutgoingCallScreen =
      false;

    this.isOutgoingCall =
      false;

    this.outgoingCallPending =
      false;

    this.outgoingCallTargetUserId =
      null;


    this.stopMedia();


    this.callStatus =
      '';

  }


  // =========================================================
  // MICROPHONE
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
  // CAMERA
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

    this.stopCallingDuration();


    this.closeOutgoingCallScreen();


    try {

      await this.callService.endCall();

    } catch (error: unknown) {

      console.error(
        'End call failed:',
        error
      );

    } finally {

      this.stopMedia();


      this.resetCallState();


      this.outgoingCallName =
        '';

      this.callerCallStatus =
        '';

      this.callStatus =
        '';

    }

  }


  // =========================================================
  // CLEAR VIDEO ELEMENTS
  // =========================================================

  private clearVideoElements(): void {

    if (this.localVideo?.nativeElement) {

      const video =
        this.localVideo.nativeElement;


      video.pause();

      video.srcObject =
        null;

    }


    if (this.remoteVideo?.nativeElement) {

      const video =
        this.remoteVideo.nativeElement;


      video.pause();

      video.srcObject =
        null;

    }


    this.lastLocalStream =
      null;

    this.lastRemoteStream =
      null;

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


    this.clearVideoElements();


    if (this.remoteAudio?.nativeElement) {

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
  // NEW CHAT MODAL
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


    this.openConversation(
      targetUserId,
      targetName
    );

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


    this.openConversation(
      targetUserId,
      targetName
    );

  }


  // =========================================================
  // SELECT USER
  // =========================================================

  public selectUserAndStartChat(
    user: UserSearchResult
  ): void {

    if (!user?.id) {
      return;
    }


    this.closeNewChatModal();


    this.openConversation(
      user.id,
      user.name || 'User'
    );

  }


  // =========================================================
  // OPEN CONVERSATION
  // =========================================================

  private openConversation(
    targetUserId: string,
    targetName?: string
  ): void {

    if (!targetUserId) {
      return;
    }


    const sameConversation =
      this.activeTargetUserId ===
      targetUserId;


    this.activeTargetUserId =
      targetUserId;


    if (targetName) {

      this.activeTargetName =
        targetName;

    } else {

      const resolvedName =
        this.resolveUserName(
          targetUserId
        );


      if (resolvedName) {

        this.activeTargetName =
          resolvedName;

      }

    }


    if (sameConversation) {
      return;
    }


    this.resetMessagePagination();


    this.initialScrollPending =
      true;


    void this.loadInitialMessagePage(
      targetUserId
    );


    this.forceScrollToBottom();


    setTimeout(() => {

      if (!this.isDestroyed) {

        this.forceScrollToBottom();

      }

    }, 50);


    setTimeout(() => {

      if (!this.isDestroyed) {

        this.forceScrollToBottom();

      }

    }, 150);


    setTimeout(() => {

      if (!this.isDestroyed) {

        this.forceScrollToBottom();

      }

    }, 400);


    setTimeout(() => {

      if (!this.isDestroyed) {

        void this.markActiveConversationAsRead();

      }

    }, 300);

  }


  // =========================================================
  // INITIAL BOTTOM SCROLL
  // =========================================================

  private scheduleInitialBottomScroll(): void {

    if (this.isDestroyed) {
      return;
    }


    this.initialScrollPending =
      true;


    setTimeout(() => {

      if (this.isDestroyed) {
        return;
      }


      this.forceScrollToBottom();


      requestAnimationFrame(() => {

        if (!this.isDestroyed) {

          this.forceScrollToBottom();

        }

      });

    }, 0);

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


      requestAnimationFrame(() => {

        if (!this.isDestroyed) {

          this.forceScrollToBottom();

        }


        this.bottomScrollScheduled =
          false;

      });

    }, 0);

  }


  // =========================================================
  // FORCE BOTTOM SCROLL
  // =========================================================

  private forceScrollToBottom(): void {

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


    this.ignoreScrollUntil =
      Math.max(
        this.ignoreScrollUntil,
        Date.now() + 250
      );

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


    this.stopCallingDuration();


    this.stopMedia();


    this.subscriptions.unsubscribe();

  }

}
