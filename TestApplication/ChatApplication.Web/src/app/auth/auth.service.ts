import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable, tap } from 'rxjs';

import { BASE_URL } from '../app.config';
import { RegisterRequest } from '../models/registerrequest';
import { RegisterResponse } from '../models/registerresponse';
import { SignalRService } from '../services/signalr.service';


export interface LoginRequest {
  email?: string;
  password?: string;
}


export interface AuthResponse {
  token: string;
  userId?: string;
  userName?: string;
  email?: string;
  isLogin: boolean;
}


@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // =========================================================
  // SERVICES
  // =========================================================

  private http = inject(HttpClient);

  private signalRService =
    inject(SignalRService);


  // =========================================================
  // URL
  // =========================================================

  private readonly authUrl =
    `${BASE_URL}/Auth`;


  // =========================================================
  // LOGIN
  // =========================================================

  login(
    credentials: LoginRequest
  ): Observable<AuthResponse> {

    return this.http
      .post<AuthResponse>(
        `${this.authUrl}/login`,
        credentials
      )
      .pipe(

        tap((response) => {

          console.log(
            'LOGIN RESPONSE:',
            response
          );


          if (!response?.token) {

            console.error(
              'Login succeeded but token is missing.'
            );

            return;
          }


          // -------------------------------------------------
          // Clear old authentication
          // -------------------------------------------------

          this.clearAuthentication();


          // -------------------------------------------------
          // Save token
          // -------------------------------------------------

          localStorage.setItem(
            'token',
            response.token
          );


          // -------------------------------------------------
          // Save user ID
          // -------------------------------------------------

          if (response.userId) {

            localStorage.setItem(
              'userId',
              response.userId
            );
          }


          // -------------------------------------------------
          // Save user name
          // -------------------------------------------------

          if (response.userName) {

            localStorage.setItem(
              'userName',
              response.userName
            );
          }


          // -------------------------------------------------
          // Save email
          // -------------------------------------------------

          if (response.email) {

            localStorage.setItem(
              'email',
              response.email
            );
          }


          // -------------------------------------------------
          // Save login status
          // -------------------------------------------------

          localStorage.setItem(
            'isLogin',
            String(response.isLogin)
          );


          console.log(
            'Authentication saved.'
          );

          console.log(
            'userId:',
            localStorage.getItem('userId')
          );

        })
      );
  }


  // =========================================================
  // GET TOKEN
  // =========================================================

  getToken(): string | null {

    return localStorage.getItem(
      'token'
    );
  }


  // =========================================================
  // GET USER ID
  // =========================================================

  getUserId(): string | null {

    return localStorage.getItem(
      'userId'
    );
  }


  // =========================================================
  // GET USER NAME
  // =========================================================

  getUserName(): string | null {

    return localStorage.getItem(
      'userName'
    );
  }


  // =========================================================
  // GET EMAIL
  // =========================================================

  getEmail(): string | null {

    return localStorage.getItem(
      'email'
    );
  }


  // =========================================================
  // CHECK LOGIN
  // =========================================================

  isLoggedIn(): boolean {

    const token =
      this.getToken();

    return !!token &&
      token.trim().length > 0;
  }


  // =========================================================
  // LOGOUT
  // =========================================================

  logout(): Observable<void> {

    console.log(
      'Starting logout...'
    );


    // IMPORTANT:
    // Do NOT clear the JWT before stopping SignalR.
    //
    // SignalR needs to disconnect first so that the
    // ASP.NET Core Hub receives OnDisconnectedAsync().
    //

    return new Observable<void>((observer) => {

      this.signalRService
        .stopConnection()

        .then(() => {

          console.log(
            'SignalR disconnected successfully.'
          );


          // -------------------------------------------------
          // Now call backend logout
          // -------------------------------------------------

          this.http
            .post<void>(
              `${this.authUrl}/logout`,
              {}
            )
            .subscribe({

              next: () => {

                console.log(
                  'Backend logout successful.'
                );

                observer.next();

                observer.complete();
              },


              error: (error) => {

                console.error(
                  'Backend logout failed:',
                  error
                );

                // Even if backend logout fails,
                // clear local authentication.

                observer.error(
                  error
                );
              },


              complete: () => {

                this.clearAuthentication();

              }

            });

        })

        .catch((error) => {

          console.error(
            'Failed to stop SignalR:',
            error
          );


          // Still clear authentication
          // so the user is logged out locally.

          this.clearAuthentication();


          observer.error(
            error
          );

        });

    });
  }


  // =========================================================
  // SIMPLE LOGOUT
  // =========================================================
  //
  // You can use this if your backend does not require
  // a logout API call.
  //
  // =========================================================

  async logoutLocal(): Promise<void> {

    console.log(
      'Logging out locally...'
    );


    try {

      // FIRST disconnect SignalR

      await this.signalRService
        .stopConnection();

    } catch (error) {

      console.error(
        'SignalR disconnect error:',
        error
      );

    } finally {

      // THEN clear authentication

      this.clearAuthentication();

    }
  }


  // =========================================================
  // CLEAR AUTHENTICATION
  // =========================================================

  private clearAuthentication(): void {

    console.log(
      'Clearing authentication...'
    );


    // -------------------------------------------------------
    // Local storage
    // -------------------------------------------------------

    localStorage.removeItem(
      'token'
    );

    localStorage.removeItem(
      'userId'
    );

    localStorage.removeItem(
      'userName'
    );

    localStorage.removeItem(
      'email'
    );

    localStorage.removeItem(
      'rememberMe'
    );

    localStorage.removeItem(
      'isLogin'
    );


    // -------------------------------------------------------
    // Session storage
    // -------------------------------------------------------

    sessionStorage.removeItem(
      'token'
    );

    sessionStorage.removeItem(
      'userId'
    );

    sessionStorage.removeItem(
      'userName'
    );

    sessionStorage.removeItem(
      'email'
    );

    sessionStorage.removeItem(
      'rememberMe'
    );

    sessionStorage.removeItem(
      'isLogin'
    );


    console.log(
      'Authentication cleared.'
    );
  }


  // =========================================================
  // REGISTER
  // =========================================================

  register(
    request: RegisterRequest
  ): Observable<RegisterResponse> {

    return this.http
      .post<RegisterResponse>(
        `${this.authUrl}/register`,
        request
      );
  }
}
