import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  ModalController,
  IonSpinner,
  IonText,
  IonCard,
  IonItem,
  IonLabel,
  IonBadge,
  IonIcon,
  IonButton,
  IonInput,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AdminUsuarios } from 'src/app/administrator_pages/services/admin-usuarios';
import { Usuario } from 'src/app/interfaces/usuario.interface';
import { AdminDetusuarioPage } from '../admin-detusuario/admin-detusuario.page';
import { AdminBackHeaderComponent } from 'src/app/shared/admin-back-header/admin-back-header.component';
import {
  APP_DEBOUNCE,
  getEstadoTraducido,
  getEstadoUsuarioColor,
  USUARIO_ESTADOS,
} from 'src/constants/app.constants';

@Component({
  selector: 'app-admin-usuarios',
  templateUrl: './admin-usuarios.page.html',
  styleUrls: ['./admin-usuarios.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    AdminBackHeaderComponent,
    IonSpinner,
    IonText,
    IonCard,
    IonItem,
    IonLabel,
    IonBadge,
    IonIcon,
    IonButton,
    IonInput,
    IonSelect,
    IonSelectOption,
  ],
})
export class AdminUsuariosPage implements OnDestroy {
  private adminUsuarios = inject(AdminUsuarios);
  private modalCtrl = inject(ModalController);

  getEstadoUsuarioColor = getEstadoUsuarioColor;
  getEstadoTraducido = getEstadoTraducido;
  USUARIO_ESTADOS = USUARIO_ESTADOS;

  // UI State
  cargando = false;
  filterBarOpen = false;

  // Data
  usuarios: Usuario[] = [];
  usuariosFiltrados: Usuario[] = [];

  // Filtros
  filtroNombre = '';
  filtroEmail = '';
  filtroEstado: string | null = null;
  private filtrosDebounceSubject = new Subject<{
    nombre: string;
    email: string;
  }>();

  constructor() {
    // Setup debounce para filtros de texto (nombre y email)
    this.filtrosDebounceSubject
      .pipe(
        debounceTime(APP_DEBOUNCE.SEARCH_FILTER_MS),
        distinctUntilChanged(
          (prev, curr) =>
            prev.nombre === curr.nombre && prev.email === curr.email,
        ),
      )
      .subscribe((_termino) => {
        this.aplicarFiltros();
      });
  }

  ngOnDestroy() {
    this.filtrosDebounceSubject.complete();
  }

  ionViewWillEnter() {
    this.recuperarUsuarios();
  }

  recuperarUsuarios() {
    this.cargando = true;

    this.adminUsuarios.getUsuarios().subscribe({
      next: (data) => {
        this.usuarios = data;
        this.aplicarFiltros();
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar usuarios:', err);
        this.usuarios = [];
        this.usuariosFiltrados = [];
        this.cargando = false;
      },
    });
  }

  /**
   * Aplica todos los filtros activos a la lista de usuarios
   */
  aplicarFiltros() {
    const terminoNombre = this.normalizarTexto(this.filtroNombre);
    const terminoEmail = this.normalizarTexto(this.filtroEmail);

    this.usuariosFiltrados = this.usuarios.filter((usuario) => {
      // Filtro por nombre/apodo
      const nombreCoincide =
        !terminoNombre ||
        this.normalizarTexto(usuario.full_name).includes(terminoNombre) ||
        this.normalizarTexto(usuario.apodo).includes(terminoNombre);

      // Filtro por email
      const emailCoincide =
        !terminoEmail ||
        this.normalizarTexto(usuario.email).includes(terminoEmail);

      // Filtro por estado
      const estadoCoincide =
        !this.filtroEstado || usuario.status === this.filtroEstado;

      return nombreCoincide && emailCoincide && estadoCoincide;
    });
  }

  private normalizarTexto(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Maneja el cambio en el input de búsqueda por nombre
   */
  onNombreChange(evento: any) {
    this.filtroNombre = evento.detail.value || '';
    this.filtrosDebounceSubject.next({
      nombre: this.filtroNombre,
      email: this.filtroEmail,
    });
  }

  /**
   * Maneja el cambio en el input de email
   */
  onEmailChange(evento: any) {
    this.filtroEmail = evento.detail.value || '';
    this.filtrosDebounceSubject.next({
      nombre: this.filtroNombre,
      email: this.filtroEmail,
    });
  }

  /**
   * Maneja el cambio en el select de estado
   */
  onEstadoChange() {
    this.aplicarFiltros();
  }

  /**
   * Verifica si hay filtros activos
   */
  get hayFiltrosActivos(): boolean {
    return !!(this.filtroNombre || this.filtroEmail || this.filtroEstado);
  }

  /**
   * Limpia todos los filtros
   */
  limpiarFiltros() {
    this.filtroNombre = '';
    this.filtroEmail = '';
    this.filtroEstado = null;
    this.aplicarFiltros();
  }

  /**
   * Alterna la barra de filtros
   */
  toggleFilterBar() {
    this.filterBarOpen = !this.filterBarOpen;
  }

  // En admin-usuarios.page.ts

  async abrirUsuario(usuario: Usuario) {
    try {
      const usuarioCompleto = await firstValueFrom(
        this.adminUsuarios.getUserById(usuario.id),
      );

      const modal = await this.modalCtrl.create({
        component: AdminDetusuarioPage,
        componentProps: {
          usuario: { ...usuarioCompleto },
        },
        backdropDismiss: false,
      });

      await modal.present();
      const { data } = await modal.onDidDismiss();

      // 🛡️ ACTUALIZACIÓN LÓGICA
      // Si data.actualizado es false, data.usuario traerá el snapshot original.
      // Si es true, traerá el objeto guardado. En ambos casos, limpiar la UI.
      if (data && data.usuario) {
        const index = this.usuarios.findIndex((u) => u.id == data.usuario.id);

        if (index !== -1) {
          // Reemplazamos con lo que sea que devolvió el modal (real o revertido)
          this.usuarios[index] = { ...data.usuario };
          this.usuarios = [...this.usuarios]; // Gatillo para detección de cambios
          this.aplicarFiltros();
        }
      }
    } catch (err) {
      console.error('Error al abrir detalle:', err);
    }
  }
}
