import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MenuService } from 'src/app/services/menu.service';
import { UsuPendientesService } from '../../../services/usu-pendientes';
import { AUTH_STORAGE } from 'src/constants/app.constants';

import {
  IonMenu,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonMenuToggle,
} from '@ionic/angular/standalone';

@Component({
  standalone: true,
  selector: 'app-admin-side-menu',
  templateUrl: './admin-side-menu-component.html',
  styleUrls: ['./admin-side-menu-component.scss'],
  imports: [
    CommonModule,

    // Angular Router
    RouterLink,

    // Ionic
    IonMenu,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonMenuToggle,
  ],
})
export class AdminSideMenuComponent implements OnInit, OnChanges {
  @Input() solicitudesCount = 0;
  @Input() userId: string | null = null; // 👈 Input para detectar cambio de usuario
  menus: any[] = [];

  private menuService = inject(MenuService);
  private usuariosService = inject(UsuPendientesService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    // Cargar menús la primera vez y cargar el contador de pendientes
    this.loadMenus();
    this.cargarCantidadPendientes();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Si userId cambió (cambio de usuario), recarga los menús y el contador
    if (changes['userId'] && !changes['userId'].firstChange) {
      this.loadMenus();
      this.cargarCantidadPendientes();
    }
  }

  private loadMenus() {
    // Si no hay usuario logeado, no cargar menús (evita peticiones sin token)
    const userStr = localStorage.getItem(AUTH_STORAGE.USER);
    if (!userStr) {
      this.menus = [];
      return;
    }

    let user = null;
    try {
      user = userStr ? JSON.parse(userStr) : null;
    } catch {
      user = null;
    }

    // Si el parsing falló, también limpiar
    if (!user) {
      this.menus = [];
      return;
    }

    const role = localStorage.getItem(AUTH_STORAGE.ROLE) || 'CLIENT';

    this.menuService.getMenusForRoleName(role).subscribe({
      next: (ms) => {
        this.menus = ms;
      },
      error: (err) => {
        console.error('[AdminSideMenu] Error cargando menús:', err);
        this.menus = [];
      },
    });
  }

  private cargarCantidadPendientes() {
    this.usuariosService
      .getCantidadPendientes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count) => {
          this.solicitudesCount = count ?? 0;
        },
        error: () => {
          this.solicitudesCount = 0;
        },
      });
  }
}
