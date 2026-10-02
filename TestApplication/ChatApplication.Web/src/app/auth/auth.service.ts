import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  tap
} from 'rxjs';

import { BASE_URL } from '../app.config';

import { RegisterRequest }
  from '../models/registerrequest';

import { RegisterResponse }
  from '../models/registerresponse';

import { SignalRService }
  from '../services/signalr.service';


// =========================================================
// LOGIN REQUEST
// =========================================================

export interface LoginRequest {

  email?: string;

  password?: string;
}


// =========================================================
// AUTH RESPONSE
// =========================================================

export interface AuthResponse {

  /*
   * Access JWT
   */
  token: string;

  userId?: string;

  userName?: string;

  email?: string;

  isLogin: boolean;

  /*
   * Optional expiry returned by API.
   */
  expiresAt?: string;
}


// =========================================================
// REFRESH RESPONSE
// =========================================================

export interface RefreshTokenResponse {

  /*
   * New access JWT
   */
  accessToken: string;

  /*
   * Optional expiry.
   */
  expiresAt?: string;
}


@Injectable({
  providedIn: 'root'
})
export class AuthService {


  // =========================================================
  // SERVICES
  // =========================================================

  private readonly http =
    inject(HttpClient);

  private readonly signalRService =
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
        credentials,
        {
          /*
           * Required if your backend sends the
           * refresh token as an HttpOnly cookie.
           */
          withCredentials: true
        }
      )
      .pipe(

        tap((response) => {

          console.log(
            'LOGIN RESPONSE:',
            response
          );


          // -------------------------------------------------
          // Validate token
          // -------------------------------------------------

          if (!response?.token) {

            console.error(
              'Login succeeded but token is missing.'
            );

            return;
          }


          // -------------------------------------------------
          // Clear previous authentication
          // -------------------------------------------------

          this.clearAuthentication();


          // -------------------------------------------------
          // Save access token
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


          // -------------------------------------------------
          // Save expiry if returned
          // -------------------------------------------------

          if (response.expiresAt) {

            localStorage.setItem(
              'tokenExpiresAt',
              response.expiresAt
            );
          }


          console.log(
            'Authentication saved.'
          );

          console.log(
            'userId:',
            this.getUserId()
          );
        })
      );
  }


  // =========================================================
  // REFRESH TOKEN
  // =========================================================
  //
  // IMPORTANT:
  //
  // This method does NOT automatically refresh the token.
  //
  // Your HttpInterceptor calls this method only when
  // an API request receives HTTP 401.
  //
  // The refresh token should be stored by the backend
  // as an HttpOnly cookie.
  //
  // =========================================================

  refreshToken(): Observable<RefreshTokenResponse> {

    console.log(
      'Refreshing access token...'
    );


    return this.http
      .post<RefreshTokenResponse>(
        `${this.authUrl}/refresh`,
        {},
        {
          /*
           * Sends the HttpOnly refresh-token cookie
           * to ASP.NET Core.
           */
          withCredentials: true
        }
      )
      .pipe(

        tap((response) => {

          console.log(
            'REFRESH RESPONSE:',
            response
          );


          if (!response?.accessToken) {

            console.error(
              'Refresh succeeded but accessToken is missing.'
            );

            return;
          }


          // -------------------------------------------------
          // Save NEW access token
          // -------------------------------------------------

          localStorage.setItem(
            'token',
            response.accessToken
          );


          // -------------------------------------------------
          // Save expiry
          // -------------------------------------------------

          if (response.expiresAt) {

            localStorage.setItem(
              'tokenExpiresAt',
              response.expiresAt
            );
          }


          console.log(
            'New access token saved.'
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
  // GET TOKEN EXPIRY
  // =========================================================

  getTokenExpiresAt(): string | null {

    return localStorage.getItem(
      'tokenExpiresAt'
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
  //
  // SignalR must be disconnected BEFORE clearing the JWT.
  //
  // =========================================================

  logout(): Observable<void> {

    console.log(
      'Starting logout...'
    );


    return new Observable<void>(
      observer => {

        // ---------------------------------------------------
        // FIRST: Stop SignalR
        // ---------------------------------------------------

        this.signalRService
          .stopConnection()

          .then(() => {

            console.log(
              'SignalR disconnected successfully.'
            );


            // ------------------------------------------------
            // SECOND: Backend logout
            // ------------------------------------------------

            this.http
              .post<void>(
                `${this.authUrl}/logout`,
                {},
                {
                  /*
                   * Sends refresh-token cookie so backend
                   * can revoke it.
                   */
                  withCredentials: true
                }
              )
              .subscribe({

                next: () => {

                  console.log(
                    'Backend logout successful.'
                  );

                  /*
                   * Clear local authentication here.
                   */
                  this.clearAuthentication();

                  observer.next();

                  observer.complete();
                },


                error: (error) => {

                  console.error(
                    'Backend logout failed:',
                    error
                  );

                  /*
                   * Even if backend logout fails,
                   * make sure the browser is logged out.
                   */
                  this.clearAuthentication();

                  /*
                   * We can still consider the local logout
                   * successful.
                   */
                  observer.next();

                  observer.complete();
                }
              });

          })

          .catch((error) => {

            console.error(
              'Failed to stop SignalR:',
              error
            );


            /*
             * Always clear authentication.
             */
            this.clearAuthentication();


            observer.next();

            observer.complete();
          });
      }
    );
  }


  // =========================================================
  // SIMPLE LOCAL LOGOUT
  // =========================================================

  async logoutLocal(): Promise<void> {

    console.log(
      'Logging out locally...'
    );


    try {

      await this.signalRService
        .stopConnection();

    } catch (error) {

      console.error(
        'SignalR disconnect error:',
        error
      );

    } finally {

      this.clearAuthentication();
    }
  }


  // =========================================================
  // CLEAR AUTHENTICATION
  // =========================================================

  clearAuthentication(): void {

    console.log(
      'Clearing authentication...'
    );


    // -------------------------------------------------------
    // LOCAL STORAGE
    // -------------------------------------------------------

    localStorage.removeItem(
      'token'
    );

    localStorage.removeItem(
      'tokenExpiresAt'
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
    // SESSION STORAGE
    // -------------------------------------------------------

    sessionStorage.removeItem(
      'token'
    );

    sessionStorage.removeItem(
      'tokenExpiresAt'
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
