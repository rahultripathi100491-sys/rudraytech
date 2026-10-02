import {
  DestroyRef,
  Injectable,
  NgZone,
  inject
} from '@angular/core';

import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import {
  BehaviorSubject,
  Observable,
  finalize,
  map
} from 'rxjs';

import {
  takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import {
  SignalRService
} from './signalr.service';

import {
  ChatMessage,
  Conversation,
  MessageNotification
} from '../models/chat-message';

import {
  BASE_URL
} from '../app.config';


// =============================================================
// PAGINATION RESPONSE
// =============================================================

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}


// =============================================================
// USER SEARCH RESULT
// =============================================================

export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
}


// =============================================================
// CHAT SERVICE
// =============================================================

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private readonly http = inject(HttpClient);
  private readonly signalRService = inject(SignalRService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private readonly apiUrl =
    `${BASE_URL}/messages`;


  // ===========================================================
  // ACTIVE CHAT MESSAGES
  // ===========================================================

  private readonly activeMessagesSubject =
    new BehaviorSubject<ChatMessage[]>([]);

  public readonly activeMessages$ =
    this.activeMessagesSubject.asObservable();


  // ===========================================================
  // CURRENTLY OPEN CHAT
  // ===========================================================

  private activeTargetUserId:
    string | null = null;

  private cachedConversations:
    Conversation[] = [];


  // ===========================================================
  // PAGINATION
  // ===========================================================

  private currentPage = 1;

  private pageSize = 10;

  private totalPages = 0;

  private totalMessages = 0;

  private isLoadingMessages = false;


  // ===========================================================
  // REQUEST / CONVERSATION GENERATION
  //
  // This prevents an old HTTP response from a previous chat
  // being inserted into the newly opened chat.
  // ===========================================================

  private conversationGeneration = 0;


  // ===========================================================
  // UNREAD MESSAGE COUNTS
  // ===========================================================

  private readonly unreadMessagesSubject =
    new BehaviorSubject<Record<string, number>>({});

  public readonly unreadMessages$ =
    this.unreadMessagesSubject.asObservable();


  // ===========================================================
  // NOTIFICATIONS
  // ===========================================================

  private readonly notificationsSubject =
    new BehaviorSubject<MessageNotification[]>([]);

  public readonly notifications$ =
    this.notificationsSubject.asObservable();

  public readonly notificationCount$ =
    this.notifications$.pipe(
      map(notifications => notifications.length)
    );


  // ===========================================================
  // CONSTRUCTOR
  // ===========================================================

  constructor() {

    const token =
      localStorage.getItem('token');

    if (token) {

      void this.signalRService
        .startConnection(token);

    }

    this.listenForIncomingMessages();

    this.refreshConversationsCache();

  }


  // ===========================================================
  // REFRESH CONVERSATION CACHE
  // ===========================================================

  public refreshConversationsCache(): void {

    this.getConversations()
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({

        next: conversations => {

          this.cachedConversations =
            conversations ?? [];

        },

        error: error => {

          console.error(
            'Failed to refresh conversation cache:',
            error
          );

        }

      });

  }


  // ===========================================================
  // ADD MESSAGE NOTIFICATION
  // ===========================================================

  public addMessageNotification(
    senderUserId: string,
    senderUserName: string,
    message: string
  ): void {

    const current =
      this.notificationsSubject.getValue();

    const resolvedName =
      this.resolveSenderName(
        senderUserId,
        senderUserName
      );

    const notification:
      MessageNotification = {

      id:
        this.generateId(),

      senderUserId,

      senderUserName:
        resolvedName,

      message,

      receivedAt:
        new Date().toISOString()

    };

    this.notificationsSubject.next([
      notification,
      ...current
    ]);

  }


  // ===========================================================
  // RESOLVE USER NAME
  // ===========================================================

  private resolveSenderName(
    senderUserId: string,
    senderUserName?: string
  ): string {

    const suppliedName =
      senderUserName?.trim();

    if (suppliedName) {
      return suppliedName;
    }

    const normalizedSenderId =
      this.normalizeId(senderUserId);

    const conversation =
      this.cachedConversations.find(
        item =>
          this.normalizeId(
            item.participantUserId
          ) === normalizedSenderId
      );

    return (
      conversation?.participantName ||
      'User'
    );

  }


  // ===========================================================
  // LISTEN FOR SIGNALR MESSAGES
  // ===========================================================

  private listenForIncomingMessages(): void {

    this.signalRService
      .messageReceived$
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({

        next: incomingMessage => {

          this.ngZone.run(() => {

            this.receiveLiveMessage(
              incomingMessage
            );

          });

        },

        error: error => {

          console.error(
            'SignalR message stream error:',
            error
          );

        }

      });

  }


  // ===========================================================
  // GET CONVERSATIONS
  // ===========================================================

  public getConversations():
    Observable<Conversation[]> {

    return this.http.get<Conversation[]>(
      `${this.apiUrl}/conversation`
    );

  }


  // ===========================================================
  // GET PAGINATED MESSAGE HISTORY
  // ===========================================================

  public getMessageHistory(
    targetUserId: string,
    pageNumber: number = 1,
    pageSize: number = 10,
    search: string = '',
    sortBy: string = '',
    sortDescending: boolean = true,
    filters: Record<string, string> = {}
  ): Observable<PaginatedResult<ChatMessage>> {

    const params =
      new HttpParams()
        .set(
          'targetUserId',
          targetUserId
        );

    const body = {

      pageNumber,

      pageSize,

      search: search?.trim() || '',

      sortBy: sortBy || '',

      sortDescending,

      filters: filters ?? {}

    };

    return this.http.post<
      PaginatedResult<ChatMessage>
    >(
      `${this.apiUrl}/history`,
      body,
      { params }
    );

  }


  // ===========================================================
  // LOAD CONVERSATION HISTORY
  //
  // PAGE 1 = NEWEST
  // PAGE 2 = OLDER
  // PAGE 3 = OLDER
  // ===========================================================

  public loadConversationHistory(
    targetUserId: string,
    pageNumber: number = 1,
    pageSize: number = 10
  ): void {

    if (!targetUserId) {
      return;
    }

    const normalizedTarget =
      this.normalizeId(targetUserId);


    // ---------------------------------------------------------
    // NEW CONVERSATION
    // ---------------------------------------------------------

    const isNewConversation =
      this.normalizeId(
        this.activeTargetUserId
      ) !== normalizedTarget;


    if (isNewConversation) {

      this.conversationGeneration++;

      this.activeTargetUserId =
        targetUserId;

      this.currentPage =
        1;

      this.pageSize =
        pageSize;

      this.totalPages =
        0;

      this.totalMessages =
        0;

      this.isLoadingMessages =
        false;

      this.clearUnreadMessages(
        targetUserId
      );

      this.activeMessagesSubject.next([]);

    }


    // ---------------------------------------------------------
    // EXPLICIT PAGE 1
    // ---------------------------------------------------------

    if (pageNumber === 1) {

      this.currentPage =
        1;

      this.pageSize =
        pageSize;

      this.totalPages =
        0;

      this.totalMessages =
        0;

      this.clearUnreadMessages(
        targetUserId
      );

      this.activeMessagesSubject.next([]);

    }


    // ---------------------------------------------------------
    // LOAD PAGE
    // ---------------------------------------------------------

    this.loadMessagesPage(
      targetUserId,
      pageNumber,
      pageSize
    );

  }


  // ===========================================================
  // LOAD NEXT OLDER PAGE
  // ===========================================================

  public loadNextPage(): void {

    if (!this.activeTargetUserId) {
      return;
    }

    if (this.isLoadingMessages) {
      return;
    }

    if (!this.hasNextPage()) {
      return;
    }

    const nextPage =
      this.currentPage + 1;

    this.loadMessagesPage(
      this.activeTargetUserId,
      nextPage,
      this.pageSize
    );

  }


  // ===========================================================
  // ALIAS
  // ===========================================================

  public loadOlderMessages(): void {

    this.loadNextPage();

  }


  // ===========================================================
  // LOAD PREVIOUS PAGE
  // ===========================================================

  public loadPreviousPage(): void {

    if (!this.activeTargetUserId) {
      return;
    }

    if (this.isLoadingMessages) {
      return;
    }

    if (this.currentPage <= 1) {
      return;
    }

    const previousPage =
      this.currentPage - 1;

    this.loadMessagesPage(
      this.activeTargetUserId,
      previousPage,
      this.pageSize
    );

  }


  // ===========================================================
  // INTERNAL PAGINATED LOAD
  // ===========================================================

  private loadMessagesPage(
    targetUserId: string,
    pageNumber: number,
    pageSize: number
  ): void {

    if (!targetUserId) {
      return;
    }

    if (this.isLoadingMessages) {
      return;
    }


    // ---------------------------------------------------------
    // Don't request a page beyond known total.
    // ---------------------------------------------------------

    if (
      this.totalPages > 0 &&
      pageNumber > this.totalPages
    ) {

      return;

    }


    const normalizedTarget =
      this.normalizeId(targetUserId);


    // ---------------------------------------------------------
    // Capture generation.
    //
    // If the user changes conversation while the request is
    // running, the response will be ignored.
    // ---------------------------------------------------------

    const requestGeneration =
      this.conversationGeneration;


    this.isLoadingMessages =
      true;


    this.getMessageHistory(
      targetUserId,
      pageNumber,
      pageSize
    )
    .pipe(

      finalize(() => {

        this.isLoadingMessages =
          false;

      }),

      takeUntilDestroyed(this.destroyRef)

    )
    .subscribe({

      // =======================================================
      // SUCCESS
      // =======================================================

      next: result => {

        // -----------------------------------------------------
        // Ignore stale response.
        // -----------------------------------------------------

        if (
          requestGeneration !==
          this.conversationGeneration
        ) {

          return;

        }


        if (
          this.normalizeId(
            this.activeTargetUserId
          ) !== normalizedTarget
        ) {

          return;

        }


        const messages =
          (result?.items ?? [])
            .map(
              message =>
                this.normalizeMessage(
                  message
                )
            );


        // -----------------------------------------------------
        // UPDATE PAGINATION
        // -----------------------------------------------------

        this.currentPage =
          this.toPositiveNumber(
            result?.pageNumber,
            pageNumber
          );

        this.pageSize =
          this.toPositiveNumber(
            result?.pageSize,
            pageSize
          );

        this.totalPages =
          this.toNonNegativeNumber(
            result?.totalPages,
            0
          );

        this.totalMessages =
          this.toNonNegativeNumber(
            result?.totalCount,
            0
          );


        // =====================================================
        // PAGE 1
        // =====================================================

        if (pageNumber === 1) {

          this.activeMessagesSubject.next(
            this.removeDuplicateMessages(
              messages
            )
          );

          return;

        }


        // =====================================================
        // PAGE > 1
        //
        // Older messages are prepended.
        // =====================================================

        const currentMessages =
          this.activeMessagesSubject
            .getValue() ?? [];


        const mergedMessages =
          this.mergeOlderMessages(
            messages,
            currentMessages
          );


        this.activeMessagesSubject.next(
          mergedMessages
        );


        // -----------------------------------------------------
        // If backend does not provide totalPages:
        //
        // A page smaller than pageSize means this was the last
        // page.
        //
        // An empty page also means no more messages.
        // -----------------------------------------------------

        if (this.totalPages === 0) {

          if (
            messages.length === 0 ||
            messages.length < pageSize
          ) {

            this.totalPages =
              this.currentPage;

          }

        }

      },

      // =======================================================
      // ERROR
      // =======================================================

      error: error => {

        console.error(
          'Failed to load message history:',
          error
        );

      }

    });

  }


  // ===========================================================
  // MERGE OLDER MESSAGES
  // ===========================================================

  private mergeOlderMessages(
    olderMessages: ChatMessage[],
    currentMessages: ChatMessage[]
  ): ChatMessage[] {

    const result =
      [...currentMessages];


    for (const message of olderMessages) {

      if (
        this.messageExists(
          message,
          result
        )
      ) {

        continue;

      }

      result.unshift(message);

    }


    return result;

  }


  // ===========================================================
  // REMOVE DUPLICATES
  // ===========================================================

  private removeDuplicateMessages(
    messages: ChatMessage[]
  ): ChatMessage[] {

    const result: ChatMessage[] = [];

    const seenIds =
      new Set<string>();


    for (const message of messages) {

      if (
        message.id !== undefined &&
        message.id !== null
      ) {

        const id =
          String(message.id);

        if (seenIds.has(id)) {
          continue;
        }

        seenIds.add(id);

      }

      result.push(message);

    }


    return result;

  }


  // ===========================================================
  // MESSAGE EXISTS
  // ===========================================================

  private messageExists(
    message: ChatMessage,
    messages: ChatMessage[]
  ): boolean {

    if (
      message.id !== undefined &&
      message.id !== null
    ) {

      const id =
        String(message.id);

      return messages.some(
        existing =>
          existing.id !== undefined &&
          existing.id !== null &&
          String(existing.id) === id
      );

    }


    // ---------------------------------------------------------
    // Fallback for messages without an ID.
    // ---------------------------------------------------------

    return messages.some(
      existing =>
        this.normalizeId(
          existing.senderUserId
        ) ===
        this.normalizeId(
          message.senderUserId
        ) &&

        this.normalizeId(
          existing.receiverUserId
        ) ===
        this.normalizeId(
          message.receiverUserId
        ) &&

        existing.content ===
        message.content &&

        existing.sentAt ===
        message.sentAt
    );

  }


  // ===========================================================
  // NORMALIZE MESSAGE
  // ===========================================================

  private normalizeMessage(
    message: ChatMessage | unknown
  ): ChatMessage {

    const raw =
      (message ?? {}) as any;


    const normalized = {

      ...raw,

      id:
        raw.id ??
        raw.Id,

      senderUserId:
        raw.senderUserId ??
        raw.SenderUserId ??
        raw.senderId ??
        raw.SenderId,

      receiverUserId:
        raw.receiverUserId ??
        raw.ReceiverUserId ??
        raw.receiverId ??
        raw.ReceiverId,

      content:
        raw.content ??
        raw.Content ??
        raw.message ??
        raw.Message ??
        '',

      sentAt:
        raw.sentAt ??
        raw.SentAt ??
        raw.createdAt ??
        raw.CreatedAt ??
        new Date().toISOString(),

      status:
        this.normalizeMessageStatus(
          raw
        )

    };


    return normalized as ChatMessage;

  }


  // ===========================================================
  // NORMALIZE MESSAGE STATUS
  // ===========================================================

  private normalizeMessageStatus(
    message: any
  ):
    'sending' |
    'sent' |
    'delivered' |
    'read' {

    const status =
      message?.status ??
      message?.Status;


    switch (status) {

      case 0:
      case '0':
      case 'sent':
      case 'Sent':
        return 'sent';


      case 1:
      case '1':
      case 'delivered':
      case 'Delivered':
        return 'delivered';


      case 2:
      case '2':
      case 'read':
      case 'Read':
        return 'read';


      case 'sending':
      case 'Sending':
        return 'sending';


      default:
        return 'sent';

    }

  }


  // ===========================================================
  // PAGINATION GETTERS
  // ===========================================================

  public getCurrentPage(): number {
    return this.currentPage;
  }


  public getPageSize(): number {
    return this.pageSize;
  }


  public getTotalPages(): number {
    return this.totalPages;
  }


  public getTotalMessages(): number {
    return this.totalMessages;
  }


  public hasNextPage(): boolean {

    if (this.isLoadingMessages) {
      return false;
    }

    if (this.totalPages > 0) {

      return (
        this.currentPage <
        this.totalPages
      );

    }

    // ---------------------------------------------------------
    // Metadata unknown.
    //
    // We allow another request. If the backend returns an
    // empty/short page, loadMessagesPage() will stop pagination.
    // ---------------------------------------------------------

    return true;

  }


  public hasPreviousPage(): boolean {

    return (
      !this.isLoadingMessages &&
      this.currentPage > 1
    );

  }


  public getIsLoadingMessages(): boolean {

    return this.isLoadingMessages;

  }


  // ===========================================================
  // SEND MESSAGE
  // ===========================================================

  public async sendMessage(
    receiverUserId: string,
    message: string
  ): Promise<void> {

    const currentUserId =
      localStorage.getItem('userId');


    const trimmedMessage =
      message?.trim();


    if (
      !currentUserId ||
      !receiverUserId ||
      !trimmedMessage
    ) {

      return;

    }


    const normalizedReceiverId =
      this.normalizeId(
        receiverUserId
      );


    // ---------------------------------------------------------
    // Only add optimistic message if this receiver is the
    // currently opened conversation.
    // ---------------------------------------------------------

    const isActiveConversation =
      this.normalizeId(
        this.activeTargetUserId
      ) === normalizedReceiverId;


    const tempId =
      `temp-${this.generateId()}`;


    const optimisticMessage:
      ChatMessage = {

      id:
        tempId,

      senderUserId:
        currentUserId,

      receiverUserId,

      content:
        trimmedMessage,

      sentAt:
        new Date().toISOString(),

      status:
        'sending'

    };


    if (isActiveConversation) {

      const currentMessages =
        this.activeMessagesSubject
          .getValue() ?? [];


      this.activeMessagesSubject.next([
        ...currentMessages,
        optimisticMessage
      ]);

    }


    // ---------------------------------------------------------
    // SEND THROUGH SIGNALR
    // ---------------------------------------------------------

    try {

      await this.signalRService
        .sendMessage(
          receiverUserId,
          trimmedMessage
        );


      // -------------------------------------------------------
      // Mark optimistic message as sent.
      // -------------------------------------------------------

      if (isActiveConversation) {

        const updatedMessages =
          this.activeMessagesSubject
            .getValue()
            .map(
              currentMessage => {

                if (
                  currentMessage.id !==
                  tempId
                ) {

                  return currentMessage;

                }

                return {

                  ...currentMessage,

                  status:
                    'sent'

                };

              }
            );


        this.activeMessagesSubject.next(
          updatedMessages
        );

      }


      this.refreshConversationsCache();

    }

    catch (error) {

      console.error(
        'Failed to send message via SignalR:',
        error
      );


      if (isActiveConversation) {

        const reverted =
          this.activeMessagesSubject
            .getValue()
            .filter(
              currentMessage =>
                currentMessage.id !==
                tempId
            );


        this.activeMessagesSubject.next(
          reverted
        );

      }


      throw error;

    }

  }


  // ===========================================================
  // RECEIVE LIVE MESSAGE
  // ===========================================================

  public receiveLiveMessage(
    incomingMessage: ChatMessage
  ): void {

    const raw =
      incomingMessage as any;


    // ---------------------------------------------------------
    // Support different SignalR property naming conventions.
    // ---------------------------------------------------------

    const senderUserId =
      String(
        raw.senderUserId ??
        raw.SenderUserId ??
        raw.senderId ??
        raw.SenderId ??
        ''
      );


    const receiverUserId =
      String(
        raw.receiverUserId ??
        raw.ReceiverUserId ??
        raw.receiverId ??
        raw.ReceiverId ??
        ''
      );


    const content =
      String(
        raw.content ??
        raw.Content ??
        raw.message ??
        raw.Message ??
        ''
      ).trim();


    const senderUserName =
      String(
        raw.senderUserName ??
        raw.SenderUserName ??
        raw.senderName ??
        raw.SenderName ??
        ''
      );


    const messageId =
      raw.id ??
      raw.Id;


    const currentUserId =
      this.normalizeId(
        localStorage.getItem('userId')
      );


    const activeTargetId =
      this.normalizeId(
        this.activeTargetUserId
      );


    const senderId =
      this.normalizeId(
        senderUserId
      );


    const receiverId =
      this.normalizeId(
        receiverUserId
      );


    // =========================================================
    // VALIDATION
    // =========================================================

    if (
      !senderUserId ||
      !receiverUserId ||
      !content
    ) {

      console.warn(
        'Invalid incoming message:',
        incomingMessage
      );

      return;

    }


    // =========================================================
    // MESSAGE DIRECTION
    // =========================================================

    const isSelf =
      senderId === currentUserId;


    // Incoming from the currently open user.
    const isFromActiveTarget =
      activeTargetId !== '' &&
      senderId === activeTargetId &&
      receiverId === currentUserId;


    // Outgoing message to the currently open user.
    const isToActiveTarget =
      activeTargetId !== '' &&
      isSelf &&
      receiverId === activeTargetId;


    const belongsToActiveChat =
      isFromActiveTarget ||
      isToActiveTarget;


    // =========================================================
    // ACTIVE CHAT
    // =========================================================

    if (belongsToActiveChat) {

      this.addLiveMessageToActiveChat(
        incomingMessage,
        {
          id: messageId,
          senderUserId,
          receiverUserId,
          content,
          senderUserName
        }
      );


      // -------------------------------------------------------
      // Incoming message belongs to currently open chat.
      // Don't create unread notification.
      // -------------------------------------------------------

      if (isFromActiveTarget) {

        this.clearUnreadMessages(
          senderUserId
        );

        return;

      }


      // -------------------------------------------------------
      // It is our own outgoing message.
      // -------------------------------------------------------

      if (isToActiveTarget) {

        return;

      }

    }


    // =========================================================
    // MESSAGE NOT FOR ACTIVE CHAT
    // =========================================================

    if (
      !isSelf &&
      senderUserId
    ) {

      this.incrementUnreadMessages(
        senderUserId
      );


      this.addMessageNotification(
        senderUserId,
        senderUserName,
        content
      );


      this.showBrowserNotification({

        ...incomingMessage,

        id:
          messageId,

        senderUserId,

        receiverUserId,

        content

      });

    }


    this.refreshConversationsCache();

  }


  // ===========================================================
  // ADD LIVE MESSAGE TO ACTIVE CHAT
  // ===========================================================

  private addLiveMessageToActiveChat(
    incomingMessage: ChatMessage,
    normalized: {
      id: unknown;
      senderUserId: string;
      receiverUserId: string;
      content: string;
      senderUserName: string;
    }
  ): void {

    let currentMessages =
      this.activeMessagesSubject
        .getValue() ?? [];


    // ---------------------------------------------------------
    // First try to match the real server message ID.
    // ---------------------------------------------------------

    if (
      normalized.id !== undefined &&
      normalized.id !== null
    ) {

      const exists =
        currentMessages.some(
          message =>
            message.id !== undefined &&
            message.id !== null &&
            String(message.id) ===
              String(normalized.id)
        );


      if (exists) {
        return;
      }

    }


    // ---------------------------------------------------------
    // Remove matching optimistic message.
    //
    // This handles the common case where SignalR returns the
    // real message after the optimistic one was added.
    // ---------------------------------------------------------

    const optimisticIndex =
      currentMessages.findIndex(
        message => {

          const isTemp =
            String(message.id ?? '')
              .startsWith('temp-');


          if (!isTemp) {
            return false;
          }


          return (
            this.normalizeId(
              message.senderUserId
            ) ===
            this.normalizeId(
              normalized.senderUserId
            ) &&

            this.normalizeId(
              message.receiverUserId
            ) ===
            this.normalizeId(
              normalized.receiverUserId
            ) &&

            message.content ===
            normalized.content
          );

        }
      );


    if (optimisticIndex >= 0) {

      currentMessages =
        currentMessages.filter(
          (_, index) =>
            index !== optimisticIndex
        );

    }


    // ---------------------------------------------------------
    // Normalize incoming message.
    // ---------------------------------------------------------

    const normalizedMessage =
      this.normalizeMessage({

        ...incomingMessage,

        id:
          normalized.id,

        senderUserId:
          normalized.senderUserId,

        receiverUserId:
          normalized.receiverUserId,

        content:
          normalized.content,

        senderUserName:
          normalized.senderUserName

      });


    // ---------------------------------------------------------
    // Final duplicate protection.
    // ---------------------------------------------------------

    if (
      this.messageExists(
        normalizedMessage,
        currentMessages
      )
    ) {

      return;

    }


    this.activeMessagesSubject.next([
      ...currentMessages,
      normalizedMessage
    ]);

  }


  // ===========================================================
  // INCREMENT UNREAD
  // ===========================================================

  private incrementUnreadMessages(
    userId: string
  ): void {

    const normalizedId =
      this.normalizeId(userId);


    if (!normalizedId) {
      return;
    }


    const current =
      this.unreadMessagesSubject
        .getValue();


    const currentCount =
      current[normalizedId] ?? 0;


    this.unreadMessagesSubject.next({

      ...current,

      [normalizedId]:
        currentCount + 1

    });

  }


  // ===========================================================
  // CLEAR UNREAD
  // ===========================================================

  public clearUnreadMessages(
    userId: string
  ): void {

    const normalizedId =
      this.normalizeId(userId);


    if (!normalizedId) {
      return;
    }


    const current = {
      ...this.unreadMessagesSubject.value
    };


    if (
      current[normalizedId] ===
      undefined
    ) {

      return;

    }


    delete current[normalizedId];


    this.unreadMessagesSubject.next(
      current
    );

  }


  // ===========================================================
  // GET UNREAD COUNT
  // ===========================================================

  public getUnreadCount(
    userId: string
  ): number {

    const normalizedId =
      this.normalizeId(userId);


    return (
      this.unreadMessagesSubject
        .value[normalizedId] ?? 0
    );

  }


  // ===========================================================
  // GET TOTAL UNREAD
  // ===========================================================

  public getTotalUnreadCount(): number {

    return Object
      .values(
        this.unreadMessagesSubject.value
      )
      .reduce(
        (
          total,
          count
        ) =>
          total + count,
        0
      );

  }


  // ===========================================================
  // REMOVE NOTIFICATION
  // ===========================================================

  public removeNotification(
    id: string
  ): void {

    const current =
      this.notificationsSubject
        .getValue();


    this.notificationsSubject.next(
      current.filter(
        notification =>
          notification.id !== id
      )
    );

  }


  // ===========================================================
  // CLEAR NOTIFICATIONS
  // ===========================================================

  public clearNotifications(): void {

    this.notificationsSubject.next([]);

  }


  // ===========================================================
  // GET NOTIFICATIONS
  // ===========================================================

  public getNotifications():
    MessageNotification[] {

    return [
      ...this.notificationsSubject
        .getValue()
    ];

  }


  // ===========================================================
  // BROWSER NOTIFICATION
  // ===========================================================

  private showBrowserNotification(
    message: ChatMessage
  ): void {

    if (
      typeof Notification ===
      'undefined'
    ) {

      return;

    }


    if (
      Notification.permission !==
      'granted'
    ) {

      return;

    }


    try {

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

    catch (error) {

      console.warn(
        'Unable to show browser notification:',
        error
      );

    }

  }


  // ===========================================================
  // REQUEST NOTIFICATION PERMISSION
  // ===========================================================

  public async requestNotificationPermission():
    Promise<void> {

    if (
      typeof Notification ===
      'undefined'
    ) {

      return;

    }


    if (
      Notification.permission ===
      'default'
    ) {

      try {

        await Notification
          .requestPermission();

      }

      catch (error) {

        console.warn(
          'Notification permission request failed:',
          error
        );

      }

    }

  }


  // ===========================================================
  // CLOSE CHAT
  // ===========================================================

  public closeChat(): void {

    // ---------------------------------------------------------
    // Increment generation so pending HTTP requests become
    // invalid.
    // ---------------------------------------------------------

    this.conversationGeneration++;


    this.activeTargetUserId =
      null;

    this.currentPage =
      1;

    this.pageSize =
      10;

    this.totalPages =
      0;

    this.totalMessages =
      0;

    this.isLoadingMessages =
      false;

    this.activeMessagesSubject.next([]);

  }


  // ===========================================================
  // GET ACTIVE TARGET USER
  // ===========================================================

  public getActiveTargetUserId():
    string | null {

    return this.activeTargetUserId;

  }


  // ===========================================================
  // SEARCH USERS
  // ===========================================================

  public searchUsers(
    query: string
  ): Observable<UserSearchResult[]> {

    const searchQuery =
      query?.trim() || '';


    const params =
      new HttpParams()
        .set(
          'q',
          searchQuery
        );


    return this.http.get<
      UserSearchResult[]
    >(
      `${BASE_URL}/user/SearchUsers/search`,
      { params }
    );

  }


  // ===========================================================
  // HELPERS
  // ===========================================================

  private normalizeId(
    value: unknown
  ): string {

    return String(
      value ?? ''
    )
      .trim()
      .toLowerCase();

  }


  private generateId(): string {

    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {

      return crypto.randomUUID();

    }


    return (
      Date.now().toString(36) +
      Math.random()
        .toString(36)
        .substring(2)
    );

  }


  private toPositiveNumber(
    value: unknown,
    fallback: number
  ): number {

    const number =
      Number(value);


    if (
      Number.isFinite(number) &&
      number > 0
    ) {

      return number;

    }


    return fallback;

  }


  private toNonNegativeNumber(
    value: unknown,
    fallback: number
  ): number {

    const number =
      Number(value);


    if (
      Number.isFinite(number) &&
      number >= 0
    ) {

      return number;

    }


    return fallback;

  }

}
