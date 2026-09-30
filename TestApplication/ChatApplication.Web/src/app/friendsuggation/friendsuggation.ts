import {
  Component,
  OnInit,
  OnDestroy
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  Subscription
} from 'rxjs';

import {
  FriendService,
  FriendSuggestion
} from '../services/friend.service';

import { FriendRequest } from '../models/friendrequest';
import { Friend } from '../models/friend';

import {
  SignalRService,
  UserOnlineEvent,
  UserOfflineEvent
} from '../services/signalr.service';


@Component({
  selector: 'app-friendsuggation',

  standalone: true,

  imports: [
    CommonModule
  ],

  templateUrl: './friendsuggation.html',

  styleUrl: './friendsuggation.css',
})
export class Friendsuggation
  implements OnInit, OnDestroy {


  // =====================================================
  // DATA
  // =====================================================

  suggestions:
    FriendSuggestion[] = [];

  requests:
    FriendRequest[] = [];

  friends:
    Friend[] = [];


  // =====================================================
  // SUGGESTIONS STATE
  // =====================================================

  loading = false;

  errorMessage = '';

  successMessage = '';


  // =====================================================
  // FRIEND REQUEST STATE
  // =====================================================

  loadingRequests = false;

  requestErrorMessage = '';

  requestSuccessMessage = '';


  // =====================================================
  // FRIENDS STATE
  // =====================================================

  loadingFriends = false;

  friendsErrorMessage = '';


  // =====================================================
  // BUTTON LOADING
  // =====================================================

  loadingUserId:
    string | null = null;

  acceptingRequestId:
    string | null = null;


  // =====================================================
  // SUBSCRIPTIONS
  // =====================================================

  private subscriptions =
    new Subscription();


  // =====================================================
  // CONSTRUCTOR
  // =====================================================

  constructor(
    private friendService: FriendService,
    private signalRService: SignalRService
  ) {}


  // =====================================================
  // INIT
  // =====================================================

  async ngOnInit(): Promise<void> {

    // -----------------------------------------------------
    // Start SignalR
    // -----------------------------------------------------

    try {

      await this.signalRService
        .startConnection();

      console.log(
        'SignalR connected for friend presence.'
      );

    } catch (error) {

      console.error(
        'Failed to start SignalR:',
        error
      );
    }


    // -----------------------------------------------------
    // Load data
    // -----------------------------------------------------

    this.loadFriendRequests();

    this.loadSuggestions();

    this.loadFriends();


    // -----------------------------------------------------
    // Initial online users
    // -----------------------------------------------------

    this.subscriptions.add(

      this.signalRService
        .onlineUsers$
        .subscribe(
          (onlineUsers) => {

            console.log(
              'Current online users:',
              onlineUsers
            );

            this.updateFriendsPresence(
              onlineUsers.map(
                x => x.userId
              )
            );

          }
        )
    );


    // -----------------------------------------------------
    // User became online
    // -----------------------------------------------------

    this.subscriptions.add(

      this.signalRService
        .userOnline$
        .subscribe(
          (event: UserOnlineEvent) => {

            console.log(
              '🟢 Friend online:',
              event.userId
            );

            this.setFriendOnline(
              event.userId
            );

          }
        )
    );


    // -----------------------------------------------------
    // User became offline
    // -----------------------------------------------------

    this.subscriptions.add(

      this.signalRService
        .userOffline$
        .subscribe(
          (event: UserOfflineEvent) => {

            console.log(
              '⚪ Friend offline:',
              event.userId
            );

            this.setFriendOffline(
              event.userId,
              event.lastSeen
            );

          }
        )
    );
  }


  // =====================================================
  // GET FRIEND REQUESTS
  // =====================================================

  loadFriendRequests(): void {

    this.loadingRequests = true;

    this.requestErrorMessage = '';

    this.friendService
      .getFriendRequests()
      .subscribe({

        next: (
          result: FriendRequest[]
        ) => {

          this.requests = result;

          this.loadingRequests = false;

          console.log(
            'Friend requests:',
            this.requests
          );
        },

        error: (error) => {

          console.error(
            'Error loading friend requests:',
            error
          );

          this.requestErrorMessage =
            error?.error?.message ||
            'Unable to load friend requests.';

          this.loadingRequests = false;
        }
      });
  }


  // =====================================================
  // GET FRIEND SUGGESTIONS
  // =====================================================

  loadSuggestions(): void {

    this.loading = true;

    this.errorMessage = '';

    this.successMessage = '';

    this.friendService
      .getSuggestions(1, 20)
      .subscribe({

        next: (
          result: FriendSuggestion[]
        ) => {

          this.suggestions = result;

          this.loading = false;

          console.log(
            'Friend suggestions:',
            this.suggestions
          );
        },

        error: (error) => {

          console.error(
            'Error loading suggestions:',
            error
          );

          this.errorMessage =
            error?.error?.message ||
            'Unable to load suggestions.';

          this.loading = false;
        }
      });
  }


  // =====================================================
  // GET FRIENDS
  // =====================================================

  loadFriends(): void {

    this.loadingFriends = true;

    this.friendsErrorMessage = '';

    this.friendService
      .getFriends()
      .subscribe({

        next: (
          result: Friend[]
        ) => {

          this.friends = result || [];

          this.loadingFriends = false;


          // ------------------------------------------------
          // Apply current SignalR presence
          // ------------------------------------------------

          this.applyCurrentPresence();


          console.log(
            'Friends:',
            this.friends
          );
        },

        error: (error) => {

          console.error(
            'Error loading friends:',
            error
          );

          this.friendsErrorMessage =
            error?.error?.message ||
            'Unable to load friends.';

          this.loadingFriends = false;
        }
      });
  }


  // =====================================================
  // APPLY CURRENT PRESENCE
  // =====================================================

  private applyCurrentPresence(): void {

    this.friends.forEach(
      friend => {

        friend.isOnLine =
          this.signalRService.isUserOnline(
            friend.userId
          );

      }
    );
  }


  // =====================================================
  // UPDATE FRIENDS PRESENCE
  // =====================================================

  private updateFriendsPresence(
    onlineUserIds: string[]
  ): void {

    const onlineIds =
      new Set(
        onlineUserIds.map(
          id => String(id)
        )
      );


    this.friends.forEach(
      friend => {

        friend.isOnLine =
          onlineIds.has(
            String(friend.userId)
          );

      }
    );
  }


  // =====================================================
  // FRIEND ONLINE
  // =====================================================

  private setFriendOnline(
    userId: string
  ): void {

    if (!userId) {
      return;
    }


    const friend =
      this.friends.find(
        x =>
          String(x.userId) ===
          String(userId)
      );


    if (!friend) {

      console.log(
        'Online user is not in friends list:',
        userId
      );

      return;
    }


    friend.isOnLine = true;


    console.log(
      `🟢 Friend ${userId} is online`
    );
  }


  // =====================================================
  // FRIEND OFFLINE
  // =====================================================

  private setFriendOffline(
    userId: string,
    lastSeen?: string
  ): void {

    if (!userId) {
      return;
    }


    const friend =
      this.friends.find(
        x =>
          String(x.userId) ===
          String(userId)
      );


    if (!friend) {

      return;
    }


    friend.isOnLine = false;


    if (lastSeen) {

      friend.lastSeen =
        lastSeen;
    }


    console.log(
      `⚪ Friend ${userId} is offline`
    );
  }


  // =====================================================
  // CHECK FRIEND ONLINE
  // =====================================================

  isFriendOnline(
    userId: string
  ): boolean {

    return this.signalRService
      .isUserOnline(userId);
  }


  // =====================================================
  // SEND FRIEND REQUEST
  // =====================================================

  addFriend(
    friend: FriendSuggestion
  ): void {

    if (this.loadingUserId !== null) {
      return;
    }


    this.loadingUserId =
      friend.userId;

    this.errorMessage = '';

    this.successMessage = '';


    this.friendService
      .sendFriendRequest(
        friend.userId
      )
      .subscribe({

        next: (response) => {

          console.log(
            'Send friend request response:',
            response
          );


          if (response.success) {

            this.successMessage =
              response.message;


            this.suggestions =
              this.suggestions.filter(
                x =>
                  x.userId !==
                  friend.userId
              );

          } else {

            this.errorMessage =
              response.message;
          }


          this.loadingUserId = null;
        },

        error: (error) => {

          console.error(
            'Error sending friend request:',
            error
          );


          this.errorMessage =
            error?.error?.message ||
            'Unable to send friend request.';


          this.loadingUserId = null;
        }
      });
  }


  // =====================================================
  // CHECK ADD FRIEND LOADING
  // =====================================================

  isLoading(
    userId: string
  ): boolean {

    return this.loadingUserId === userId;
  }


  // =====================================================
  // ACCEPT FRIEND REQUEST
  // =====================================================

  acceptRequest(
    request: FriendRequest
  ): void {

    if (
      this.acceptingRequestId !== null
    ) {
      return;
    }


    this.acceptingRequestId =
      request.friendshipId;

    this.requestErrorMessage = '';

    this.requestSuccessMessage = '';


    this.friendService
      .acceptFriendRequest(
        request.friendshipId
      )
      .subscribe({

        next: (response) => {

          console.log(
            'Accept friend request response:',
            response
          );


          if (response.success) {

            this.requestSuccessMessage =
              response.message;


            this.requests =
              this.requests.filter(
                x =>
                  x.friendshipId !==
                  request.friendshipId
              );

          } else {

            this.requestErrorMessage =
              response.message;
          }


          this.acceptingRequestId = null;
        },

        error: (error) => {

          console.error(
            'Error accepting friend request:',
            error
          );


          this.requestErrorMessage =
            error?.error?.message ||
            'Unable to accept friend request.';


          this.acceptingRequestId = null;
        }
      });
  }


  // =====================================================
  // CHECK ACCEPT LOADING
  // =====================================================

  isAccepting(
    friendshipId: string
  ): boolean {

    return this.acceptingRequestId === friendshipId;
  }


  // =====================================================
  // IMAGE FALLBACK
  // =====================================================

  onImageError(
    event: Event
  ): void {

    const image =
      event.target as HTMLImageElement;


    image.src =
      'assets/default-profile.png';
  }


  // =====================================================
  // DESTROY
  // =====================================================

  ngOnDestroy(): void {

    this.subscriptions.unsubscribe();

  }
}
