import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import {
  IonContent,
  IonList,
  IonIcon,
  IonCard,
} from '@ionic/angular/standalone';

import {
  UsuPendientesService,
  UsuarioPendiente,
} from '../services/usu-pendientes';
import { AdminBackHeaderComponent } from 'src/app/shared/admin-back-header/admin-back-header.component';

@Component({
  selector: 'app-listado-pendientes-acciones',
  templateUrl: './listado-pendientes-acciones.page.html',
  styleUrls: ['./listado-pendientes-acciones.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonContent,
    IonList,
    IonIcon,
    IonCard,
    AdminBackHeaderComponent,
  ],
})
export class ListadoPendientesAccionesPage {
  private usuariosService = inject(UsuPendientesService);
  private router = inject(Router);

  usuarios: UsuarioPendiente[] = [];

  // SE EJECUTA CADA VEZ QUE ENTRAS A LA PANTALLA
  ionViewWillEnter() {
    this.cargarUsuarios();
  }

  cargarUsuarios() {
    this.usuariosService.getUsuarios().subscribe({
      next: (data) => {
        this.usuarios = data;
      },
      error: (err: unknown) => {
        console.error('Error cargando usuarios', err);
      },
    });
  }

  verDetalle(usuario: UsuarioPendiente) {
    this.router.navigate(['/administrator/listado-usu', usuario.id]);
  }
}
