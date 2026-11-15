import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { HttpUtilsService } from 'src/app/services/http-utils.service';
import { BackendResponse } from 'src/app/administrator_pages/services/user-nodes';

export interface Alarma {
  id: number;
  name: string;
  code: string;
  description: string;
  location: string;
  installation_image: string;
  is_enabled: boolean;
  is_online?: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class Alarmas {
  private http = inject(HttpClient);
  private httpUtils = inject(HttpUtilsService);
  private apiUrl = environment.apiUrl + '/nodes/';
  private readonly allowedImageHosts = new Set(['vinapp.artemisnet.cloud']);

  getAlarmas(): Observable<BackendResponse<Alarma[]>> {
    return this.http.get<BackendResponse<Alarma[]>>(this.apiUrl, {
      headers: this.httpUtils.getAuthHeaders(),
    });
  }

  getAll(): Observable<BackendResponse<Alarma[]>> {
    return this.http.get<BackendResponse<Alarma[]>>(`${this.apiUrl}list`, {
      headers: this.httpUtils.getAuthHeaders(),
    });
  }

  getAlarmaById(id: number): Observable<BackendResponse<Alarma>> {
    return this.http.get<BackendResponse<Alarma>>(`${this.apiUrl}${id}`, {
      headers: this.httpUtils.getAuthHeaders(),
    });
  }

  getImageUrl(imagePath: string | null | undefined): string {
    const fallback = 'assets/default-node.png';
    const value = imagePath?.trim();

    if (!value) return fallback;

    try {
      const apiOrigin = new URL(environment.apiUrl).origin;
      const imageUrl = new URL(value, apiOrigin);
      const hostname = imageUrl.hostname.toLowerCase();

      if (!this.allowedImageHosts.has(hostname)) return fallback;
      if (imageUrl.protocol === 'http:') imageUrl.protocol = 'https:';
      if (imageUrl.protocol !== 'https:') return fallback;

      return imageUrl.toString();
    } catch {
      return fallback;
    }
  }

  actualizarAlarma(
    id: number,
    cambios: FormData,
  ): Observable<BackendResponse<Alarma>> {
    const headers = this.httpUtils.getAuthHeaders().delete('Content-Type');

    return this.http.patch<BackendResponse<Alarma>>(
      `${this.apiUrl}updatenode/${id}`,
      cambios,
      {
        headers,
      },
    );
  }

  habilitarAlarma(id: number): Observable<BackendResponse<Alarma>> {
    return this.http.patch<BackendResponse<Alarma>>(
      `${this.apiUrl}enablenode/${id}`,
      {},
      {
        headers: this.httpUtils.getAuthHeaders(),
      },
    );
  }

  deshabilitarAlarma(id: number): Observable<BackendResponse<Alarma>> {
    return this.http.patch<BackendResponse<Alarma>>(
      `${this.apiUrl}disablenode/${id}`,
      {},
      {
        headers: this.httpUtils.getAuthHeaders(),
      },
    );
  }

  getAlarmasHabilitadas(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/alarmas/habilitadas`);
  }

  forceHeartbeat(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}heartbeat`,
      {},
      {
        headers: this.httpUtils.getAuthHeaders(),
      },
    );
  }
}
