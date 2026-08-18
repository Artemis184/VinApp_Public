import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'account_recovery',
    loadComponent: () =>
      import('./account-recovery/account-recovery.page').then(
        (m) => m.AccountRecoveryPage,
      ),
  },
  {
    path: 'reset_password',
    loadComponent: () =>
      import('./reset-password/reset-password.page').then(
        (m) => m.ResetPasswordPage,
      ),
  },
];
