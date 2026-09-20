import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { SignalRService } from '../../services/signalr.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {

  private authService = inject(AuthService);
  private signalRService = inject(SignalRService);
  private router = inject(Router);

  email = '';
  password = '';
  rememberMe = false;
  errorMessage = '';
  isLoading = false;

  login(): void {

    if (!this.email || !this.password) {
      alert('Please enter email and password.');
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;

    // console.log('Login:', {
    //   email: this.email,
    //   password: this.password,
    //   rememberMe: this.rememberMe
    // });

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Connect to SignalR using the new JWT Token
        if (response.token) {
          this.signalRService.startConnection(response.token);
        }
        // Navigate to Chat page
        this.router.navigate(['/chat']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Invalid email or password.';
      }
    });
  }
}