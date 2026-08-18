import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/services/auth.service';
import { ModalController } from '@ionic/angular/standalone';
import { MenuGeneralComponent } from 'src/app/shared/menu-general/menu-general.component';
import { APP_ROLES, AUTH_STORAGE } from 'src/constants/app.constants';
import { MenuGeneralUserInput } from '../menu-general/interfaces/datos_usuario.interface';

@Component({
  standalone: true,
  selector: 'app-admin-back-header',
  templateUrl: './admin-back-header.component.html',
  styleUrls: ['./admin-back-header.component.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
  ],
})
export class AdminBackHeaderComponent {
  /** Texto del título */
  @Input() title = '';

  /** Mostrar menú de usuario */
  @Input() showUserMenu = true;

  /** Ruta por defecto del botón atrás */
  @Input() defaultHref = '/administrator/principal-administrador';

  /** Control popup usuario */
  userMenuOpen = false;

  /** Router para navegación */
  private router = inject(Router);
  private authService = inject(AuthService);
  private modalCtrl = inject(ModalController);
  private readonly homeRoutes = {
    admin: '/administrator/principal-administrador',
    finalUser: '/final-user/principal-usuariof',
  } as const;

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
