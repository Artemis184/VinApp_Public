import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { SessionService } from '../services/session.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private sessionService = inject(SessionService);
  private router = inject(Router);

  async canActivate(): Promise<boolean | UrlTree> {
    // Verificar sesión en memoria
    let session = this.sessionService.getCurrentSession();

    // Si no hay sesión, intentar restaurar (p. ej. al refrescar la app)
    if (!session) {
      try {
        const restored = await this.sessionService.restoreSession();
        session = restored ?? null;
      } catch {
        session = null;
      }
    }

    if (!session) {
      return this.router.parseUrl('/auth/login');
    }

    return true;
  }
}
