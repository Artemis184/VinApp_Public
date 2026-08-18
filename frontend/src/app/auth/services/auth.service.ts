import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  throwError,
  firstValueFrom,
  from,
} from 'rxjs';
import { catchError, map, switchMap, timeout, retry } from 'rxjs/operators';

import { environment } from 'src/environments/environment';
import { SessionService } from 'src/app/services/session.service';
import {
  SessionData,
  LoginResponse,
  RefreshTokenResponse,
  UserData,
} from '../../interfaces/session.interface';
import { AUTH_STORAGE, SESSION_CONFIG } from 'src/constants/app.constants';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}`;
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  // Reactive auth state
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private userDataSubject = new BehaviorSubject<UserData | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  userData$ = this.userDataSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  constructor() {
    this.initializeAuth();
  }

  // Restore stored session on app start
  private async initializeAuth(): Promise<void> {
    try {
      const session = await this.sessionService.restoreSession();

      if (!session) {
        this.setUnauthenticated();
        return;
      }

      this.setAuthenticatedUser(session);

      if (this.sessionService.shouldRefreshToken()) {
        try {
          await firstValueFrom(this.refreshToken({ preserveSessionOnFailure: true }));
        } catch (refreshError) {
          console.warn(
            'Refresh inicial falló, manteniendo sesión restaurada:',
            refreshError,
          );
        }
      }
    } catch (error) {
      console.error('Error inicializando autenticacion:', error);
      this.setUnauthenticated();
    }
  }

  // Login with email/password
  login(email: string, password: string): Observable<LoginResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.generateDeviceIdAndLogin(email, password).pipe(
      timeout(30000),
      retry({
        count: SESSION_CONFIG.MAX_REFRESH_RETRY_ATTEMPTS - 1,
        delay: SESSION_CONFIG.REFRESH_RETRY_DELAY_MS,
      }),
      switchMap((response) => this.handleLoginResponse(response)),
      catchError((error) => this.handleLoginError(error)),
      map((response) => {
        this.loadingSubject.next(false);
        return response;
      }),
    );
  }

  // Login with Google token
  loginWithGoogle(idToken: string): Observable<LoginResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.generateDeviceIdAndLoginGoogle(idToken).pipe(
      timeout(30000),
      switchMap((response) => this.handleLoginResponse(response)),
      catchError((error) => this.handleLoginError(error)),
      map((response) => {
        this.loadingSubject.next(false);
        return response;
      }),
    );
  }

  // Get user by id
  getUserById(uuid: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/users/getuser/${uuid}`);
  }

  // Request a new access token using refresh token
  refreshToken(options?: { preserveSessionOnFailure?: boolean }): Observable<RefreshTokenResponse> {
    return from(this.sessionService.generateDeviceId()).pipe(
      switchMap((deviceId) =>
        this.http.post<RefreshTokenResponse>(
          `${this.apiUrl}/refresh`,
          {
            deviceId,
          },
          {
            withCredentials: true,
          },
        ),
      ),
      timeout(15000),
      retry({
        count: SESSION_CONFIG.MAX_REFRESH_RETRY_ATTEMPTS - 1,
        delay: SESSION_CONFIG.REFRESH_RETRY_DELAY_MS,
      }),
      switchMap(async (response) => {
        const session = this.sessionService.getCurrentSession();

        if (session) {
          const accessTokenExpiresAt =
            response.access_token_expires_at ||
            Date.now() + SESSION_CONFIG.ACCESS_TOKEN_FALLBACK_MS;

          await this.sessionService.updateSessionExpiry(
            accessTokenExpiresAt,
            undefined,
            response.csrf_token,
          );
        }

        return response;
      }),
      catchError((error) => {
        console.error(
          'Error refrescando token:',
          error?.error?.message || error?.message || error,
        );

        if (error?.status === 429) {
          const retryAfterHeader = error?.headers?.get?.('Retry-After');
          const retryAfterSeconds = Number(retryAfterHeader);
          const cooldownMs = Number.isFinite(retryAfterSeconds)
            ? Math.max(1000, retryAfterSeconds * 1000)
            : 30_000;

          this.sessionService.blockRefreshAttempts(cooldownMs);
        }

        if (!options?.preserveSessionOnFailure) {
          void this.handleAuthFailureLocal();
        }

        return throwError(() => error);
      }),
    );
  }

  async handleAuthFailureLocal(): Promise<void> {
    await this.sessionService.clearSession();
    this.clearLegacyStorage();
    this.setUnauthenticated();
    this.router.navigate(['/auth/login']);
  }

  // Logout both remote and local session
  logout(): Observable<any> {
    this.loadingSubject.next(true);

    const logoutRequest = this.http.post(
      `${this.apiUrl}/logout`,
      {},
      { withCredentials: true },
    );

    return logoutRequest.pipe(
      timeout(10000),
      switchMap(async () => {
        await this.sessionService.clearSession();
        this.clearLegacyStorage();
        this.setUnauthenticated();
        this.router.navigate(['/auth/login']);
        return {};
      }),
      catchError(async (error) => {
        console.error('Error en logout remoto, limpiando sesion local:', error);
        await this.sessionService.clearSession();
        this.clearLegacyStorage();
        this.setUnauthenticated();
        this.router.navigate(['/auth/login']);
        return {};
      }),
      map(() => {
        this.loadingSubject.next(false);
        return {};
      }),
    );
  }

  // Current user in memory
  getCurrentUser(): UserData | null {
    return this.sessionService.getCurrentUser();
  }

  // Current access token
  getAccessToken(): string | null {
    return null;
  }

  // Authenticated state
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  // Should refresh token soon
  shouldRefreshToken(): boolean {
    return this.sessionService.shouldRefreshToken();
  }

  // Generate device id and perform login
  private generateDeviceIdAndLogin(
    email: string,
    password: string,
  ): Observable<LoginResponse> {
    return new Observable((observer) => {
      this.sessionService
        .generateDeviceId()
        .then((deviceId) => {
          this.http
            .post<LoginResponse>(
              `${this.apiUrl}/login`,
              {
                email,
                password,
                deviceId,
              },
              { withCredentials: true },
            )
            .subscribe(observer);
        })
        .catch((error) => observer.error(error));
    });
  }

  // Generate device id and perform Google login
  private generateDeviceIdAndLoginGoogle(
    idToken: string,
  ): Observable<LoginResponse> {
    return new Observable((observer) => {
      this.sessionService
        .generateDeviceId()
        .then((deviceId) => {
          this.http
            .post<LoginResponse>(
              `${this.apiUrl}/login/google`,
              {
                id_token: idToken,
                deviceId,
              },
              { withCredentials: true },
            )
            .subscribe(observer);
        })
        .catch((error) => observer.error(error));
    });
  }

  // Build local session after successful login
  private async handleLoginResponse(
    response: LoginResponse,
  ): Promise<LoginResponse> {
    if (!response.Login) {
      throw new Error('Respuesta de login invalida');
    }

    const now = Date.now();
    const accessTokenExpiresAt =
      response.access_token_expires_at ||
      now + SESSION_CONFIG.ACCESS_TOKEN_FALLBACK_MS;

    const sessionData: SessionData = {
      user_uuid: response.user_uuid || response.User_data.usr_uuid,
      email: response.User_data.usr_email,
      full_name: response.User_data.usr_nombres,
      role: response.User_data.usr_rol,
      is_master: response.User_data.is_master,

      device_id:
        this.sessionService.getDeviceId() ||
        (await this.sessionService.generateDeviceId()),
      device_info: {},

      access_token_expires_at: accessTokenExpiresAt,
      refresh_token_expires_at: now + SESSION_CONFIG.REFRESH_TOKEN_FALLBACK_MS,
      csrf_token: response.csrf_token,

      created_at: now,
      last_activity_at: now,
    };

    await this.sessionService.saveSession(sessionData);
    this.setAuthenticatedUser(sessionData);

    return response;
  }

  // Parse login errors and set message
  private handleLoginError(error: any): Observable<LoginResponse> {
    let errorMessage = 'Error en el servidor';

    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) errorMessage = 'Credenciales incorrectas';
      else if (error.status === 403) errorMessage = 'Cuenta no aprobada';
      else if (error.status === 400)
        errorMessage = 'Datos de entrada invalidos';
    } else if (error?.name === 'TimeoutError') {
      errorMessage = 'Tiempo de espera agotado';
    }

    this.errorSubject.next(errorMessage);
    return throwError(() => error);
  }

  // Update state to authenticated
  private setAuthenticatedUser(session: SessionData): void {
    const userData: UserData = {
      uuid: session.user_uuid,
      email: session.email,
      full_name: session.full_name,
      role: session.role,
      is_master: session.is_master,
    };

    this.isAuthenticatedSubject.next(true);
    this.userDataSubject.next(userData);
    this.errorSubject.next(null);
  }

  // Reset to unauthenticated state
  private setUnauthenticated(): void {
    this.isAuthenticatedSubject.next(false);
    this.userDataSubject.next(null);
    this.loadingSubject.next(false);
  }

  // Clear legacy localStorage keys used by older flows
  private clearLegacyStorage(): void {
    localStorage.removeItem(AUTH_STORAGE.TOKEN);
    localStorage.removeItem(AUTH_STORAGE.USER);
    localStorage.removeItem(AUTH_STORAGE.ROLE);
    localStorage.removeItem(AUTH_STORAGE.IS_GOOGLE);

    localStorage.removeItem('token');
    localStorage.removeItem('role');
  }
}
