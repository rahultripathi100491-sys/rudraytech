import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface LoginRequest {
  email?: string;
  password?: string;
}

export interface AuthResponse {
  token: string;
  userId?: string;
  email?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'https://localhost:7072/api/Auth'; // Match your ASP.NET Core port

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response) => {
        if (response?.token) {
          localStorage.setItem('Token', response.token);
        }
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem('Token');
  }

  logout(): void {
    localStorage.removeItem('Token');
  }
}