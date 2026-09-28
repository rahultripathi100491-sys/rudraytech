import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../auth.service';
import { RegisterRequest } from '../../models/registerrequest';
import { RegisterResponse } from '../../models/registerresponse';
import { User } from '../../models/user';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent {

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  acceptTerms = false;

  isLoading = false;

  successMessage = '';
  errorMessage = '';

  // -----------------------------------------
  // Registration Form
  // -----------------------------------------

  registerForm = this.fb.nonNullable.group({

    firstName: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50)
      ]
    ],

    lastName: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50)
      ]
    ],

    email: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.maxLength(100)
      ]
    ],

    phoneNumber: [
    '',
    [
      Validators.required,
      Validators.pattern(/^[0-9]{10}$/)
    ]
  ],

    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(100)
      ]
    ],

    confirmPassword: [
      '',
      [
        Validators.required
      ]
    ]

  });

  // -----------------------------------------
  // Form Controls
  // -----------------------------------------

  get firstName() {
    return this.registerForm.controls.firstName;
  }

  get lastName() {
    return this.registerForm.controls.lastName;
  }

  get email() {
    return this.registerForm.controls.email;
  }

  get phoneNumber() {
    return this.registerForm.controls.phoneNumber;
  }

  get password() {
    return this.registerForm.controls.password;
  }

  get confirmPassword() {
    return this.registerForm.controls.confirmPassword;
  }

  // -----------------------------------------
  // Register
  // -----------------------------------------

  register(): void {

    this.successMessage = '';
    this.errorMessage = '';

    // Check form validation
    if (this.registerForm.invalid) {

      this.registerForm.markAllAsTouched();

      return;
    }

    // Check terms
    if (!this.acceptTerms) {

      this.errorMessage =
        'Please accept the terms and conditions.';

      return;
    }

    const formValue =
      this.registerForm.getRawValue();

    // Check passwords
    if (
      formValue.password !==
      formValue.confirmPassword
    ) {

      this.errorMessage =
        'Passwords do not match.';

      this.confirmPassword.markAsTouched();

      return;
    }

    // -----------------------------------------
    // Create User
    // -----------------------------------------

    const user: User = {

      firstName:
        formValue.firstName.trim(),

      lastName:
        formValue.lastName.trim(),

      phoneNumber:
    formValue.phoneNumber.trim(),

      email:
        formValue.email.trim().toLowerCase(),

      password:
        formValue.password,

      isEmailConfirmed:
        false,

      profileImage:
        '',

      isActive:
        false,

      // IMPORTANT:
      // Do NOT use an empty string here.
      joinedDate:
        new Date().toISOString(),

      isOnLine:
        false,

      lastSeen:
        new Date().toISOString()
    };

    // -----------------------------------------
    // Create RegisterRequest
    // -----------------------------------------

    const request: RegisterRequest = {
      user: user
    };

    console.log('Register request:', request);

    this.isLoading = true;

    // -----------------------------------------
    // Call API
    // -----------------------------------------

    this.authService.register(request).subscribe({

      next: (response: RegisterResponse) => {

        this.isLoading = false;

        this.successMessage =
          response.message ||
          'Registration successful.';

        this.registerForm.reset();

        this.acceptTerms = false;

        // Go to login after successful registration
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },

      error: (error) => {

        this.isLoading = false;

        console.error(
          'Registration error:',
          error
        );

        // -----------------------------------------
        // 400 Validation Error
        // -----------------------------------------

        if (error.status === 400) {

          // ASP.NET validation response
          if (error.error?.errors) {

            const validationErrors =
              error.error.errors;

            const messages: string[] = [];

            for (const key of Object.keys(validationErrors)) {

              const errors =
                validationErrors[key];

              if (Array.isArray(errors)) {
                messages.push(...errors);
              }
            }

            this.errorMessage =
              messages.length > 0
                ? messages.join(' ')
                : 'Invalid registration information.';

          } else {

            this.errorMessage =
              error.error?.message ||
              'Invalid registration information.';
          }

          return;
        }

        // -----------------------------------------
        // 409 Conflict
        // -----------------------------------------

        if (error.status === 409) {

          this.errorMessage =
            'Email address is already registered.';

          return;
        }

        // -----------------------------------------
        // Server unavailable
        // -----------------------------------------

        if (error.status === 0) {

          this.errorMessage =
            'Unable to connect to the server. Please try again.';

          return;
        }

        // -----------------------------------------
        // Other error
        // -----------------------------------------

        this.errorMessage =
          error.error?.message ||
          'Something went wrong. Please try again.';
      }
    });
  }

  // -----------------------------------------
  // Go To Login
  // -----------------------------------------

  goToLogin(): void {

    this.router.navigate(['/login']);

  }
}
