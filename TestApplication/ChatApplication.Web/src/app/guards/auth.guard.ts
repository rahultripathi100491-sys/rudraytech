import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router
} from '@angular/router';
import { AuthService } from '../auth/auth.service';


export const authGuard: CanActivateFn = () => {
debugger;
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check whether user is logged in
  if (authService.isLoggedIn()) {
    return true;
  }

  // User is not logged in
  // Redirect to login page
  return router.createUrlTree(['/login']);
};