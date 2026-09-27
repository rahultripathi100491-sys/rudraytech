import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  FriendService,
  FriendSuggestion
} from '../services/friend.service';

import { FriendRequest } from '../models/friendrequest';
import { Friend } from '../models/friend';

@Component({
  selector: 'app-friendsuggation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './friendsuggation.html',
  styleUrl: './friendsuggation.css',
})
export class Friendsuggation implements OnInit {

  // =====================================================
  // DATA
  // =====================================================

  suggestions: FriendSuggestion[] = [];

  requests: FriendRequest[] = [];

  friends: Friend[] = [];


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

  loadingFriends = false;


  // =====================================================
  // BUTTON LOADING
  // =====================================================

  loadingUserId: string | null = null;

  acceptingRequestId: string | null = null;

  friendsErrorMessage = '';


  // =====================================================
  // CONSTRUCTOR
  // =====================================================

  constructor(
    private friendService: FriendService
  ) {}


  // =====================================================
  // INIT
  // =====================================================

  ngOnInit(): void {

    // Load incoming friend requests
    this.loadFriendRequests();

    // Load people you may know
    this.loadSuggestions();

    this.loadFriends();
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

        next: (result: FriendRequest[]) => {

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

        next: (result: FriendSuggestion[]) => {

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
      .sendFriendRequest(friend.userId)
      .subscribe({

        next: (response) => {

          console.log(
            'Send friend request response:',
            response
          );

          if (response.success) {

            this.successMessage =
              response.message;

            // Remove from suggestions
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

    if (this.acceptingRequestId !== null) {
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

            // Remove accepted request
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
loadFriends(): void {

  this.loadingFriends = true;

  this.friendService
    .getFriends()
    .subscribe({

      next: (result) => {

        this.friends = result;

        this.loadingFriends = false;
      },

      error: (error) => {

        console.error(
          'Error loading friends:',
          error
        );

        this.loadingFriends = false;
      }
    });
  }
}
