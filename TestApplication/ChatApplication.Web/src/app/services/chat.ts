import {
  Injectable,
  inject,
  NgZone
} from '@angular/core';

import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import {
  Observable,
  BehaviorSubject,
  map
} from 'rxjs';

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

  private http =
    inject(HttpClient);

  private signalRService =
    inject(SignalRService);

  private ngZone =
    inject(NgZone);


  private readonly apiUrl =
    `${BASE_URL}/messages`;


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

  private activeTargetUserId:
    string | null = null;


  private cachedConversations:
    Conversation[] = [];


  // =========================================================
  // PAGINATION STATE
  // =========================================================

  private currentPage = 1;

  private pageSize = 20;

  private totalPages = 0;

  private totalMessages = 0;

  private isLoadingMessages = false;


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


  public notificationCount$ =
    this.notifications$.pipe(
      map(
        notifications =>
          notifications.length
      )
    );


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor() {

    const token =
      localStorage.getItem('token') || '';


    if (token) {

      void this.signalRService
        .startConnection(token);

    }


    this.listenForIncomingMessages();

    this.refreshConversationsCache();

  }


  // =========================================================
  // REFRESH CONVERSATION CACHE
  // =========================================================

  public refreshConversationsCache(): void {

    this.getConversations()
      .subscribe({

        next: (
          conversations
        ) => {

          this.cachedConversations =
            conversations || [];

        },

        error: (
          error
        ) => {

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

    const current =
      this.notificationsSubject
        .getValue();


    let resolvedName =
      senderUserName?.trim();


    if (!resolvedName) {

      const match =
        this.cachedConversations.find(
          conversation =>
            conversation
              .participantUserId
              ?.toLowerCase() ===
            senderUserId
              ?.toLowerCase()
        );


      resolvedName =
        match?.participantName ||
        'User';

    }


    const notification:
      MessageNotification = {

      id:
        crypto.randomUUID(),

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


  // =========================================================
  // LISTEN FOR SIGNALR MESSAGES
  // =========================================================

  private listenForIncomingMessages(): void {

    this.signalRService
      .messageReceived$
      .subscribe(

        (
          incomingMessage: ChatMessage
        ) => {

          this.ngZone.run(() => {

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
  // GET PAGINATED MESSAGE HISTORY
  // =========================================================

  public getMessageHistory(
    targetUserId: string,
    pageNumber: number = 1,
    pageSize: number = 20,
    search: string = '',
    sortBy: string = '',
    sortDescending: boolean = true,
    filters: Record<string, string> = {}
  ): Observable<PaginatedResult<ChatMessage>> {


    /*
     * IMPORTANT
     *
     * targetUserId is sent as query parameter.
     *
     * Pagination values are sent in POST body.
     */

    const params =
      new HttpParams()
        .set(
          'targetUserId',
          targetUserId
        );


    const body = {

      pageNumber,

      pageSize,

      search,

      sortBy,

      sortDescending,

      filters

    };


    console.log(
      'GET MESSAGE HISTORY REQUEST:',
      {
        targetUserId,
        body
      }
    );


    return this.http.post<
      PaginatedResult<ChatMessage>
    >(
      `${this.apiUrl}/history`,
      body,
      {
        params
      }
    );

  }


  // =========================================================
  // LOAD CONVERSATION HISTORY
  // =========================================================
  //
  // IMPORTANT:
  //
  // SECOND PARAMETER = PAGE NUMBER
  //
  // Example:
  //
  // loadConversationHistory(userId)
  // => page 1, page size 20
  //
  // loadConversationHistory(userId, 2)
  // => page 2, page size 20
  //
  // loadConversationHistory(userId, 3)
  // => page 3, page size 20
  //
  // This fixes the old problem where:
  //
  // loadConversationHistory(userId, 2)
  //
  // was interpreted as:
  //
  // pageNumber = 1
  // pageSize = 2
  //
  // =========================================================

  public loadConversationHistory(
    targetUserId: string,
    pageNumber: number = 1,
    pageSize: number = 20
  ): void {

    if (!targetUserId) {
      return;
    }


    // ---------------------------------------------------------
    // NEW CONVERSATION
    // ---------------------------------------------------------

    if (
      this.activeTargetUserId !==
        targetUserId
    ) {

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

      this.clearUnreadMessages(
        targetUserId
      );

      this.activeMessagesSubject.next([]);

    }


    // ---------------------------------------------------------
    // SAME CONVERSATION - PAGE 1
    // ---------------------------------------------------------

    if (pageNumber === 1) {

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

      this.clearUnreadMessages(
        targetUserId
      );

      this.activeMessagesSubject.next([]);

    }


    // ---------------------------------------------------------
    // LOAD REQUESTED PAGE
    // ---------------------------------------------------------

    this.loadMessagesPage(
      targetUserId,
      pageNumber,
      pageSize
    );

  }


  // =========================================================
  // LOAD NEXT PAGE
  // =========================================================
  //
  // Used when scrolling to TOP.
  //
  // Page 1 = newest messages
  // Page 2 = older messages
  // Page 3 = even older messages
  //
  // Older messages are PREPENDED.
  //
  // =========================================================

  public loadNextPage(): void {

    if (!this.activeTargetUserId) {
      return;
    }


    if (this.isLoadingMessages) {
      return;
    }


    if (
      this.totalPages > 0 &&
      this.currentPage >=
        this.totalPages
    ) {

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


  // =========================================================
  // LOAD PREVIOUS PAGE
  // =========================================================

  public loadPreviousPage(): void {

    if (!this.activeTargetUserId) {
      return;
    }


    if (this.isLoadingMessages) {
      return;
    }


    if (
      this.currentPage <= 1
    ) {

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


  // =========================================================
  // INTERNAL PAGINATED LOAD
  // =========================================================

  private loadMessagesPage(
    targetUserId: string,
    pageNumber: number,
    pageSize: number
  ): void {

    if (this.isLoadingMessages) {
      return;
    }


    this.isLoadingMessages =
      true;


    console.log(
      'Loading message page:',
      {
        targetUserId,
        pageNumber,
        pageSize
      }
    );


    this.getMessageHistory(
      targetUserId,
      pageNumber,
      pageSize
    )
    .subscribe({

      // =====================================================
      // SUCCESS
      // =====================================================

      next: (
        result
      ) => {

        console.log(
          'Message history response:',
          result
        );


        const messages =
          (result?.items || [])
            .map(
              (message: any) =>
                this.normalizeMessageStatus(
                  message
                )
            );


        // ---------------------------------------------------
        // UPDATE PAGINATION STATE
        // ---------------------------------------------------

        this.currentPage =
          result?.pageNumber ??
          pageNumber;


        this.pageSize =
          result?.pageSize ??
          pageSize;


        this.totalPages =
          result?.totalPages ??
          0;


        this.totalMessages =
          result?.totalCount ??
          0;


        // ---------------------------------------------------
        // CURRENT MESSAGES
        // ---------------------------------------------------

        const currentMessages =
          this.activeMessagesSubject
            .getValue() || [];


        // ---------------------------------------------------
        // PAGE 1
        // ---------------------------------------------------
        //
        // First load replaces current messages.
        //
        // ---------------------------------------------------

        if (
          pageNumber === 1
        ) {

          this.activeMessagesSubject.next(
            messages
          );

          return;

        }


        // ---------------------------------------------------
        // PAGE > 1
        // ---------------------------------------------------
        //
        // Older messages are inserted at TOP.
        //
        // ---------------------------------------------------

        const existingIds =
          new Set(
            currentMessages
              .map(
                message =>
                  message.id
              )
              .filter(
                id =>
                  id !== undefined &&
                  id !== null
              )
          );


        const newMessages =
          messages.filter(
            message => {

              if (
                message.id ===
                  undefined ||
                message.id === null
              ) {

                return true;

              }


              return !existingIds.has(
                message.id
              );

            }
          );


        /*
         * IMPORTANT:
         *
         * Older page goes BEFORE existing messages.
         */

        this.activeMessagesSubject.next([
          ...newMessages,
          ...currentMessages
        ]);

      },


      // =====================================================
      // ERROR
      // =====================================================

      error: (
        error
      ) => {

        console.error(
          'Failed to load message history:',
          error
        );

      },


      // =====================================================
      // COMPLETE
      // =====================================================

      complete: () => {

        this.isLoadingMessages =
          false;

      }

    });

  }


  // =========================================================
  // NORMALIZE MESSAGE STATUS
  // =========================================================

  private normalizeMessageStatus(
    message: any
  ): ChatMessage {

    let status:
      string;


    switch (
      message?.status
    ) {

      case 0:
      case '0':

        status =
          'sent';

        break;


      case 1:
      case '1':

        status =
          'delivered';

        break;


      case 2:
      case '2':

        status =
          'read';

        break;


      case 'sending':

        status =
          'sending';

        break;


      case 'sent':

        status =
          'sent';

        break;


      case 'delivered':

        status =
          'delivered';

        break;


      case 'read':

        status =
          'read';

        break;


      default:

        status =
          'sent';

        break;

    }


    return {

      ...message,

      status

    };

  }


  // =========================================================
  // PAGINATION GETTERS
  // =========================================================

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

    return (
      this.currentPage <
      this.totalPages
    );

  }


  public hasPreviousPage(): boolean {

    return (
      this.currentPage > 1
    );

  }


  public getIsLoadingMessages(): boolean {

    return this.isLoadingMessages;

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
      this.activeMessagesSubject
        .getValue() || [];


    const tempId =
      `temp-${crypto.randomUUID()}`;


    const optimisticMessage:
      ChatMessage = {

      id:
        tempId,

      senderUserId:
        currentUserId,

      receiverUserId,

      content:
        message,

      sentAt:
        new Date().toISOString()

    };


    this.activeMessagesSubject.next([
      ...currentMessages,
      optimisticMessage
    ]);


    try {

      await this.signalRService
        .sendMessage(
          receiverUserId,
          message
        );

    }

    catch (error) {

      console.error(
        'Failed to send message via SignalR:',
        error
      );


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


    const currentUserId =
      (
        localStorage.getItem(
          'userId'
        ) || ''
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


    const isSelf =
      senderIdLower ===
      currentUserId;


    const isFromActiveTarget =
      activeTargetId !== '' &&
      senderIdLower ===
        activeTargetId;


    const isToActiveTarget =
      activeTargetId !== '' &&
      receiverIdLower ===
        activeTargetId;


    if (
      isFromActiveTarget ||
      isToActiveTarget ||
      isSelf
    ) {

      const currentMessages =
        this.activeMessagesSubject
          .getValue() || [];


      const cleanedMessages =
        currentMessages.filter(
          message =>
            !(
              String(message.id)
                .startsWith('temp-') &&
              message.content ===
                content
            )
        );


      const exists =
        cleanedMessages.some(
          message =>
            message.id &&
            incomingMessage.id &&
            String(message.id) ===
              String(incomingMessage.id)
        );


      if (!exists) {

        const normalizedMessage:
          ChatMessage = {

          ...incomingMessage,

          senderUserId,

          receiverUserId,

          content

        };


        this.activeMessagesSubject.next([
          ...cleanedMessages,
          normalizedMessage
        ]);

      }


      if (
        isFromActiveTarget ||
        isSelf
      ) {

        return;

      }

    }


    // =======================================================
    // NOTIFICATION
    // =======================================================

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

        senderUserId,

        receiverUserId,

        content

      });

    }

  }


  // =========================================================
  // INCREMENT UNREAD
  // =========================================================

  private incrementUnreadMessages(
    userId: string
  ): void {

    const normalizedId =
      String(userId).toLowerCase();


    const current =
      this.unreadMessagesSubject
        .value;


    const currentCount =
      current[normalizedId] || 0;


    this.unreadMessagesSubject.next({

      ...current,

      [normalizedId]:
        currentCount + 1

    });

  }


  // =========================================================
  // CLEAR UNREAD
  // =========================================================

  public clearUnreadMessages(
    userId: string
  ): void {

    const normalizedId =
      String(userId).toLowerCase();


    const current = {

      ...this.unreadMessagesSubject
        .value

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
  // GET TOTAL UNREAD
  // =========================================================

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


  // =========================================================
  // REMOVE NOTIFICATION
  // =========================================================

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


  // =========================================================
  // CLEAR NOTIFICATIONS
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
  // BROWSER NOTIFICATION
  // =========================================================

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
      typeof Notification ===
      'undefined'
    ) {

      return;

    }


    if (
      Notification.permission ===
      'default'
    ) {

      await Notification
        .requestPermission();

    }

  }


  // =========================================================
  // CLOSE CHAT
  // =========================================================

  public closeChat(): void {

    this.activeTargetUserId =
      null;


    this.currentPage =
      1;


    this.totalPages =
      0;


    this.totalMessages =
      0;


    this.activeMessagesSubject.next([]);

  }


  // =========================================================
  // SEARCH USERS
  // =========================================================

  public searchUsers(
    query: string
  ): Observable<UserSearchResult[]> {

    return this.http.get<
      UserSearchResult[]
    >(
      `${BASE_URL}/user/SearchUsers/search?q=${encodeURIComponent(query)}`
    );

  }

}
