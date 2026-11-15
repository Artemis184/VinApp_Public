import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  IonContent,
  IonList,
  IonIcon,
  IonCard,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';

import {
  UsuPendientesService,
  UsuarioPendiente,
} from '../services/usu-pendientes';
import { AdminBackHeaderComponent } from 'src/app/shared/admin-back-header/admin-back-header.component';
import { appLogger } from 'src/app/core/logger.service';

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
    IonRefresher,
    IonRefresherContent,
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

  async cargarUsuarios(): Promise<void> {
    try {
      const data = await firstValueFrom(this.usuariosService.getUsuarios());

      this.usuarios = data;
    } catch (error) {
      appLogger.error('Error cargando usuarios');
    }
  }

  async handleRefresh(event: any): Promise<void> {
    try {
      await this.cargarUsuarios();
    } finally {
      event.target.complete();
    }
  }

  verDetalle(usuario: UsuarioPendiente) {
    this.router.navigate(['/administrator/listado-usu', usuario.id]);
  }
}
