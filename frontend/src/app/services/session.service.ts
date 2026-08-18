import { Injectable, inject } from '@angular/core';
import { SecureStorageService } from './secure-storage.service';
import { SESSION_CONFIG, AUTH_STORAGE, AUTH_HTTP } from 'src/constants/app.constants';
import { SessionData, UserData } from '../interfaces/session.interface';
import { Device } from '@capacitor/device';
import { Capacitor, CapacitorCookies } from '@capacitor/core';
import { environment } from 'src/environments/environment';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private currentSession: SessionData | null = null;
  private secureStorage = inject(SecureStorageService);
  private refreshBlockedUntilMs = 0;
  private apiBaseUrl = environment.apiUrl.replace(/\/api\/?$/, '');

  /* =====================
     Device id
  ====================== */

  /**
   * Genera o recupera el identificador único del dispositivo.
   */
  async generateDeviceId(): Promise<string> {
    let deviceId = await this.secureStorage.getItem(AUTH_STORAGE.DEVICE_ID);

    if (deviceId) {
      return deviceId;
    }

    const info = await Device.getInfo();
    deviceId = `${info.platform}-${uuidv4()}-${Date.now()}`;

    await this.secureStorage.setItem(AUTH_STORAGE.DEVICE_ID, deviceId);
    return deviceId;
  }

  /**
   * Retorna el device id actual en memoria.
   */
  getDeviceId(): string | null {
    return this.currentSession?.device_id ?? null;
  }

  /* =====================
     Session management
  ====================== */

  /**
   * Restaura la sesión almacenada y valida su vigencia.
   */
  async restoreSession(): Promise<SessionData | null> {
    const session = await this.secureStorage.getItem(AUTH_STORAGE.SESSION_DATA);

    let finalSession = session;

    // Fallback para compatibilidad en entornos web
    if (!finalSession) {
      try {
        const raw = localStorage.getItem(AUTH_STORAGE.SESSION_DATA);
        finalSession = raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.error('Error parseando sesión desde localStorage:', error);
      }
    }

    if (!finalSession) return null;

    if (this.isSessionExpired(finalSession)) {
      await this.clearSession();
      return null;
    }

    this.currentSession = finalSession;

    if (Capacitor.isNativePlatform() && finalSession.csrf_token) {
      await this.syncNativeCsrfCookie(finalSession.csrf_token);
    }

    return finalSession;
  }

  /**
   * Guarda la sesión actual en almacenamiento seguro.
   */
  async saveSession(session: SessionData): Promise<void> {
    const now = Date.now();

    session.created_at = now;
    session.last_activity_at = now;

    await this.secureStorage.setItem(AUTH_STORAGE.SESSION_DATA, session);

    this.currentSession = session;

    if (Capacitor.isNativePlatform() && session.csrf_token) {
      await this.syncNativeCsrfCookie(session.csrf_token);
    }
  }

  /**
   * Actualiza expiraciones y actividad de la sesión activa.
   */
  async updateSessionExpiry(
    accessTokenExpiresAt: number,
    refreshTokenExpiresAt?: number,
    csrfToken?: string,
  ): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.access_token_expires_at = accessTokenExpiresAt;
    if (refreshTokenExpiresAt) {
      this.currentSession.refresh_token_expires_at = refreshTokenExpiresAt;
    }
    if (csrfToken) {
      this.currentSession.csrf_token = csrfToken;
    }
    this.currentSession.last_activity_at = Date.now();

    await this.secureStorage.setItem(
      AUTH_STORAGE.SESSION_DATA,
      this.currentSession,
    );

    if (Capacitor.isNativePlatform() && csrfToken) {
      await this.syncNativeCsrfCookie(csrfToken);
    }
  }

  /**
   * Elimina completamente la sesión actual.
   */
  async clearSession(): Promise<void> {
    await this.secureStorage.removeItem(AUTH_STORAGE.SESSION_DATA);
    this.currentSession = null;
  }

  /* =====================
     Getters
  ====================== */

  /**
   * Compatibilidad legacy: no se expone el access token en frontend.
   */
  getAccessToken(): string | null {
    return null;
  }

  /**
   * Compatibilidad legacy: no se expone el refresh token en frontend.
   */
  getRefreshToken(): string | null {
    return null;
  }

  /**
   * Retorna los datos básicos del usuario autenticado.
   */
  getCurrentUser(): UserData | null {
    if (!this.currentSession) return null;

    return {
      uuid: this.currentSession.user_uuid,
      email: this.currentSession.email,
      full_name: this.currentSession.full_name,
      role: this.currentSession.role,
      is_master: this.currentSession.is_master,
    };
  }

  /**
   * Establece manualmente la sesión en memoria.
   */
  setCurrentSession(session: SessionData): void {
    this.currentSession = session;
  }

  /**
   * Retorna la sesión completa en memoria.
   */
  getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  /**
   * Limpia únicamente la sesión en memoria.
   */
  clearCurrentSession(): void {
    this.currentSession = null;
  }

  /**
   * Reaplica la cookie CSRF en el jar nativo para que sobreviva a cierres de la app.
   */
  private async syncNativeCsrfCookie(csrfToken: string): Promise<void> {
    try {
      await CapacitorCookies.setCookie({
        url: this.apiBaseUrl,
        key: AUTH_HTTP.CSRF_COOKIE_NAME,
        value: csrfToken,
        path: '/',
      });
    } catch (error) {
      console.warn('No se pudo sincronizar la cookie CSRF nativa:', error);
    }
  }

  /**
   * Bloquea nuevos intentos de refresh durante una ventana corta.
   */
  blockRefreshAttempts(durationMs: number): void {
    this.refreshBlockedUntilMs = Date.now() + Math.max(0, durationMs);
  }

  /**
   * Indica si el refresh está temporalmente bloqueado tras un error.
   */
  isRefreshBlocked(): boolean {
    return Date.now() < this.refreshBlockedUntilMs;
  }

  /**
   * Indica si el token debe refrescarse próximamente.
   */
  shouldRefreshToken(): boolean {
    if (!this.currentSession || this.isRefreshBlocked()) return false;

    return (
      this.currentSession.access_token_expires_at - Date.now() <
      SESSION_CONFIG.REFRESH_TOKEN_THRESHOLD_MS
    );
  }

  /**
   * Verifica si la sesión ha expirado.
   */
  isSessionExpired(session: SessionData): boolean {
    if (!session) return true;

    // La sesión solo se invalida por pérdida de datos locales o por revocación del backend.
    return false;
  }
}
