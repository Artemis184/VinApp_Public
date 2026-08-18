import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface RecoveryResponse {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class RecoveryService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl; // Asegúrate que termine sin '/' (ej: http://localhost:3000/api)

  private cooldown = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  // --- MÉTODOS DE CONEXIÓN API ---

  /**
   * 1. Solicitar código: POST /password/forgot
   */
  forgotPassword(email: string): Observable<RecoveryResponse> {
    return this.http
      .post<RecoveryResponse>(`${this.apiUrl}/password/forgot`, { email })
      .pipe(
        tap(() => this.startGlobalCooldown(60)), // Inicia el timer de 60s tras éxito
      );
  }

  /**
   * 2. Verificar código: POST /password/verify
   */
  verifyResetCode(email: string, code: string): Observable<RecoveryResponse> {
    return this.http.post<RecoveryResponse>(`${this.apiUrl}/password/verify`, {
      email,
      code,
    });
  }

  /**
   * 3. Resetear contraseña: POST /password/reset
   */
  resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Observable<RecoveryResponse> {
    return this.http.post<RecoveryResponse>(`${this.apiUrl}/password/reset`, {
      email,
      code,
      newPassword,
    });
  }

  // --- GESTIÓN DE COOLDOWN (TIEMPO DE ESPERA) ---

  getCooldown(): number {
    return this.cooldown;
  }

  startGlobalCooldown(seconds: number): void {
    this.stopGlobalCooldown();
    this.cooldown = seconds;
    this.intervalId = setInterval(() => {
      this.cooldown--;
      if (this.cooldown <= 0) {
        this.stopGlobalCooldown();
      }
    }, 1000);
  }

  stopGlobalCooldown(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.cooldown = 0;
  }
}
