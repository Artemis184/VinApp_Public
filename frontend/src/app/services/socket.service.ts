import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { Observable, BehaviorSubject, Subject, firstValueFrom } from 'rxjs';
import { appLogger } from 'src/app/core/logger.service';
import { AuthService } from 'src/app/auth/services/auth.service';

/**
 * Servicio de WebSocket para alarmas en tiempo real.
 *
 * Decisión WS vs REST: se MANTIENE WebSocket (es lo correcto para tiempo real),
 * pero se corrige la causa de las desconexiones:
 *  - reconexión infinita con backoff (antes se rendía tras 5 intentos),
 *  - el access token (cookie HttpOnly de 15 min) se refresca ANTES de
 *    (re)conectar, para que el handshake no falle por token expirado,
 *  - al (re)conectar se re-sincroniza el estado de los nodos automáticamente.
 *
 * La autenticación del handshake viaja por la cookie HttpOnly (withCredentials);
 * el token NO está en localStorage (por eso el intento anterior siempre quedaba
 * vacío), así que dependemos del refresh de la cookie, no de pasarla en `auth`.
 */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);
  private reconnected$ = new Subject<void>();
  private authService = inject(AuthService);

  // Evita refrescos en cascada cuando varios connect_error llegan juntos.
  private isRefreshing = false;

  // Estado de conexión observable.
  connection$ = this.connected$.asObservable();
  // Emite cada vez que se (re)establece la conexión: las páginas pueden
  // re-suscribirse / re-pedir estados si lo necesitan.
  onReconnected$ = this.reconnected$.asObservable();

  private resolveSocketUrl(): string {
    const apiUrl = (environment as any)?.apiUrl ?? '';
    const api = typeof apiUrl === 'string' ? apiUrl : String(apiUrl);
    return (
      (environment as any)?.socketUrl ??
      (api ? api.replace(/\/api\/?$/, '') : api)
    );
  }

  // Refresca el access token si está por expirar, de forma silenciosa.
  private async ensureFreshToken(): Promise<void> {
    try {
      if (this.authService.shouldRefreshToken()) {
        await firstValueFrom(
          this.authService.refreshToken({ preserveSessionOnFailure: true }),
        );
      }
    } catch {
      // Si el refresh falla seguimos: el handshake dirá si la cookie sirve.
      appLogger.warn(
        '[SocketService] no se pudo refrescar token antes de conectar',
      );
    }
  }

  async connect(): Promise<void> {
    if (this.socket && this.socket.connected) return;

    await this.ensureFreshToken();

    return new Promise<void>((resolve, reject) => {
      const socketUrl = this.resolveSocketUrl();
      appLogger.log('[SocketService] iniciando conexión');

      const timeoutId = setTimeout(() => {
        appLogger.error('[SocketService] timeout en conexión inicial');
        reject(new Error('Socket connection timeout'));
      }, 30000);

      // Si ya había un socket (reconexión manual), reutilizar/limpiar.
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      this.socket = io(socketUrl, {
        withCredentials: true,
        // Reconexión resiliente: no rendirse nunca, con backoff.
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        randomizationFactor: 0.5,
        timeout: 20000,
      });

      const onConnect = () => {
        appLogger.log('[SocketService] conectado');
        this.connected$.next(true);
        clearTimeout(timeoutId);
        // Re-sincronizar estados en cada (re)conexión.
        this.socket?.emit('node:states:request', {});
        this.reconnected$.next();
        resolve();
      };

      this.socket.on('connect', onConnect);

      this.socket.on('connect_error', (err: any) => {
        this.connected$.next(false);
        appLogger.error('[SocketService] error de conexión');
        void this.handleAuthError(err);
        // No rechazamos aquí: dejamos que socket.io siga reintentando.
      });

      this.socket.io.on('reconnect_attempt', () => {
        appLogger.log('[SocketService] intentando reconectar');
        // Antes de cada intento, asegurar token fresco (la cookie pudo expirar).
        void this.ensureFreshToken();
      });

      this.socket.on('disconnect', (reason: string) => {
        appLogger.log('[SocketService] desconectado');
        this.connected$.next(false);
        // Si el server cortó la sesión, forzamos un ciclo de refresh+reconexión.
        if (reason === 'io server disconnect') {
          void this.refreshAndReconnect();
        }
      });
    });
  }

  // Ante un error que parezca de autenticación, refresca el token. socket.io ya
  // reintenta solo (reconnection: true), y el próximo intento usará la cookie
  // fresca; por eso aquí NO llamamos connect() a mano (evita doble conexión).
  private async handleAuthError(err: any): Promise<void> {
    const msg = String(err?.message || '').toLowerCase();
    const looksAuth =
      msg.includes('auth') ||
      msg.includes('token') ||
      msg.includes('autenticación');
    if (looksAuth && !this.isRefreshing) {
      this.isRefreshing = true;
      try {
        await this.ensureFreshToken();
      } finally {
        this.isRefreshing = false;
      }
    }
  }

  private async refreshAndReconnect(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    try {
      await this.ensureFreshToken();
      this.socket?.connect();
    } finally {
      this.isRefreshing = false;
    }
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.connected$.next(false);
  }

  emit(event: string, payload?: any) {
    this.socket?.emit(event, payload);
  }

  on<T = any>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const handler = (data: T) => subscriber.next(data);
      this.socket?.on(event, handler as any);
      return () => {
        this.socket?.off(event, handler as any);
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
