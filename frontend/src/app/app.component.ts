import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { NgIf } from '@angular/common';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AdminSideMenuComponent } from './administrator_pages/principal-administrador/components/admin-side-menu-component/admin-side-menu-component';
import { AUTH_STORAGE, APP_ROLES } from '../constants/app.constants';
import { AuthService } from './auth/services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [NgIf, IonApp, IonRouterOutlet, AdminSideMenuComponent],
})
export class AppComponent implements OnInit {
  isAdmin = false;
  currentUserId: string | null = null;
  private isAdminUpdateQueued = false;
  private readonly adminPrefixes = [
    '/administrator/principal-administrador',
    '/administrator/listado-pendientes-acciones',
    '/administrator/listado-usuarios',
    '/administrator/lista-alarmas',
    '/administrator/admin-auditoria',
    '/master/',
  ];

  private router = inject(Router);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  async ngOnInit() {
    if (Capacitor.isNativePlatform()) {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });
    }

    this.authService.userData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((userData) => {
        if (userData) {
          this.currentUserId = userData.uuid ?? this.currentUserId;
        }
        this.updateAdminStatus(userData?.role ?? null);
      });

    this.updateCurrentUserId();
    this.updateAdminStatus();

    // Escucha cambios de navegación para actualizar usuario, validar permisos
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ev) => {
        if (ev instanceof NavigationEnd) {
          this.updateCurrentUserId();
          this.updateAdminStatus();
        }
      });
  }

  private updateCurrentUserId() {
    const userStr = localStorage.getItem(AUTH_STORAGE.USER);
    try {
      const user = userStr ? JSON.parse(userStr) : null;
      this.currentUserId = user?.usr_uuid || null;
    } catch {
      this.currentUserId = null;
    }
  }

  private updateAdminStatus(roleOverride?: string | null) {
    const role = this.normalizarRol(
      roleOverride ?? localStorage.getItem(AUTH_STORAGE.ROLE),
    );

    const isRoleAdmin = role === APP_ROLES.ADMIN || role === APP_ROLES.MASTER;
    const isAdminPath = this.adminPrefixes.some((p) =>
      this.router.url.startsWith(p),
    );
    const nextIsAdmin = isRoleAdmin && isAdminPath;

    if (this.isAdmin === nextIsAdmin || this.isAdminUpdateQueued) {
      return;
    }

    this.isAdminUpdateQueued = true;
    queueMicrotask(() => {
      this.isAdmin = nextIsAdmin;
      this.isAdminUpdateQueued = false;
    });
  }

  private normalizarRol(role: string | null | undefined): string | null {
    return role ? role.toUpperCase() : null;
  }
}
