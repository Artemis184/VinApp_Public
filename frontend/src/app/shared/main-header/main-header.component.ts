import { Component, Input, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { ModalController } from '@ionic/angular/standalone';
import { MenuGeneralComponent } from 'src/app/shared/menu-general/menu-general.component';
import { MenuGeneralProfileService } from 'src/app/shared/menu-general/services/menu-general-profile.service';
import { APP_ROLES, AUTH_STORAGE } from 'src/constants/app.constants';
import { MenuGeneralUserInput } from '../menu-general/interfaces/datos_usuario.interface';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-main-header',
  templateUrl: './main-header.component.html',
  styleUrls: ['./main-header.component.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonButton,
    IonIcon,
  ],
})
export class MainHeaderComponent {
  /** Texto del título */
  @Input() title = '';

  /** Mostrar menú lateral (admin) */
  @Input() showMenu = false;

  /** Mostrar menú de usuario */
  @Input() showUserMenu = true;

  /** Control popup usuario */
  userMenuOpen = false;
  avatarUrl: string | null = null;
  avatarLoadError = false;

  /** Router para navegación */
  private router = inject(Router);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private profileService = inject(MenuGeneralProfileService);

  private modalCtrl = inject(ModalController);
  private readonly homeRoutes = {
    admin: '/administrator/principal-administrador',
    finalUser: '/final-user/principal-usuariof',
  } as const;

  constructor() {
    void this.cargarAvatar();
    this.authService.userData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.cargarAvatar());
  }

  private async cargarAvatar() {
    const rawUser = localStorage.getItem(AUTH_STORAGE.USER);

    try {
      const user = rawUser ? JSON.parse(rawUser) : null;
      const profilePhoto = user?.profile_photo || user?.foto || null;
      this.avatarUrl = typeof profilePhoto === 'string' ? profilePhoto : null;

      const response = await firstValueFrom(this.profileService.getMyProfile());
      const profile = response?.data;
      if (profile) {
        this.avatarUrl =
          profile.profile_photo ||
          (profile.avatar_base64 && profile.avatar_mime_type
            ? `data:${profile.avatar_mime_type};base64,${profile.avatar_base64}`
            : null);
      }
    } catch {
      this.avatarUrl = null;
    }
  }

  onAvatarError() {
    this.avatarLoadError = true;
  }

  toggleUserMenu() {
    this.userMenuOpen = !this.userMenuOpen;
  }

  async verCuenta() {
    this.userMenuOpen = false;
    const { usuario, esGoogle } = this.obtenerContextoPerfil();

    const modal = await this.modalCtrl.create({
      component: MenuGeneralComponent,
      componentProps: {
        usuario,
        esGoogle,
      },
    });

    await modal.present();
    const result = await modal.onDidDismiss<{
      avatarUrl?: string | null;
    }>();
    if (result.data && 'avatarUrl' in result.data) {
      this.avatarUrl = result.data.avatarUrl || null;
      this.avatarLoadError = false;
    }
  }

  goHome() {
    this.userMenuOpen = false;
    const role = this.obtenerRolActual();

    if (role === APP_ROLES.ADMIN || role === APP_ROLES.MASTER) {
      this.router.navigateByUrl(this.homeRoutes.admin);
    } else {
      this.router.navigateByUrl(this.homeRoutes.finalUser);
    }
  }

  logout() {
    this.userMenuOpen = false;

    // Flujo centralizado: el servicio limpia sesión y redirige a login.
    this.authService.logout().subscribe();
  }

  private obtenerContextoPerfil(): {
    usuario: MenuGeneralUserInput | null;
    esGoogle: boolean;
  } {
    const usuarioRaw = localStorage.getItem(AUTH_STORAGE.USER);
    const usuario = this.parsearUsuario(usuarioRaw);

    return {
      usuario,
      esGoogle: localStorage.getItem(AUTH_STORAGE.IS_GOOGLE) === 'true',
    };
  }

  private obtenerRolActual(): string {
    const role = localStorage.getItem(AUTH_STORAGE.ROLE)?.toUpperCase();
    return role || APP_ROLES.FINAL_USER;
  }

  private parsearUsuario(raw: string | null): MenuGeneralUserInput | null {
    if (!raw) return null;

    try {
      return JSON.parse(raw) as MenuGeneralUserInput;
    } catch {
      return null;
    }
  }
}
