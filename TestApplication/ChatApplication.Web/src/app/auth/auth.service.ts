import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { BASE_URL } from '../app.config';
import { RegisterRequest } from '../models/registerrequest';
import { RegisterResponse } from '../models/registerresponse';

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

  login(credentials: LoginRequest): Observable<AuthResponse> {

    return this.http
      .post<AuthResponse>(`${this.authUrl}/login`, credentials)
      .pipe(

        tap((response) => {

          console.log('LOGIN RESPONSE:', response);

          if (!response?.token) {
            console.error('Login succeeded but token is missing.');
            return;
          }

          // Clear old authentication first
          this.clearAuthentication();

          // Save EVERYTHING in localStorage
          localStorage.setItem('token', response.token);

          if (response.userId) {
            localStorage.setItem('userId', response.userId);
          }

          if (response.userName) {
            localStorage.setItem('userName', response.userName);
          }

          if (response.email) {
            localStorage.setItem('email', response.email);
          }

          console.log('Authentication saved in localStorage');

          console.log('token:', localStorage.getItem('token'));
          console.log('userId:', localStorage.getItem('userId'));
          console.log('userName:', localStorage.getItem('userName'));
          console.log('email:', localStorage.getItem('email'));
        })
      );
  }

  // ============================
  // GET TOKEN
  // ============================

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  // ============================
  // GET USER ID
  // ============================

  getUserId(): string | null {
    return localStorage.getItem('userId');
  }

  // ============================
  // GET USER NAME
  // ============================

  getUserName(): string | null {
    return localStorage.getItem('userName');
  }

  // ============================
  // GET EMAIL
  // ============================

  getEmail(): string | null {
    return localStorage.getItem('email');
  }

  // ============================
  // CHECK LOGIN
  // ============================

  isLoggedIn(): boolean {
    const token = this.getToken();

    return !!token && token.trim().length > 0;
  }

  // ============================
  // LOGOUT
  // ============================

  logout(): void {
    this.clearAuthentication();
  }

  // ============================
  // CLEAR AUTHENTICATION
  // ============================

  private clearAuthentication(): void {

    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('email');
    localStorage.removeItem('rememberMe');

    // Also remove old session values
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('email');
    sessionStorage.removeItem('rememberMe');
  }
  register(request: RegisterRequest) {
    return this.http.post<RegisterResponse>(
      `${this.authUrl}/register`,
      request
    );
  }
}