import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { SessionService } from '../services/session.service';
import { APP_ROLES } from 'src/constants/app.constants';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  private sessionService = inject(SessionService);
  private router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot,
  ): boolean | UrlTree {
    // Obtener usuario de la sesión actual (desde secure storage)
    const currentUser = this.sessionService.getCurrentUser();

    // Validar que el usuario existe antes de acceder a sus propiedades
    if (!currentUser) {
      return this.router.parseUrl('/auth/login');
    }

    const requiredRoles = Array.isArray(route.data['roles'])
      ? (route.data['roles'] as string[])
      : [];
    const rol = currentUser.role;
    const isMaster = !!currentUser.is_master;

    console.log(
      'RoleGuard - usuario:',
      currentUser,
      '| is_master:',
      isMaster,
      '| roles requeridos:',
      requiredRoles,
    );

    // Ruta para Cliente
    if (requiredRoles.includes(APP_ROLES.FINAL_USER)) {
      if (rol === APP_ROLES.FINAL_USER) return true;
      // Si no es client, redirigir a su dashboard correspondiente
      if (rol === APP_ROLES.ADMIN)
        return this.router.parseUrl('/administrator/principal-administrador');
    }

    // Ruta para Administrador
    if (requiredRoles.includes(APP_ROLES.ADMIN)) {
      if (rol === APP_ROLES.ADMIN || rol === APP_ROLES.MASTER) return true;
      if (rol === APP_ROLES.FINAL_USER) {
        return this.router.parseUrl('/final-user/principal-usuariof');
      }
      return this.router.parseUrl('/auth/login');
    }

    // Ruta para Master
    if (requiredRoles.includes(APP_ROLES.MASTER)) {
      if ((rol === APP_ROLES.ADMIN && isMaster) || rol === APP_ROLES.MASTER) {
        return true;
      }
      if (rol === APP_ROLES.ADMIN) {
        return this.router.parseUrl('/administrator/principal-administrador');
      }
      if (rol === APP_ROLES.FINAL_USER) {
        return this.router.parseUrl('/final-user/principal-usuariof');
      }
      return this.router.parseUrl('/auth/login');
    }

    // Si no coincide con nada, al login
    return this.router.parseUrl('/auth/login');
  }
}
