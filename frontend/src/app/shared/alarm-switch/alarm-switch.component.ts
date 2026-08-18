import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard,
  IonCardContent,
  ToastController,
} from '@ionic/angular/standalone';
import { SocketService } from '../../services/socket.service';
import { Subscription } from 'rxjs';

export interface AlarmaUI {
  id: number;
  nombre: string;
  direccion: string;
  encendida: boolean;
  loading: boolean;
  isEnabled?: boolean; // Nodo habilitado/deshabilitado en sistema
  isOnline?: boolean; // Conectividad RF24 del nodo (true = responde, false = no responde)
  offline?: boolean; // Timeout temporal (deprecated, usar isOnline)
  online?: boolean; // Nodo habilitado/deshabilitado en sistema (deprecated)
  lastError?: string; // Último error reportado
  lastUpdate?: Date; // Última actualización exitosa
}

@Component({
  standalone: true,
  selector: 'app-alarm-switch',
  templateUrl: './alarm-switch.component.html',
  styleUrls: ['./alarm-switch.component.scss'],
  imports: [CommonModule, IonCard, IonCardContent],
})
export class AlarmSwitchComponent implements OnInit, OnDestroy {
  /** Lista de alarmas */
  @Input() alarmas: AlarmaUI[] = [];

  /** Evento cuando se quiere cambiar estado */
  @Output() alarmToggle = new EventEmitter<AlarmaUI>();

  private socketService = inject(SocketService);
  private toastCtrl = inject(ToastController);
  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.socketService.connect();

    this.subs.push(
      this.socketService.on('node:alarm:updated').subscribe((payload: any) => {
        const { nodeId, state } = payload || {};
        const alarma = this.alarmas.find((a) => a.id === nodeId);
        if (alarma) {
          alarma.encendida = state === 'on';
          alarma.loading = false;
          alarma.isOnline = true; // Nodo respondió correctamente
          alarma.lastUpdate = new Date();
          alarma.lastError = undefined;
        }
      }),
    );

    this.subs.push(
      this.socketService.on('node:error').subscribe(async (err: any) => {
        const nodeId = err?.nodeId;
        const alarma = this.alarmas.find((a) => a.id === nodeId);
        if (alarma) {
          alarma.loading = false;

          // Detectar errores de comunicación con el nodo
          const message = err?.message || 'Error desconocido';
          if (
            message.includes('timeout') ||
            message.includes('no responde') ||
            message.includes('falló')
          ) {
            alarma.isOnline = false;
            alarma.lastError = message;
            console.warn(`🔴 Nodo ${nodeId} sin conectividad RF24: ${message}`);
          }
        }

        const message = err?.message || 'Error al cambiar estado de alarma';
        console.error('node:error', message);
        const t = await this.toastCtrl.create({
          header: 'Error',
          message,
          duration: 3000,
          color: 'danger',
        });
        await t.present();
      }),
    );

    // Escuchar cambios de estado de conectividad (heartbeat)
    this.subs.push(
      this.socketService.on('node:status:change').subscribe((data: any) => {
        const alarma = this.alarmas.find((a) => a.id === data.nodeId);
        if (alarma) {
          const wasOnline = alarma.isOnline;
          alarma.isOnline = data.is_online;

          if (!wasOnline && data.is_online) {
            console.log(`✅ Nodo ${data.nodeId} recuperó conectividad RF24`);
          } else if (wasOnline && !data.is_online) {
            console.warn(`🔴 Nodo ${data.nodeId} perdió conectividad RF24`);
          }
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.socketService.disconnect();
  }

  async onToggle(alarma: AlarmaUI) {
    if (
      alarma.loading ||
      alarma.isOnline === false ||
      alarma.isEnabled === false
    )
      return;

    const desiredState = alarma.encendida ? 'off' : 'on';
    alarma.loading = true;

    if (this.socketService.isConnected()) {
      this.socketService.emit('node:alarm:set', {
        nodeId: alarma.id,
        state: desiredState,
      });

      // Timeout para detectar falta de respuesta
      setTimeout(() => {
        if (alarma.loading) {
          alarma.loading = false;
          alarma.isOnline = false;
          alarma.lastError = 'Timeout: nodo no respondió';
          console.warn(`⚠️ Timeout - Nodo ${alarma.id} sin conectividad`);
        }
      }, 8000);
    } else {
      alarma.loading = false;
      this.alarmToggle.emit(alarma);
      const t = await this.toastCtrl.create({
        header: 'Conexión',
        message: 'No hay conexión al servidor de alarmas.',
        duration: 2500,
        color: 'warning',
      });
      await t.present();
    }
  }
}
