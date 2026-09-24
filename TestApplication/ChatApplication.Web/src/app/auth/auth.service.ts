import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { BASE_URL } from '../app.config';

export interface LoginRequest {
  email?: string;
  password?: string;
}

export interface AuthResponse {
  token: string;
  userId?: string;
  userName?: string;
  email?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private readonly authUrl = `${BASE_URL}/Auth`;
  private readonly apiUrl = 'https://testapplication.somee.com/api/Auth'; // Match your ASP.NET Core port

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authUrl}/login`, credentials).pipe(
      tap((response) => {
        if (response?.token) {
          localStorage.setItem('token', response.token);
        }
        if(response.userId){
          localStorage.setItem('userId', response.userId);
        }
        if (response.userName) {
            localStorage.setItem('userName', response.userName);
          }

          if (response.email) {
            localStorage.setItem('email', response.email);
          }
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('email');
  }
}