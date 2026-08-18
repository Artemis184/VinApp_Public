import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);

  // Exponer estado de conexión
  connection$ = this.connected$.asObservable();

  async connect(): Promise<void> {
    if (this.socket && this.socket.connected) return Promise.resolve();

    // Crear la conexión dentro de un Promise con timeout
    return new Promise<void>((resolve, reject) => {
      const apiUrl = (environment as any)?.apiUrl ?? '';
      const api = typeof apiUrl === 'string' ? apiUrl : String(apiUrl);
      const socketUrl =
        (environment as any)?.socketUrl ??
        (api ? api.replace(/\/api\/?$/, '') : api);

      console.log('[SocketService] conectando a', socketUrl);

      // Timeout de 30 segundos para la conexión inicial
      const timeoutId = setTimeout(() => {
        console.error('[SocketService] timeout conectando después de 30s');
        if (this.socket) {
          this.socket.disconnect();
        }
        reject(new Error('Socket connection timeout'));
      }, 30000);

      const token =
        localStorage.getItem('access_token') ||
        localStorage.getItem('token') ||
        '';

      this.socket = io(socketUrl, {
        withCredentials: true,
        auth: token ? { token } : undefined,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Eventos para debug y manejo de estado
      const onConnectHandler = () => {
        console.log('[SocketService] conectado', this.socket?.id);
        this.connected$.next(true);
        clearTimeout(timeoutId);

        // Verificar que realmente esté conectado antes de resolver
        if (this.socket?.connected) {
          this.socket.off('connect', onConnectHandler);
          resolve();
        } else {
          // Si aún no está conectado, esperar un poco más
          setTimeout(() => {
            if (this.socket?.connected) {
              this.socket.off('connect', onConnectHandler);
              resolve();
            }
          }, 50);
        }
      };

      this.socket.on('connect', onConnectHandler);

      this.socket.on('connect_error', (err: any) => {
        console.error(
          '[SocketService] connect_error',
          err && err.message ? err.message : err,
        );
        this.connected$.next(false);
        // Rechazar después de agotados los reintentos
        if (!this.socket?.active) {
          clearTimeout(timeoutId);
          reject(new Error(err?.message || 'Socket connection failed'));
        }
      });

      this.socket.on('reconnect_attempt', (attempt: any) => {
        console.log('[SocketService] reconnect_attempt', attempt);
      });

      this.socket.on('disconnect', (reason: any) => {
        console.log('[SocketService] disconnect', reason);
        this.connected$.next(false);
      });
    });
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }

  emit(event: string, payload?: any) {
    this.socket?.emit(event, payload);
  }

  on<T = any>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const handler = (data: T) => subscriber.next(data);
      this.socket?.on(event, handler);
      return () => {
        this.socket?.off(event, handler);
      };
    });
  }

  isConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }

  // Métodos específicos para alarmas
  setAlarmState(nodeId: number, state: 'on' | 'off'): void {
    this.emit('node:alarm:set', { nodeId, state });
  }

  // Solicitar estados iniciales de nodos
  requestNodeStates(nodeIds: number[]): void {
    this.emit('node:states:request', { nodeIds });
  }

  onAlarmUpdated(): Observable<any> {
    return this.on('node:alarm:updated');
  }

  onAlarmSuccess(): Observable<any> {
    return this.on('node:alarm:success');
  }

  onNodeStates(): Observable<any> {
    return this.on('node:states:response');
  }

  onNodeStatusChange(): Observable<any> {
    return this.on('node:status:change');
  }

  onError(): Observable<any> {
    return this.on('node:error');
  }
}
