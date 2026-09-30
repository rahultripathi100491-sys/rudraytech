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
  Conversation
} from '../models/chat-message';

import {
  CallService,
  CallType
} from '../services/call.service';

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


  // =========================================================
  // VIDEO / AUDIO ELEMENTS
  // =========================================================

  @ViewChild('localVideo')
  localVideo?: ElementRef<HTMLVideoElement>;

  @ViewChild('remoteVideo')
  remoteVideo?: ElementRef<HTMLVideoElement>;

  @ViewChild('remoteAudio')
  remoteAudio?: ElementRef<HTMLAudioElement>;

  @ViewChild('scrollContainer')
  private scrollContainer!: ElementRef;


  // =========================================================
  // CALL STATE
  // =========================================================

  public incomingCallUserId:
    string | null = null;

  public incomingCallName =
    '';

  public incomingCallType:
    CallType = 'video';

  /*
   * Main call type used internally by the component.
   */
  public activeCallType:
    CallType | null = null;

  /*
   * Alias used by the HTML template.
   *
   * Your template currently checks:
   *
   * callType === 'voice'
   * callType === 'video'
   *
   * Therefore this property is kept synchronized
   * with activeCallType.
   */
  public callType:
    CallType | null = null;

  public isCallActive$:
    Observable<boolean> =
    this.callService.isCallActive$;

  public localStream:
    MediaStream | null = null;

  public remoteStream:
    MediaStream | null = null;

  public isStartingCall =
    false;

  public callStatus =
    '';

  public isMicrophoneMuted =
    false;

  public isCameraOff =
    false;


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

  public currentUserId =
    localStorage.getItem('userId') || '';

  public newMessageText =
    '';

  public isSending =
    false;

  public isLogin =
    localStorage.getItem('isLogin') === 'true';


  // =========================================================
  // USERS
  // =========================================================

  public users:
    User[] = [];


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

    // -------------------------------------------------------
    // SignalR
    // -------------------------------------------------------

    try {

      await this.signalRService
        .startConnection();

    } catch (error) {

      console.error(
        'SignalR connection failed:',
        error
      );
    }


    // -------------------------------------------------------
    // Users
    // -------------------------------------------------------

    await this.loadUsers();


    // -------------------------------------------------------
    // Online
    // -------------------------------------------------------

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


    // -------------------------------------------------------
    // Offline
    // -------------------------------------------------------

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


    // -------------------------------------------------------
    // Chat messages
    // -------------------------------------------------------

    this.subscriptions.add(

      this.chatService
        .activeMessages$
        .subscribe(() => {

          setTimeout(() => {

            this.scrollToBottom();

          });

        })
    );


    // =======================================================
    // INCOMING CALL
    // =======================================================

    this.subscriptions.add(

      this.callService
        .incomingCall$
        .subscribe(userId => {

          this.incomingCallUserId =
            userId;

          if (userId) {

            this.callStatus =
              'Incoming call...';
          }
        })
    );


    // =======================================================
    // INCOMING CALL NAME
    // =======================================================

    this.subscriptions.add(

      this.callService
        .incomingCallName$
        .subscribe(name => {

          this.incomingCallName =
            name || 'Unknown user';
        })
    );


    // =======================================================
    // INCOMING CALL TYPE
    // =======================================================

    this.subscriptions.add(

      this.callService
        .incomingCallType$
        .subscribe(type => {

          if (type) {

            this.incomingCallType =
              type;
          }
        })
    );


    // =======================================================
    // LOCAL STREAM
    // =======================================================

    this.subscriptions.add(

      this.callService
        .localStream$
        .subscribe(stream => {

          this.localStream =
            stream;

          setTimeout(() => {

            this.attachMedia();

          });
        })
    );


    // =======================================================
    // REMOTE STREAM
    // =======================================================

    this.subscriptions.add(

      this.callService
        .remoteStream$
        .subscribe(stream => {

          this.remoteStream =
            stream;

          setTimeout(() => {

            this.attachMedia();

          });
        })
    );


    // =======================================================
    // CALL ACCEPTED
    // =======================================================

    this.subscriptions.add(

      this.callService
        .callAccepted$
        .subscribe(userId => {

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

        })
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

        })
    );
  }


  // =========================================================
  // LOAD USERS
  // =========================================================

  private async loadUsers(): Promise<void> {

    // Keep your existing user loading logic here.

  }


  // =========================================================
  // ONLINE
  // =========================================================

  private setUserOnline(
    userId: string
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

      user.isOnLine =
        true;
    }
  }


  // =========================================================
  // OFFLINE
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

      user.isOnLine =
        false;

      if (lastSeen) {

        user.lastSeen =
          lastSeen;
      }
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

    this.attachMedia();

  }


  // =========================================================
  // ATTACH MEDIA
  // =========================================================

  private attachMedia(): void {

    // -------------------------------------------------------
    // LOCAL VIDEO
    // -------------------------------------------------------

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

      video.play()
        .catch(() => {});
    }


    // -------------------------------------------------------
    // REMOTE VIDEO
    // -------------------------------------------------------

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

      video.play()
        .catch(() => {});
    }


    // -------------------------------------------------------
    // REMOTE AUDIO
    // -------------------------------------------------------

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

      audio.play()
        .catch(error => {

          console.warn(
            'Remote audio autoplay blocked:',
            error
          );

        });
    }
  }


  // =========================================================
  // START VIDEO CALL
  // =========================================================

  public async startCall(): Promise<void> {

    if (!this.activeTargetUserId) {
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


    try {

      await this.callService
        .startCall(
          this.activeTargetUserId
        );

    } catch (error) {

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


    try {

      await this.callService
        .startVoiceCall(
          this.activeTargetUserId
        );

    } catch (error) {

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


      /*
       * IMPORTANT:
       *
       * Do not request microphone/camera here.
       *
       * ReceiveOffer in CallService creates the
       * WebRTC connection and requests the correct
       * media after the call has been accepted.
       */

      await this.callService
        .acceptCall(
          callerId
        );


      this.incomingCallUserId =
        null;

      this.incomingCallName =
        '';

    } catch (error) {

      console.error(
        'Accept call failed:',
        error
      );

      this.callStatus =
        'Unable to accept call.';

    }
  }


  // =========================================================
  // REJECT
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

    } catch (error) {

      console.error(
        'Reject call failed:',
        error
      );

    }


    this.incomingCallUserId =
      null;

    this.incomingCallName =
      '';

    this.callStatus =
      '';
  }


  // =========================================================
  // MICROPHONE
  // =========================================================

  public toggleMicrophone(): void {

    const enabled =
      this.callService
        .toggleMicrophone();

    this.isMicrophoneMuted =
      !enabled;
  }


  // =========================================================
  // CAMERA
  // =========================================================

  public toggleCamera(): void {

    const enabled =
      this.callService
        .toggleCamera();

    this.isCameraOff =
      !enabled;
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
        'End call failed:',
        error
      );

    } finally {

      this.stopMedia();

      this.activeCallType =
        null;

      this.callType =
        null;

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
        .forEach(track => {

          track.stop();

        });

      this.localStream =
        null;
    }


    if (this.remoteStream) {

      this.remoteStream
        .getTracks()
        .forEach(track => {

          track.stop();

        });

      this.remoteStream =
        null;
    }


    if (this.localVideo?.nativeElement) {

      this.localVideo.nativeElement
        .srcObject = null;
    }


    if (this.remoteVideo?.nativeElement) {

      this.remoteVideo.nativeElement
        .srcObject = null;
    }


    if (this.remoteAudio?.nativeElement) {

      this.remoteAudio.nativeElement
        .pause();

      this.remoteAudio.nativeElement
        .srcObject = null;
    }


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


  public closeNewChatModal(): void {

    this.showNewChatModal =
      false;

    this.searchQuery =
      '';

    this.searchResults =
      [];
  }


  // =========================================================
  // SEARCH
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

        next: results => {

          this.searchResults =
            results || [];

        },

        error: error => {

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
  // SELECT USER
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

    } catch (error) {

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

    this.stopMedia();

    this.subscriptions.unsubscribe();

  }
}
