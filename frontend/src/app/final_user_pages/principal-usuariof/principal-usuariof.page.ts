import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

import { MainHeaderComponent } from '../../shared/main-header/main-header.component';
import {
  AlarmSwitchComponent,
  AlarmaUI,
} from '../../shared/alarm-switch/alarm-switch.component';
import { SocketService } from 'src/app/services/socket.service';
import { Alarmas } from 'src/app/administrator_pages/services/alarmas';
import { UserNodes } from 'src/app/administrator_pages/services/user-nodes';
import { SessionService } from 'src/app/services/session.service';
import { AUTH_STORAGE } from 'src/constants/app.constants';

@Component({
  selector: 'app-principal-usuariof',
  templateUrl: './principal-usuariof.page.html',
  styleUrls: ['./principal-usuariof.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    MainHeaderComponent,
    AlarmSwitchComponent,
  ],
})
export class PrincipalUsuariofPage implements OnInit {
  private socketService = inject(SocketService);
  private alarmasService = inject(Alarmas);
  private userNodesService = inject(UserNodes);
  private sessionService = inject(SessionService);

  alarmasUsuario: AlarmaUI[] = [];
  isLoading = true;
  errorMessage = '';

  async ngOnInit(): Promise<void> {
    await this.cargarNodosAsignados();
    await this.sincronizarEstadosIniciales();
  }

  private async cargarNodosAsignados(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const userUuid = await this.obtenerUuidUsuarioActual();

      if (!userUuid) {
        this.errorMessage = 'No se pudo identificar el usuario autenticado.';
        this.alarmasUsuario = [];
        return;
      }

      const [nodeIds, nodosResponse] = await Promise.all([
        firstValueFrom(this.userNodesService.getNodesByUserId(userUuid)),
        firstValueFrom(this.alarmasService.getAll()),
      ]);

      const idsAsignados = new Set(nodeIds || []);
      const nodosAsignados = (nodosResponse?.data || []).filter((n) =>
        idsAsignados.has(n.id),
      );

      this.alarmasUsuario = nodosAsignados.map((nodo) => ({
        id: nodo.id,
        nombre: nodo.name,
        direccion:
          nodo.rf_address ||
          nodo.description ||
          nodo.location ||
          'Sin dirección',
        encendida: false,
        loading: false,
        isEnabled: nodo.is_enabled,
        isOnline: nodo.is_online,
      }));

      if (this.alarmasUsuario.length === 0) {
        this.errorMessage = 'No tienes nodos asignados.';
      }
    } catch (error) {
      console.error(
        '[PrincipalUsuariof] Error cargando nodos asignados',
        error,
      );
      this.alarmasUsuario = [];
      this.errorMessage = 'No se pudieron cargar tus nodos asignados.';
    } finally {
      this.isLoading = false;
    }
  }

  private async sincronizarEstadosIniciales(): Promise<void> {
    if (!this.alarmasUsuario.length) return;

    try {
      await this.socketService.connect();

      const nodeIds = this.alarmasUsuario.map((a) => a.id);

      const statesSub = this.socketService.onNodeStates().subscribe({
        next: (data: any) => {
          if (!Array.isArray(data?.states)) return;

          data.states.forEach((nodeState: any) => {
            const alarma = this.alarmasUsuario.find(
              (a) => a.id === nodeState.nodeId,
            );
            if (!alarma) return;

            alarma.encendida = nodeState.state === 'on';
            alarma.isOnline = nodeState.is_online !== false;
          });

          statesSub.unsubscribe();
        },
        error: () => statesSub.unsubscribe(),
      });

      this.socketService.requestNodeStates(nodeIds);
    } catch (error) {
      console.error(
        '[PrincipalUsuariof] Error sincronizando estado inicial',
        error,
      );
    }
  }

  private async obtenerUuidUsuarioActual(): Promise<string | null> {
    const inMemoryUser = this.sessionService.getCurrentUser();
    if (inMemoryUser?.uuid) return inMemoryUser.uuid;

    const restored = await this.sessionService.restoreSession();
    if (restored?.user_uuid) return restored.user_uuid;

    const authUserRaw = localStorage.getItem(AUTH_STORAGE.USER);
    if (!authUserRaw) return null;

    try {
      const authUser = JSON.parse(authUserRaw);
      return (
        authUser?.uuid || authUser?.usr_uuid || authUser?.user_uuid || null
      );
    } catch {
      return null;
    }
  }

  async handleRefresh(event: any): Promise<void> {
    try {
      // Forzar verificación de conectividad de nodos
      await firstValueFrom(this.alarmasService.forceHeartbeat());

      // Recargar datos actualizados
      await this.cargarNodosAsignados();
      await this.sincronizarEstadosIniciales();
    } catch (error) {
      console.error('[Refresh] Error al actualizar:', error);
    } finally {
      event.target.complete();
    }
  }

  async toggleAlarma(alarma: AlarmaUI): Promise<void> {
    if (alarma.loading) return;

    try {
      await this.socketService.connect();
      const nuevoEstado = alarma.encendida ? 'off' : 'on';
      alarma.loading = true;
      this.socketService.setAlarmState(alarma.id, nuevoEstado);
    } catch {
      alarma.loading = false;
    }
  }
}
