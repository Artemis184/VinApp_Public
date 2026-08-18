import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuditoriaService {
  private apiUrl = `${environment.apiUrl}/getaudituseractionsalarma`;

  constructor(private http: HttpClient) {}

  // Este método hace la petición con los filtros que pide el Backend
  getAuditoria(nodeId?: number, from?: string, to?: string): Observable<any> {
    let params = new HttpParams();

    if (nodeId) params = params.set('nodeId', nodeId.toString());
    if (from) params = params.set('from', from.split('T')[0]); // Solo YYYY-MM-DD
    if (to) params = params.set('to', to.split('T')[0]);

    return this.http.get<any>(this.apiUrl, { params });
  }

  getNodes(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/nodes`); // Asegúrate de tener este endpoint en tu backend
  }
}
