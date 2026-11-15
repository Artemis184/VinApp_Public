import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { HttpUtilsService } from 'src/app/services/http-utils.service';

export interface NodeHealthSummary {
  nodeId: number;
  code: string;
  name: string;
  rfSlot: number | null;
  sinDatos: boolean;
  healthy?: boolean;
  radioReinits?: number;
  boots?: number;
  uptimeHours?: number;
  rxCount?: number;
  viaRepeater?: string | null;
  lastReportAt?: string;
  ventanaDias?: number;
  reinitsEnVentana?: number;
  bootsEnVentana?: number;
  resetsAnormalesEnVentana?: number;
}

export interface NodeHealthLog {
  id: string;
  node_id: number;
  rf_node: number;
  radio_reinits: number;
  boots: number;
  rx_count: number;
  uptime_hours: number;
  abnormal_reset: boolean;
  reinit_this_session: boolean;
  via_repeater: string | null;
  recorded_at: string;
}

interface BackendResponse<T> {
  cant: number;
  data: T;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NodeHealthService {
  private readonly http = inject(HttpClient);
  private readonly httpUtils = inject(HttpUtilsService);
  private readonly apiUrl = `${environment.apiUrl}/nodes`;

  getSummary(days = 7): Observable<BackendResponse<NodeHealthSummary[]>> {
    const params = new HttpParams().set('days', days);
    return this.http.get<BackendResponse<NodeHealthSummary[]>>(
      `${this.apiUrl}/health/summary`,
      { params, headers: this.httpUtils.getAuthHeaders() },
    );
  }

  getHistory(
    nodeId: number,
    limit = 100,
    days = 30,
  ): Observable<BackendResponse<NodeHealthLog[]>> {
    const params = new HttpParams().set('limit', limit).set('days', days);
    return this.http.get<BackendResponse<NodeHealthLog[]>>(
      `${this.apiUrl}/${nodeId}/health`,
      { params, headers: this.httpUtils.getAuthHeaders() },
    );
  }
}
