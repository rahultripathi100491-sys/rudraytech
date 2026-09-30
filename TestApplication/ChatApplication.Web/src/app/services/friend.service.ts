import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import { Observable } from 'rxjs';

import { BASE_URL } from '../app.config';

import {
  SendFriendRequestResponse
} from '../models/sendfriendrequestresponse';

import {
  AcceptFriendRequestResponse
} from '../models/acceptfriendrequestresponse';

import {
  FriendRequest
} from '../models/friendrequest';
import { Friend } from '../models/friend';


export interface FriendSuggestion {
  userId: string;
  name: string;
  profileImage?: string | null;
  mutualFriends: number;
  isOnLine: boolean,
  lastSeen: string
}


@Injectable({
  providedIn: 'root'
})
export class FriendService {

  private readonly apiUrl =
    `${BASE_URL}/friends`;


  constructor(
    private http: HttpClient
  ) {}


  // =====================================================
  // GET FRIEND SUGGESTIONS
  // =====================================================

  getSuggestions(
    page: number = 1,
    pageSize: number = 20
  ): Observable<FriendSuggestion[]> {

    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<FriendSuggestion[]>(
      `${this.apiUrl}/suggestions`,
      { params }
    );
  }


  // =====================================================
  // SEND FRIEND REQUEST
  // =====================================================

  sendFriendRequest(
    friendId: string
  ): Observable<SendFriendRequestResponse> {

    return this.http.post<SendFriendRequestResponse>(
      `${this.apiUrl}/${friendId}/request`,
      {}
    );
  }


  // =====================================================
  // ACCEPT FRIEND REQUEST
  // =====================================================

  acceptFriendRequest(
    friendshipId: string
  ): Observable<AcceptFriendRequestResponse> {

    return this.http.post<AcceptFriendRequestResponse>(
      `${this.apiUrl}/${friendshipId}/accept`,
      {}
    );
  }


  // =====================================================
  // GET CURRENT USER'S FRIEND REQUESTS
  // =====================================================

  getFriendRequests(): Observable<FriendRequest[]> {

    return this.http.get<FriendRequest[]>(
      `${this.apiUrl}/requests`
    );
  }
getFriends(): Observable<Friend[]> {

  return this.http.get<Friend[]>(
    `${this.apiUrl}`
  );
}
}
