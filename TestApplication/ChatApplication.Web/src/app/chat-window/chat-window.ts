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
  ChatMessage,
  Conversation
} from '../models/chat-message';

import { CallService } from '../services/call.service';

import {
  SignalRService,
  UserOnlineEvent,
  UserOfflineEvent
} from '../services/signalr.service';

import { User } from '../models/user';


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
  implements OnInit, OnDestroy, AfterViewChecked {


  // =========================================================
  // SERVICES
  // =========================================================

  protected chatService =
    inject(ChatService);

  protected callService =
    inject(CallService);

  protected signalRService =
    inject(SignalRService);


  // =========================================================
  // CALL STATE
  // =========================================================

  public incomingCallUserId:
    string | null = null;

  public incomingCallName:
    string = '';

  public isCallActive$:
    Observable<boolean> =
    this.callService.isCallActive$;


  // =========================================================
  // CHAT STATE
  // =========================================================

  public showNewChatModal =
    false;

  public searchQuery =
    '';

  public searchResults:
    UserSearchResult[] = [];

  public activeTargetUserId:
    string | null = null;

  public activeTargetName =
    '';

  public currentUserId:
    string =
    localStorage.getItem('userId') || '';

  public newMessageText =
    '';

  public isSending =
    false;

  public isLogin: boolean =
    localStorage.getItem('isLogin') === 'true';


  // =========================================================
  // USERS
  // =========================================================

  public users:
    User[] = [];


  // =========================================================
  // SCROLL
  // =========================================================

  @ViewChild('scrollContainer')
  private scrollContainer!: ElementRef;


  // =========================================================
  // OBSERVABLES
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

    // -------------------------------------------------------
    // START SIGNALR
    // -------------------------------------------------------

    try {

      await this.signalRService
        .startConnection();

      console.log(
        'SignalR ready for presence.'
      );

    } catch (error) {

      console.error(
        'Failed to start SignalR:',
        error
      );
    }


    // -------------------------------------------------------
    // LOAD USERS
    // -------------------------------------------------------

    await this.loadUsers();


    // -------------------------------------------------------
    // USER ONLINE
    // -------------------------------------------------------

    this.subscriptions.add(

      this.signalRService
        .userOnline$
        .subscribe(
          (user: UserOnlineEvent) => {

            console.log(
              '🟢 USER ONLINE:',
              user
            );

            this.setUserOnline(
              user.userId
            );
          }
        )
    );


    // -------------------------------------------------------
    // USER OFFLINE
    // -------------------------------------------------------

    this.subscriptions.add(

      this.signalRService
        .userOffline$
        .subscribe(
          (event: UserOfflineEvent) => {

            console.log(
              '⚪ USER OFFLINE:',
              event
            );

            this.setUserOffline(
              event.userId,
              event.lastSeen
            );
          }
        )
    );


    // -------------------------------------------------------
    // CHAT MESSAGE CHANGES
    // -------------------------------------------------------

    this.subscriptions.add(

      this.chatService.activeMessages$
        .subscribe(() => {

          setTimeout(() => {

            this.scrollToBottom();

          });

        })
    );


    // -------------------------------------------------------
    // INCOMING CALL USER ID
    // -------------------------------------------------------

    this.subscriptions.add(

      this.callService.incomingCall$
        .subscribe((fromUserId) => {

          this.incomingCallUserId =
            fromUserId;

        })
    );


    // -------------------------------------------------------
    // INCOMING CALL NAME
    // -------------------------------------------------------

    this.subscriptions.add(

      this.callService.incomingCallName$
        .subscribe((name) => {

          this.incomingCallName =
            name || 'Unknown user';

        })
    );


    // -------------------------------------------------------
    // CALL ACCEPTED
    // -------------------------------------------------------

    this.subscriptions.add(

      this.callService.callAccepted$
        .subscribe((userId) => {

          if (!userId) {
            return;
          }

          console.log(
            'Call accepted by:',
            userId
          );

          this.activeTargetUserId =
            userId;

        })
    );


    // -------------------------------------------------------
    // CALL REJECTED
    // -------------------------------------------------------

    this.subscriptions.add(

      this.callService.callRejected$
        .subscribe((userId) => {

          console.log(
            'Call rejected by:',
            userId
          );

        })
    );


    // -------------------------------------------------------
    // CALL ENDED
    // -------------------------------------------------------

    this.subscriptions.add(

      this.callService.callEnded$
        .subscribe((userId) => {

          console.log(
            'Call ended by:',
            userId
          );

        })
    );
  }


  // =========================================================
  // LOAD USERS
  // =========================================================

  private async loadUsers(): Promise<void> {

    /*
     * Your conversations are currently loaded
     * through ChatService.
     *
     * Do NOT load conversation history here because
     * there may not be an activeTargetUserId yet.
     *
     * If you have a UserService.getUsers(), put it here.
     */
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


    // -------------------------------------------------------
    // Update users array if user exists
    // -------------------------------------------------------

    const user =
      this.users.find(
        x =>
          String(x.id) ===
          String(userId)
      );


    if (user) {

      user.isOnLine = true;

      console.log(
        `🟢 ${user.firstName} ${user.lastName} is online`
      );

    } else {

      console.log(
        '🟢 User is online:',
        userId
      );
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
        x =>
          String(x.id) ===
          String(userId)
      );


    if (user) {

      user.isOnLine = false;


      if (lastSeen) {

        user.lastSeen =
          lastSeen;
      }


      console.log(
        `⚪ ${user.firstName} ${user.lastName} is offline`
      );

    } else {

      console.log(
        '⚪ User is offline:',
        userId
      );
    }
  }


  // =========================================================
  // CHECK USER ONLINE
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
  // GET ACTIVE USER ONLINE STATUS
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

    this.scrollToBottom();

  }


  // =========================================================
  // NEW CHAT
  // =========================================================

  public openNewChatModal(): void {

    this.showNewChatModal = true;

    this.searchQuery = '';

    this.searchResults = [];

  }


  // =========================================================
  // CLOSE NEW CHAT
  // =========================================================

  public closeNewChatModal(): void {

    this.showNewChatModal = false;

    this.searchQuery = '';

    this.searchResults = [];

  }


  // =========================================================
  // SEARCH USERS
  // =========================================================

  public onSearchUsers(): void {

    const query =
      this.searchQuery.trim();


    if (!query) {

      this.searchResults = [];

      return;
    }


    this.chatService
      .searchUsers(query)
      .subscribe({

        next: (results) => {

          this.searchResults =
            results || [];

        },

        error: (error) => {

          console.error(
            'Failed to search users:',
            error
          );

          this.searchResults = [];

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


    this.chatService
      .loadConversationHistory(
        targetUserId
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


    this.activeTargetUserId =
      targetUserId;

    this.activeTargetName =
      targetName || 'Chat';


    this.chatService
      .loadConversationHistory(
        targetUserId
      );
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
      user.name || 'User';


    this.closeNewChatModal();


    this.chatService
      .loadConversationHistory(
        user.id
      );
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


    this.newMessageText = '';

    this.isSending = true;


    try {

      await this.chatService
        .sendMessage(
          targetUserId,
          message
        );

    } catch (error) {

      console.error(
        'Failed to dispatch message:',
        error
      );


      this.newMessageText =
        message;

    } finally {

      this.isSending = false;


      setTimeout(() => {

        this.scrollToBottom();

      });

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
  // START CALL
  // =========================================================

  public async startCall(): Promise<void> {

    if (!this.activeTargetUserId) {

      console.warn(
        'No active user selected.'
      );

      return;
    }


    try {

      console.log(
        '📞 Calling:',
        this.activeTargetUserId
      );


      await this.callService
        .startCall(
          this.activeTargetUserId
        );

    } catch (error) {

      console.error(
        'Failed to start call:',
        error
      );
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


    const callerName =
      this.incomingCallName ||
      'Caller';


    this.activeTargetUserId =
      callerId;

    this.activeTargetName =
      callerName;


    try {

      await this.callService
        .acceptCall(
          callerId
        );

    } catch (error) {

      console.error(
        'Failed to accept call:',
        error
      );
    }
  }


  // =========================================================
  // REJECT INCOMING CALL
  // =========================================================

  public async rejectIncomingCall(): Promise<void> {

    if (!this.incomingCallUserId) {
      return;
    }


    try {

      await this.callService
        .rejectCall(
          this.incomingCallUserId
        );

    } catch (error) {

      console.error(
        'Failed to reject call:',
        error
      );
    }


    this.incomingCallUserId =
      null;

    this.incomingCallName =
      '';
  }


  // =========================================================
  // END CALL
  // =========================================================

  public async endCall(): Promise<void> {

    try {

      await this.callService
        .endCall();

    } catch (error) {

      console.error(
        'Failed to end call:',
        error
      );
    }
  }


  // =========================================================
  // DESTROY
  // =========================================================

  ngOnDestroy(): void {

    this.subscriptions.unsubscribe();

  }
  getAvatarColor(text: string): string {
  if (!text) {
    return '#e5e7eb';
  }

  const colors = [
    '#EF4444', // red
    '#F97316', // orange
    '#F59E0B', // amber
    '#EAB308', // yellow
    '#84CC16', // lime
    '#22C55E', // green
    '#10B981', // emerald
    '#14B8A6', // teal
    '#06B6D4', // cyan
    '#0EA5E9', // sky
    '#3B82F6', // blue
    '#6366F1', // indigo
    '#8B5CF6', // violet
    '#A855F7', // purple
    '#D946EF', // fuchsia
    '#EC4899', // pink
    '#F43F5E'  // rose
  ];

  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash =
      text.charCodeAt(i) +
      ((hash << 5) - hash);
  }

  const index =
    Math.abs(hash) % colors.length;

  return colors[index];
}
}
