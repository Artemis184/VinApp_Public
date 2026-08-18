import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, from } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';

import { AuthService } from '../services/auth.service';
import { Capacitor, CapacitorCookies } from '@capacitor/core';
import { SessionService } from 'src/app/services/session.service';
import { environment } from 'src/environments/environment';
import { AUTH_HTTP } from 'src/constants/app.constants';

type RefreshStatus = 'idle' | 'refreshing' | 'succeeded' | 'failed';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private lastRefreshError: unknown = null;
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private apiBaseUrl = environment.apiUrl.replace(/\/api\/?$/, '');

  /**
   * Emite cuando el refresh termina.
   * Permite que requests concurrentes esperen sin disparar múltiples refresh.
   */
  private refreshTokenSubject = new BehaviorSubject<RefreshStatus>('idle');

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    if (this.isApiRequest(req)) {
      return from(this.secureApiRequest(req)).pipe(
        switchMap((securedRequest) => this.handleRequest(securedRequest, next)),
      );
    }

    return this.handleRequest(req, next);
  }

  private handleRequest(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {

    // Rutas públicas, logout y refresh no deben disparar lógica de refresh.
    if (
      this.isPublicRoute(req) ||
      this.isRefreshRoute(req) ||
      this.isLogoutRoute(req)
    ) {
      return next.handle(req);
    }

    // Refresh preventivo para evitar respuestas 401 innecesarias
    if (
      this.sessionService.shouldRefreshToken() &&
      !this.isRefreshing &&
      !this.sessionService.isRefreshBlocked()
    ) {
      return this.handlePreemptiveRefresh(req, next);
    }

    return next.handle(req).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.handle401(req, next);
        }
        return throwError(() => error);
      }),
    );
  }

  private async secureApiRequest(req: HttpRequest<any>): Promise<HttpRequest<any>> {
    let securedRequest = req.clone({ withCredentials: true });

    const csrfToken = await this.resolveCsrfToken();
    if (csrfToken) {
      securedRequest = securedRequest.clone({
        setHeaders: { [AUTH_HTTP.CSRF_HEADER_NAME]: csrfToken },
      });
    }

    return securedRequest;
  }

  /* -------------------------------------------------------------------------- */
  /* Refresh preventivo                                                         */
  /* -------------------------------------------------------------------------- */

  /**
   * Ejecuta un refresh antes de que el token expire.
   * Reduce errores 401 y mejora la experiencia del usuario.
   */
  private handlePreemptiveRefresh(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    this.isRefreshing = true;
    this.lastRefreshError = null;
    this.refreshTokenSubject.next('refreshing');

    return this.authService.refreshToken({ preserveSessionOnFailure: Capacitor.isNativePlatform() }).pipe(
      switchMap(() => {
        this.isRefreshing = false;
        this.refreshTokenSubject.next('succeeded');

        return next.handle(req);
      }),
      catchError((err) => {
        this.isRefreshing = false;
        this.lastRefreshError = err;
        this.refreshTokenSubject.next('failed');
        if (!Capacitor.isNativePlatform()) {
          void this.authService.handleAuthFailureLocal();
        }
        return throwError(() => err);
      }),
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Manejo de 401 (fallback)                                                    */
  /* -------------------------------------------------------------------------- */

  /**
   * Maneja respuestas 401 cuando el refresh preventivo no fue suficiente.
   * Garantiza que solo un refresh ocurra a la vez.
   */
  private handle401(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    if (this.sessionService.isRefreshBlocked()) {
      return throwError(
        () =>
          this.lastRefreshError ??
          new Error('Refresh temporalmente bloqueado tras un 429.'),
      );
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.lastRefreshError = null;
      this.refreshTokenSubject.next('refreshing');

      return this.authService.refreshToken({ preserveSessionOnFailure: Capacitor.isNativePlatform() }).pipe(
        switchMap(() => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next('succeeded');

          return next.handle(req);
        }),
        catchError((err) => {
          this.isRefreshing = false;
          this.lastRefreshError = err;
          this.refreshTokenSubject.next('failed');
          if (!Capacitor.isNativePlatform()) {
            void this.authService.handleAuthFailureLocal();
          }
          return throwError(() => err);
        }),
      );
    }

    // Requests concurrentes esperan el token renovado
    return this.refreshTokenSubject.pipe(
      filter((status) => status !== 'refreshing'),
      take(1),
      switchMap((status) => {
        if (status === 'succeeded') {
          return next.handle(req);
        }

        return throwError(
          () =>
            this.lastRefreshError ??
            new Error(
              'Refresh token failed while waiting for concurrent request retry.',
            ),
        );
      }),
    );
  }

  private isApiRequest(req: HttpRequest<any>): boolean {
    return req.url.startsWith(this.apiBaseUrl) || req.url.startsWith('/api');
  }

  private getCookieValue(name: string): string | null {
    const cookieEntry = document.cookie
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${name}=`));

    if (!cookieEntry) return null;

    return decodeURIComponent(cookieEntry.substring(name.length + 1));
  }

  private async resolveCsrfToken(): Promise<string | null> {
    const sessionCsrfToken = this.sessionService.getCurrentSession()?.csrf_token;
    if (sessionCsrfToken) {
      return sessionCsrfToken;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const cookies = await CapacitorCookies.getCookies({
          url: this.apiBaseUrl,
        });
        return cookies[AUTH_HTTP.CSRF_COOKIE_NAME] || null;
      } catch {
        return null;
      }
    }

    return this.getCookieValue(AUTH_HTTP.CSRF_COOKIE_NAME);
  }

  /* -------------------------------------------------------------------------- */
  /* Rutas                                                                      */
  /* -------------------------------------------------------------------------- */

  /**
   * Define endpoints que no requieren autenticación.
   */
  private isPublicRoute(req: HttpRequest<any>): boolean {
    return [
      '/login',
      '/login/google',
      '/register',
      '/password-recovery',
      '/password-reset',
    ].some((url) => req.url.includes(url));
  }

  /**
   * Evita interceptar el endpoint de refresh para prevenir bucles.
   */
  private isRefreshRoute(req: HttpRequest<any>): boolean {
    return req.url.includes('/refresh');
  }

  private isLogoutRoute(req: HttpRequest<any>): boolean {
    return req.url.includes('/logout');
  }
}
