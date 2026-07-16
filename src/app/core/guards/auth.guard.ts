import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const authenticated = await auth.isAuthenticated();

  if (!authenticated) {
    return router.createUrlTree(['/login']);
  }

  return true;
};
