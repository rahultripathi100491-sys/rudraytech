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
import { Observable, Subscription } from 'rxjs';

import {
  ChatService,
  UserSearchResult
} from '../services/chat';

import {
  ChatMessage,
  Conversation
} from '../models/chat-message';

import { CallService } from '../services/call.service';

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

  protected chatService = inject(ChatService);
  protected callService = inject(CallService);

  // =========================================================
  // CALL STATE
  // =========================================================

  public incomingCallUserId: string | null = null;

  public incomingCallName: string = '';

  public isCallActive$: Observable<boolean> =
    this.callService.isCallActive$;

  // =========================================================
  // CHAT STATE
  // =========================================================

  public showNewChatModal = false;

  public searchQuery = '';

  public searchResults: UserSearchResult[] = [];

  public activeTargetUserId: string | null = null;

  public activeTargetName: string = '';

  public currentUserId: string =
    localStorage.getItem('userId') || '';

  public newMessageText = '';

  public isSending = false;

  // =========================================================
  // SCROLL
  // =========================================================

  @ViewChild('scrollContainer')
  private scrollContainer!: ElementRef;

  // =========================================================
  // OBSERVABLES
  // =========================================================

  public conversations$: Observable<Conversation[]> =
    this.chatService.getConversations();

  // =========================================================
  // SUBSCRIPTIONS
  // =========================================================

  private subscriptions = new Subscription();

  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

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

      await this.chatService.sendMessage(
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

      await this.callService.startCall(
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

    // Set current chat to caller
    this.activeTargetUserId =
      callerId;

    this.activeTargetName =
      callerName;

    try {

      await this.callService.acceptCall(
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

      await this.callService.rejectCall(
        this.incomingCallUserId
      );

    } catch (error) {

      console.error(
        'Failed to reject call:',
        error
      );

    }

    this.incomingCallUserId = null;

    this.incomingCallName = '';
  }

  // =========================================================
  // END CALL
  // =========================================================

  public async endCall(): Promise<void> {

    try {

      await this.callService.endCall();

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
}