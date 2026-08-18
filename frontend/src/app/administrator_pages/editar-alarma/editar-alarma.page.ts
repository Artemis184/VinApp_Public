import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonToggle,
  IonButton,
  IonImg,
  IonCard,
  IonBadge,
  IonChip,
  IonGrid,
  IonRow,
  IonCol,
  ToastController,
} from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { Subject, of } from 'rxjs';
import { takeUntil, switchMap, finalize } from 'rxjs/operators';

import { Alarmas, Alarma } from 'src/app/administrator_pages/services/alarmas';
import { AdminBackHeaderComponent } from 'src/app/shared/admin-back-header/admin-back-header.component';
import { environment } from 'src/environments/environment.prod';

@Component({
  selector: 'app-editar-alarma',
  templateUrl: './editar-alarma.page.html',
  styleUrls: ['./editar-alarma.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    AdminBackHeaderComponent,
    IonCard,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonToggle,
    IonButton,
    IonImg,
    IonBadge,
    IonChip,
    IonGrid,
    IonRow,
    IonCol,
  ],
})
export class EditarAlarmaPage implements OnInit, OnDestroy {
  alarma?: Alarma;

  previewImg: string | null = null;
  private imagenOriginal = '';
  private isEnabledOriginal = false;

  selectedFile: File | null = null;

  guardando = false;

  private route = inject(ActivatedRoute);
  private alarmasService = inject(Alarmas);
  private toastCtrl = inject(ToastController);
  private navCtrl = inject(NavController);
  private destroy$ = new Subject<void>();

  ngOnInit() {
    const rawId = this.route.snapshot.paramMap.get('id');
    const id = Number(rawId);

    if (!rawId || Number.isNaN(id)) {
      this.toast('ID inválido', 'danger');
      this.navCtrl.back();
      return;
    }

    this.alarmasService
      .getAlarmaById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const encontrada = response.data;
          if (!encontrada) {
            this.toast('No existe esa alarma', 'danger');
            this.navCtrl.back();
            return;
          }

          this.alarma = { ...encontrada };
          this.imagenOriginal = encontrada.installation_image || '';
          this.isEnabledOriginal = encontrada.is_enabled;
          this.previewImg = encontrada.installation_image
            ? `${environment.apiUrl.replace('/api', '')}${encontrada.installation_image}`
            : null;
        },
        error: (error) => {
          console.error('Error al cargar alarma:', error);
          this.toast('Error al cargar la alarma', 'danger');
          this.navCtrl.back();
        },
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  colorHabilitada(): string {
    return this.alarma?.is_enabled ? 'primary' : 'medium';
  }
  textoHabilitada(): string {
    return this.alarma?.is_enabled ? 'Habilitada' : 'Deshabilitada';
  }

  puedeGuardar(): boolean {
    if (!this.alarma) return false;

    const nameOk = this.alarma.name.trim().length > 0;
    const descOk = (this.alarma.description ?? '').trim().length > 0;
    const locOk = (this.alarma.location ?? '').trim().length > 0;
    const rfOk = (this.alarma.rf_address ?? '').trim().length > 0;

    return nameOk && descOk && locOk && rfOk && !this.guardando;
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      await this.toast('Selecciona un archivo de imagen', 'warning');
      return;
    }

    const maxBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxBytes) {
      await this.toast('La imagen es muy grande (máx 2MB)', 'warning');
      return;
    }

    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewImg = String(reader.result);
    };
    reader.readAsDataURL(file);

    input.value = '';
  }

  cancelar() {
    this.navCtrl.back();
  }

  async guardar() {
    if (!this.alarma) return;

    const name = this.alarma.name.trim();
    const code = this.alarma.code.trim().toUpperCase();
    const description = (this.alarma.description ?? '').trim();
    const location = (this.alarma.location ?? '').trim();
    const rf_address = (this.alarma.rf_address ?? '').trim();

    // validar campos vacíos
    const faltantes: string[] = [];
    if (!name) faltantes.push('Nombre');
    if (!description) faltantes.push('Descripción');
    if (!location) faltantes.push('Ubicación');
    if (!rf_address) faltantes.push('RF Address');

    if (faltantes.length > 0) {
      await this.toast(`Completa: ${faltantes.join(', ')}`, 'warning');
      return;
    }

    this.guardando = true;

    // Guardar si hubo cambios en is_enabled
    const hasEnabledChanged = this.alarma.is_enabled !== this.isEnabledOriginal;
    const shouldEnable = this.alarma.is_enabled;

    // 1. Actualizar datos de la alarma
    // 2. Luego, si cambió is_enabled, ejecutar habilitación/deshabilitación

    const formData = new FormData();
    formData.append('name', name);
    formData.append('code', code);
    formData.append('description', description);
    formData.append('location', location);
    formData.append('rf_address', rf_address);

    // 👉 Solo si el usuario seleccionó nueva imagen
    if (this.selectedFile) {
      formData.append('image', this.selectedFile);
    }

    this.alarmasService
      .actualizarAlarma(this.alarma.id, formData)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((_response) => {
          // Si no cambió is_enabled, completar inmediatamente
          if (!hasEnabledChanged) {
            return of(null); // Observable completado
          }
          // Si cambió, ejecutar habilitación/deshabilitación
          return shouldEnable
            ? this.alarmasService.habilitarAlarma(this.alarma!.id)
            : this.alarmasService.deshabilitarAlarma(this.alarma!.id);
        }),
        finalize(() => {
          this.guardando = false;
        }),
      )
      .subscribe({
        next: async () => {
          if (!hasEnabledChanged) {
            // Sin cambio en estado, solo se guardaron los datos
            await this.toast('Alarma guardada correctamente', 'success');
          } else if (shouldEnable) {
            // Habilitada
            await this.toast(
              'Alarma guardada y habilitada correctamente',
              'success',
            );
          } else {
            // Deshabilitada
            await this.toast(
              'Alarma guardada y deshabilitada correctamente',
              'success',
            );
          }
          this.navCtrl.back();
        },
        error: async (error) => {
          console.error('Error al guardar alarma:', error);
          if (!hasEnabledChanged) {
            await this.toast('Ocurrió un error al guardar', 'danger');
          } else if (shouldEnable) {
            await this.toast(
              'Alarma guardada pero no se pudo habilitar',
              'warning',
            );
          } else {
            await this.toast(
              'Alarma guardada pero no se pudo deshabilitar',
              'warning',
            );
          }
          this.navCtrl.back();
        },
      });
  }

  private async toast(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'medium',
  ) {
    const t = await this.toastCtrl.create({
      message,
      duration: 1500,
      position: 'bottom',
      color,
    });
    await t.present();
  }
}
