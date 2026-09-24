import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_URL } from '../app.config';

// Interface MUST be named PostItem (or similar) to avoid collision with the component class
export interface PostItem {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAtUtc: string;
}

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${BASE_URL}/posts`;

  public getAllPosts(): Observable<PostItem[]> {
    return this.http.get<PostItem[]>(this.apiUrl);
  }

  public createPost(content: string): Observable<PostItem> {
    return this.http.post<PostItem>(this.apiUrl, { content });
  }
}