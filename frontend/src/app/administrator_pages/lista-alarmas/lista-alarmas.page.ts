import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonItem,
  IonLabel,
  IonButton,
  IonCard,
  IonBadge,
  IonImg,
  IonSpinner,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Alarmas, Alarma } from 'src/app/administrator_pages/services/alarmas';
import { AdminBackHeaderComponent } from 'src/app/shared/admin-back-header/admin-back-header.component';

@Component({
  selector: 'app-lista-alarmas',
  templateUrl: './lista-alarmas.page.html',
  styleUrls: ['./lista-alarmas.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,

    IonItem,
    IonLabel,
    IonButton,
    IonCard,
    IonBadge,
    IonImg,
    IonSpinner,
    AdminBackHeaderComponent,
  ],
})
export class ListaAlarmasPage implements OnInit, OnDestroy {
  alarmas: Alarma[] = [];
  isLoading = true;
  errorMessage = '';

  private alarmasService = inject(Alarmas);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.cargarAlarmas();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ionViewWillEnter() {
    this.cargarAlarmas();
  }

  cargarAlarmas() {
    this.isLoading = true;
    this.errorMessage = '';
    this.alarmasService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.alarmas = response.data;
          } else {
            this.alarmas = [];
            this.errorMessage = 'No se encontraron alarmas';
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error al cargar alarmas:', error);
          this.errorMessage = 'Error al cargar las alarmas';
          this.isLoading = false;
        },
      });
  }

  irAEditar(id: number) {
    this.router.navigate(['/administrator/editar-alarma', id]);
  }

  estadoHabilitada(a: Alarma) {
    return a.is_enabled ? 'Habilitada' : 'Deshabilitada';
  }

  colorHabilitada(a: Alarma) {
    return a.is_enabled ? 'primary' : 'medium';
  }

  obtenerDireccion(alarma: Alarma): string {
    return alarma.rf_address || alarma.description || 'Sin dirección asignada';
  }
}
