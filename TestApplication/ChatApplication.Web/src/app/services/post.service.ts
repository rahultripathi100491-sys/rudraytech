import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { BASE_URL } from '../app.config';
import { LikePostResponse } from '../models/likepostresponse';


// =====================================================
// COMMENT MODEL
// =====================================================

export interface PostComment {

  id: string;

  postId: string;

  userId: string;

  userName: string;

  content: string;

  createdAtUtc: string;
}


// =====================================================
// POST MODEL
// =====================================================

export interface PostItem {

  id: string;

  userId: string;

  userName: string;

  content: string;

  createdAtUtc: string;


  // ===================================================
  // LIKE DATA
  // ===================================================

  likeCount: number;

  isLikedByCurrentUser: boolean;


  // ===================================================
  // COMMENT DATA
  // ===================================================

  commentCount: number;


  // ===================================================
  // FRONTEND COMMENT STATE
  // These are NOT required from the backend.
  // They are used by Angular to control the UI.
  // ===================================================

  comments: PostComment[];

  commentsVisible: boolean;

  commentsLoaded: boolean;

  loadingComments: boolean;

  addingComment: boolean;

  commentText: string;
}


// =====================================================
// SERVICE
// =====================================================

@Injectable({
  providedIn: 'root'
})
export class PostService {

  private http = inject(HttpClient);

  private readonly apiUrl =
    `${BASE_URL}/posts`;


  // =====================================================
  // GET ALL POSTS
  // =====================================================

  public getAllPosts(): Observable<PostItem[]> {

    return this.http.get<PostItem[]>(
      this.apiUrl
    );
  }


  // =====================================================
  // CREATE POST
  // =====================================================

  public createPost(
    content: string
  ): Observable<PostItem> {

    return this.http.post<PostItem>(
      this.apiUrl,
      {
        content: content
      }
    );
  }


  // =====================================================
  // LIKE / UNLIKE
  // =====================================================

  public toggleLike(
    postId: string
  ): Observable<LikePostResponse> {

    return this.http.post<LikePostResponse>(
      `${this.apiUrl}/${postId}/like`,
      {}
    );
  }


  // =====================================================
  // GET COMMENTS
  // =====================================================

  public getComments(
    postId: string
  ): Observable<PostComment[]> {

    return this.http.get<PostComment[]>(
      `${this.apiUrl}/${postId}/comments`
    );
  }


  // =====================================================
  // ADD COMMENT
  // =====================================================

  public addComment(
    postId: string,
    content: string
  ): Observable<PostComment> {

    return this.http.post<PostComment>(
      `${this.apiUrl}/${postId}/comments`,
      {
        content: content
      }
    );
  }

}
