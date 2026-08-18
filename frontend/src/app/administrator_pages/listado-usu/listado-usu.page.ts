import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  IonContent,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
} from '@ionic/angular/standalone';

import {
  UsuarioPendiente,
  EstadoPeticion,
  UsuPendientesService,
} from '../services/usu-pendientes';

import { AdminBackHeaderComponent } from 'src/app/shared/admin-back-header/admin-back-header.component';
import { NodeSelectorComponent } from 'src/app/shared/node-selector/node-selector.component';

@Component({
  selector: 'app-listado-usu',
  templateUrl: './listado-usu.page.html',
  styleUrls: ['./listado-usu.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    AdminBackHeaderComponent,
    NodeSelectorComponent,
  ],
})
export class ListadoUsuPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private router = inject(Router);
  private servicio = inject(UsuPendientesService);
  private destroy$ = new Subject<void>();

  usuario!: UsuarioPendiente;
  estadoSeleccionado: EstadoPeticion | null = null;
  modalConfirmacion = false;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';

    this.servicio
      .getUsuarioById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe((u: UsuarioPendiente) => {
        this.usuario = u;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  abrirEstado() {}

  onEstadoChange(valor: EstadoPeticion) {
    this.estadoSeleccionado = valor;
  }

  actualizarSeleccion(ids: number[]) {
    this.usuario.alarmasSeleccionadas = ids;
  }

  nombreAlarma(id: number): string {
    return `Nodo ${id}`;
  }

  esFormularioValido(): boolean {
    if (!this.estadoSeleccionado) return false;

    if (
      this.estadoSeleccionado === 'APROBADO' &&
      this.usuario.alarmasSeleccionadas.length === 0
    ) {
      return false;
    }

    return true;
  }

  abrirConfirmacion() {
    if (!this.esFormularioValido()) return;
    this.modalConfirmacion = true;
  }

  cerrarConfirmacion() {
    this.modalConfirmacion = false;
  }

  guardar() {
    if (!this.estadoSeleccionado) return;

    const userId = this.usuario.id;

    if (this.estadoSeleccionado === 'APROBADO') {
      this.servicio.aprobarUsuario(userId).subscribe(() => {
        const asignaciones = this.usuario.alarmasSeleccionadas.map(
          (nodeId: number) => this.servicio.asignarNodo(userId, nodeId),
        );

        forkJoin(asignaciones).subscribe(() => {
          this.router.navigateByUrl(
            '/administrator/listado-pendientes-acciones',
            { replaceUrl: true },
          );
        });
      });
    }

    if (this.estadoSeleccionado === 'RECHAZADO') {
      this.servicio.rechazarUsuario(userId).subscribe(() => {
        this.router.navigateByUrl(
          '/administrator/listado-pendientes-acciones',
          { replaceUrl: true },
        );
      });
    }
  }

  cancelar() {
    this.location.back();
  }

  get esAprobado(): boolean {
    return this.estadoSeleccionado === 'APROBADO';
  }

  get esRechazado(): boolean {
    return this.estadoSeleccionado === 'RECHAZADO';
  }
}
