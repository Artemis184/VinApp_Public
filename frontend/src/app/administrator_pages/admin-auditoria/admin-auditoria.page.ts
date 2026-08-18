import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular/standalone';
import { APP_TOAST, ACCION_TRADUCCION } from '../../../constants/app.constants';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonModal,
  IonDatetime,
  IonRadioGroup,
  IonItem,
  IonLabel,
  IonRadio,
  IonText,
  IonSpinner,
} from '@ionic/angular/standalone';
import { AdminBackHeaderComponent } from 'src/app/shared/admin-back-header/admin-back-header.component';
import { AuditoriaService } from '../services/auditoria';

@Component({
  standalone: true,
  selector: 'app-admin-auditoria',
  templateUrl: './admin-auditoria.page.html',
  styleUrls: ['./admin-auditoria.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonModal,
    IonDatetime,
    IonRadioGroup,
    IonItem,
    IonLabel,
    IonRadio,
    IonText,
    IonSpinner,
    AdminBackHeaderComponent,
  ],
  providers: [AuditoriaService],
})
export class AdminAuditoriaPage implements OnInit {
  // Estados UI
  loading = false;
  modalFechasOpen = false;
  modalAlarmaOpen = false;
  filterBarOpen = false;

  // Propiedad para restringir fechas futuras (ESTA ES LA QUE FALTABA)
  hoy: string = new Date().toISOString();

  // Filtros de búsqueda
  fechaInicioISO: string | null = null;
  fechaFinISO: string | null = null;
  alarmaSeleccionadaId: number | null = null;

  // Listas de datos dinámicos
  alarmasCatalogo: any[] = [];
  auditoriaFiltrada: any[] = [];

  constructor(
    private auditoriaService: AuditoriaService,
    private toastController: ToastController,
  ) {}

  ngOnInit() {
    this.cargarCatalogos();
    this.cargarDatos();
  }

  cargarDatos() {
    this.loading = true;

    // Formateo para el backend (YYYY-MM-DD)
    const from = this.fechaInicioISO
      ? this.fechaInicioISO.split('T')[0]
      : undefined;
    const to = this.fechaFinISO ? this.fechaFinISO.split('T')[0] : undefined;

    this.auditoriaService
      .getAuditoria(this.alarmaSeleccionadaId || undefined, from, to)
      .subscribe({
        next: (response) => {
          this.auditoriaFiltrada = (response.data || [])
            .map((item: any) => ({
              id: item.id,
              alarmaNombre: item.titulo,
              estado: ACCION_TRADUCCION[item.estado_texto] || item.estado_texto,
              direccion: item.direccion,
              usuario: item.usuario,
              fechaTexto: this.formatearFecha(item.fecha_raw),
              fechaRaw: item.fecha_raw,
              esActivacion:
                item.estado_texto === 'ACTIVADA' ||
                item.estado_texto === 'ALARM_ON',
            }))
            .sort(
              (a: any, b: any) =>
                new Date(b.fechaRaw).getTime() - new Date(a.fechaRaw).getTime(),
            );
          this.loading = false;
        },
        error: (err) => {
          console.error('Error API Auditoría:', err);
          this.loading = false;
          this.mostrarErrorToast('No se pudo cargar el historial.');
        },
      });
  }

  cargarCatalogos() {
    this.auditoriaService.getNodes().subscribe({
      next: (response) => {
        this.alarmasCatalogo = response.data.map((node: any) => ({
          id: node.id,
          nombre: `ALARMA # ${node.code}`,
          direccion: node.description || node.name,
        }));
      },
      error: (err) => {
        console.error('Error catálogo:', err);
        this.mostrarErrorToast('Error al cargar lista de alarmas.');
      },
    });
  }

  // --- Getters y Métodos de Filtros ---
  get hayFiltrosActivos(): boolean {
    return !!(
      this.fechaInicioISO ||
      this.fechaFinISO ||
      this.alarmaSeleccionadaId !== null
    );
  }
  get filtroAlarmaActivo(): boolean {
    return this.alarmaSeleccionadaId !== null;
  }
  get filtroFechasActivo(): boolean {
    return !!(this.fechaInicioISO || this.fechaFinISO);
  }

  toggleFilterBar() {
    this.filterBarOpen = !this.filterBarOpen;
  }

  limpiarFiltros() {
    this.fechaInicioISO = null;
    this.fechaFinISO = null;
    this.alarmaSeleccionadaId = null;
    this.cargarDatos();
  }

  limpiarFiltroAlarma() {
    this.alarmaSeleccionadaId = null;
    this.cargarDatos();
  }
  limpiarFiltroFechas() {
    this.fechaInicioISO = null;
    this.fechaFinISO = null;
    this.cargarDatos();
  }

  // --- Modales ---
  abrirModalFechas() {
    this.modalFechasOpen = true;
  }
  cerrarModalFechas() {
    this.modalFechasOpen = false;
  }
  aplicarFiltroFechas() {
    this.cargarDatos();
    this.modalFechasOpen = false;
  }

  abrirModalAlarma() {
    this.modalAlarmaOpen = true;
  }
  cerrarModalAlarma() {
    this.modalAlarmaOpen = false;
  }
  seleccionarAlarma() {
    this.cargarDatos();
    this.modalAlarmaOpen = false;
  }

  // --- Helpers ---
  private formatearFecha(isoString: string): string {
    return new Date(isoString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async mostrarErrorToast(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: APP_TOAST.DURATION,
      position: APP_TOAST.POSITION,
      color: 'danger',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await toast.present();
  }
}
