import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonSpinner,
  ModalController,
  IonBadge,
  IonList,
  IonFab,
  IonFabButton,
  ToastController,
  IonButtons,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { Usuario } from 'src/app/interfaces/usuario.interface';
import { AdminEditusuarioPage } from '../admin-editusuario/admin-editusuario.page';
import { Notificaciones } from 'src/app/administrator_pages/services/notificaciones';
import { AdminUsuarios } from 'src/app/administrator_pages/services/admin-usuarios';
import { AdminAlarmasModalPage } from '../admin-alarmas-modal/admin-alarmas-modal.page';
import { UserNodes } from '../services/user-nodes';

// IMPORTACIÓN DE TUS CONSTANTES Y FUNCIONES GLOBALES
import {
  USUARIO_ESTADOS,
  getEstadoUsuarioColor,
  APP_TOAST,
  MODAL_ROLES,
  VALORES_TRADUCCION,
} from 'src/constants/app.constants';

@Component({
  selector: 'app-admin-detusuario',
  templateUrl: './admin-detusuario.page.html',
  styleUrls: ['./admin-detusuario.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonButtons,
    IonTitle,
    IonToolbar,
    IonItem,
    IonLabel,
    IonList,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonBadge,
    IonButton,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner,
    IonFab,
    IonFabButton,
  ],
})
export class AdminDetusuarioPage implements OnInit {
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private notificacionesService = inject(Notificaciones);
  private adminUsuariosService = inject(AdminUsuarios);
  private userNodesService = inject(UserNodes);

  @Input() usuario!: Usuario;

  estadoSeleccionado!: string;
  readonly STATUS_APPROVED = 'APPROVED';
  readonly STATUS_SUSPENDED = 'SUSPENDED';
  readonly ESTADOS_PERMITIDOS = [this.STATUS_APPROVED, this.STATUS_SUSPENDED];
  private usuarioOriginalRespaldado!: Usuario;

  realSelectedIds: number[] = [];
  private estadoOriginal!: string;
  private fueActualizado = false;
  private cambiosDatosPersonales: any = null;
  private huboCambiosEnDatosPersonales = false;

  private huboCambiosEnAlarmas = false;
  guardando = false;

  ngOnInit() {
    this.usuarioOriginalRespaldado = JSON.parse(JSON.stringify(this.usuario));
    this.estadoSeleccionado = this.usuario.status;
    this.estadoOriginal = this.usuario.status;
    this.cargarAlarmasReales();
  }
  /**
   * Obtiene la clase de color (verde o rojo) usando tu función global getEstadoUsuarioColor
   */
  get claseColorEstado(): string {
    const color = getEstadoUsuarioColor(this.estadoSeleccionado);
    if (color === 'success') return 'select-verde';
    if (color === 'danger') return 'select-rojo';
    return '';
  }

  get estadosFiltrados() {
    return USUARIO_ESTADOS.filter((estado) =>
      this.ESTADOS_PERMITIDOS.includes(estado.value),
    );
  }

  cargarAlarmasReales() {
    const userId = String(this.usuario.id);
    this.userNodesService.getNodesByUserId(userId).subscribe({
      next: (ids) => {
        this.realSelectedIds = ids;
      },
      error: (err) => console.warn('Error al cargar alarmas reales:', err),
    });
  }

  async abrirAlarmas() {
    // CORRECCIÓN: Acceso seguro a VALORES_TRADUCCION
    if (this.estadoSeleccionado === this.STATUS_SUSPENDED) {
      const estadoTexto =
        VALORES_TRADUCCION[this.STATUS_SUSPENDED] || this.STATUS_SUSPENDED;
      await this.mostrarToast(
        `Un usuario ${estadoTexto} no puede tener alarmas asignadas`,
        'warning',
      );
      return;
    }

    const modal = await this.modalCtrl.create({
      component: AdminAlarmasModalPage,
      componentProps: { selectedIds: [...this.realSelectedIds] },
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();

    if (data?.ids) {
      this.realSelectedIds = [...data.ids];
      this.huboCambiosEnAlarmas = true;
    }
  }

  // admin-detusuario.page.ts

  async guardar() {
    this.guardando = true;
    try {
      const userId = String(this.usuario.id);
      const payload: any = {};

      // 1. Unificar cambios
      if (this.estadoSeleccionado !== this.estadoOriginal) {
        payload.status = this.estadoSeleccionado;
      }

      if (this.huboCambiosEnDatosPersonales) {
        Object.assign(payload, this.cambiosDatosPersonales);
      }

      // 2. Petición a la base de datos
      if (Object.keys(payload).length > 0) {
        await firstValueFrom(
          this.adminUsuariosService.updateUser(userId, payload),
        );

        if (payload.status) {
          await this.notificacionesService.notificarCambioEstado(
            userId,
            this.estadoOriginal,
            this.estadoSeleccionado,
          );

          // 🔥 CRUCIAL: Actualiza el objeto usuario LOCALMENTE
          // Si no haces esto, la lista recibe el 'status' antiguo.
          this.usuario.status = this.estadoSeleccionado as any;
          this.estadoOriginal = this.estadoSeleccionado;
        }
      }

      // 3. Sincronizar alarmas
      if (this.huboCambiosEnAlarmas) {
        await firstValueFrom(
          this.userNodesService.assignNodesToUser(userId, this.realSelectedIds),
        );
      }

      await this.mostrarToast('Todo se guardó correctamente', 'success');

      // RESET de banderas
      this.huboCambiosEnDatosPersonales = false;
      this.huboCambiosEnAlarmas = false;

      // 🚀 Ahora 'this.usuario' lleva el status actualizado a la lista principal
      await this.modalCtrl.dismiss(
        { actualizado: true, usuario: { ...this.usuario } },
        MODAL_ROLES.CONFIRMAR,
      );
    } catch (error: any) {
      this.mostrarToast(error.error?.message || 'Error al guardar', 'danger');
    } finally {
      this.guardando = false;
    }
  }
  // Dentro de tu componente de Detalle (el primero que mostraste)
  // AdminDetalleUsuarioPage.ts
  async editar() {
    const modal = await this.modalCtrl.create({
      component: AdminEditusuarioPage,
      componentProps: { usuario: { ...this.usuario } },
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();

    if (data && data.cambiosPendientes) {
      // 🌟 ACTUALIZACIÓN LOCAL (SOLO EN EL CUADRO)
      this.usuario = { ...this.usuario, ...data.nuevosDatos };
      this.cambiosDatosPersonales = data.nuevosDatos;
      this.huboCambiosEnDatosPersonales = true;
      this.fueActualizado = true; // Para avisar al listado al cerrar
    }
  }
  cerrar() {
    this.modalCtrl.dismiss({
      actualizado: false,
      usuario: this.usuarioOriginalRespaldado,
    });
  }

  private async mostrarToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: APP_TOAST.DURATION,
      position: APP_TOAST.POSITION,
    });
    await toast.present();
  }

  onEstadoChange() {
    if (
      this.estadoSeleccionado === 'SUSPENDED' &&
      this.realSelectedIds.length > 0
    ) {
      this.realSelectedIds = [];
      this.huboCambiosEnAlarmas = true; // Forzamos la sincronización al guardar
      this.mostrarToast(
        'Se han removido las alarmas automáticamente al suspender al usuario',
        'warning',
      );
    }
  }
}
