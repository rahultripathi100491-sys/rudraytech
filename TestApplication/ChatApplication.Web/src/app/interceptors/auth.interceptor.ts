import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';

import { inject } from '@angular/core';

import { Router } from '@angular/router';

import {
  BehaviorSubject,
  catchError,
  filter,
  switchMap,
  take,
  throwError
} from 'rxjs';

import { AuthService } from '../auth/auth.service';


// =========================================================
// REFRESH STATE
// =========================================================

let isRefreshing = false;

const refreshTokenSubject =
  new BehaviorSubject<string | null>(null);


export const authInterceptor: HttpInterceptorFn =
  (req, next) => {

    const authService =
      inject(AuthService);

    const router =
      inject(Router);


    // =====================================================
    // DON'T AUTHENTICATE AUTH REQUESTS
    // =====================================================

    if (
      req.url.includes('/Auth/login') ||
      req.url.includes('/Auth/refresh') ||
      req.url.includes('/Auth/logout')
    ) {

      return next(
        req.clone({
          withCredentials: true
        })
      );
    }


    // =====================================================
    // GET ACCESS TOKEN
    // =====================================================

    const token =
      authService.getToken();


    // =====================================================
    // ADD JWT
    // =====================================================

    const authRequest =
      token
        ? req.clone({
            setHeaders: {
              Authorization:
                `Bearer ${token}`
            }
          })
        : req;


    // =====================================================
    // SEND REQUEST
    // =====================================================

    return next(authRequest).pipe(

      catchError(
        (error: HttpErrorResponse) => {


          // ===============================================
          // ONLY HANDLE 401
          // ===============================================

          if (error.status !== 401) {

            return throwError(
              () => error
            );
          }


          // ===============================================
          // ANOTHER REQUEST IS ALREADY REFRESHING
          // ===============================================

          if (isRefreshing) {

            return refreshTokenSubject.pipe(

              filter(
                newToken =>
                  newToken !== null
              ),

              take(1),

              switchMap(
                newToken => {

                  const retryRequest =
                    req.clone({
                      setHeaders: {
                        Authorization:
                          `Bearer ${newToken}`
                      }
                    });

                  return next(
                    retryRequest
                  );
                }
              )
            );
          }


          // ===============================================
          // START REFRESH
          // ===============================================

          isRefreshing = true;

          refreshTokenSubject.next(
            null
          );


          // ===============================================
          // CALL REFRESH API
          // ===============================================

          return authService
            .refreshToken()

            .pipe(

              switchMap(
                response => {

                  const newToken =
                    response.accessToken;


                  // ---------------------------------------
                  // Refresh completed
                  // ---------------------------------------

                  isRefreshing = false;


                  // ---------------------------------------
                  // Notify waiting requests
                  // ---------------------------------------

                  refreshTokenSubject.next(
                    newToken
                  );


                  // ---------------------------------------
                  // Retry original request
                  // ---------------------------------------

                  const retryRequest =
                    req.clone({
                      setHeaders: {
                        Authorization:
                          `Bearer ${newToken}`
                      }
                    });


                  return next(
                    retryRequest
                  );
                }
              ),


              // =========================================
              // REFRESH FAILED
              // =========================================

              catchError(
                refreshError => {

                  console.error(
                    'Refresh token failed:',
                    refreshError
                  );


                  isRefreshing = false;


                  refreshTokenSubject.next(
                    null
                  );


                  // ---------------------------------------
                  // Logout
                  // ---------------------------------------

                  authService
                    .clearAuthentication();


                  // ---------------------------------------
                  // Go to login
                  // ---------------------------------------

                  router.navigate([
                    '/login'
                  ]);


                  return throwError(
                    () => refreshError
                  );
                }
              )
            );
        }
      )
    );
  };
