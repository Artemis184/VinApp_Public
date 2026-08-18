import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuditService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ cant: number; data: any[]; message: string }> {
    return this.http.get<{ cant: number; data: any[]; message: string }>(
      `${this.apiUrl}/getauditadminactions`,
    );
  }

  // Nuevo método con filtros backend
  getFiltered(
    params: HttpParams,
  ): Observable<{ cant: number; data: any[]; message: string }> {
    return this.http.get<{ cant: number; data: any[]; message: string }>(
      `${this.apiUrl}/getauditadminactions`,
      { params },
    );
  }
  // === AGREGA ESTE MÉTODO EXACTAMENTE ASÍ ===
  getMasterAdminAuditList(): Observable<{ data: any[]; message: string }> {
    return this.http.get<{ data: any[]; message: string }>(
      `${this.apiUrl}/master/lista-auditoria-admins`,
    );
  }

  getSoloAlarmas(
    params?: HttpParams,
  ): Observable<{ cant: number; data: any[]; message: string }> {
    return this.http.get<{ cant: number; data: any[]; message: string }>(
      `${this.apiUrl}/getaudituseractionsalarma`,
      { params },
    );
  }

  /* 👇 AÑADE ESTO AQUÍ
  getNodosBase(): Observable<{ cant: number; data: any[]; message: string }> {
    return this.http.get<{ cant: number; data: any[]; message: string }>(
      `${this.apiUrl}/getnodesbase`,
    );
  }*/

  getNodes(): Observable<{ cant: number; data: any[]; message: string }> {
    return this.http.get<{ cant: number; data: any[]; message: string }>(
      `${this.apiUrl}/get-all-nodes`,
    );
  }
}
