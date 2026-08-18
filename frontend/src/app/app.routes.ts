import { Routes } from '@angular/router';
import { RoleGuard } from './guards/role.guard';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./landing/landing.page').then((m) => m.LandingPage),
  },
  {
    path: 'administrator',
    loadChildren: () =>
      import('./administrator_pages/administratos.routes').then(
        (m) => m.administratorRoutes,
      ),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'MASTER'] },
  },
  {
    path: 'final-user',
    loadChildren: () =>
      import('./final_user_pages/final_user.routes').then(
        (m) => m.finalUserRoutes,
      ),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['CLIENT'] },
  },
  {
    path: 'master',
    loadChildren: () =>
      import('./master_pages/master_routes').then((m) => m.masterRoutes),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['MASTER'] },
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./shared/privacy-policy/privacy-policy.page').then(
        (m) => m.PrivacyPolicyPage,
      ),
  },
  {
    path: 'terms-conditions',
    loadComponent: () =>
      import('./shared/terms-conditions/terms-conditions.page').then(
        (m) => m.TermsConditionsPage,
      ),
  },
];
