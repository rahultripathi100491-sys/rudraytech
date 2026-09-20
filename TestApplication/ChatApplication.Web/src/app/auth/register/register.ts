import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent {

  private router = inject(Router);

  userName = '';
  email = '';
  password = '';
  confirmPassword = '';
  acceptTerms = false;

  register(): void {

    if (
      !this.userName ||
      !this.email ||
      !this.password ||
      !this.confirmPassword
    ) {
      alert('Please fill all required fields.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    if (!this.acceptTerms) {
      alert('Please accept the terms and conditions.');
      return;
    }

    // TODO:
    // Call ASP.NET Core registration API here.

    console.log({
      userName: this.userName,
      email: this.email,
      password: this.password
    });

    // Temporary navigation
    this.router.navigate(['/login']);
  }

  goToLogin(): void {
    this.router.navigate(['../login']);
  }
}