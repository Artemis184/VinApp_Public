import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { HttpUtilsService } from 'src/app/services/http-utils.service';
import { map } from 'rxjs/operators';

// Interfaz estandarizada para tus respuestas del backend
export interface BackendResponse<T> {
  cant?: number;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserNodes {
  private http = inject(HttpClient);
  // Se usa environment.apiUrl directamente para coincidir con app.use('/api', ...)
  private apiUrl = environment.apiUrl;
  private httpUtils = inject(HttpUtilsService);

  /**
   * Obtiene la lista de IDs de nodos asignados a un usuario específico.
   * Ruta: GET /api/getnodesbyuserid/:user_id
   */
  getNodesByUserId(user_id: string): Observable<number[]> {
    return this.http
      .get<BackendResponse<number[]>>(
        `${this.apiUrl}/getnodesbyuserid/${user_id}`,
        {
          headers: this.httpUtils.getAuthHeaders(),
        },
      )
      .pipe(
        map((response) => {
          if (!response || !('data' in response)) {
            throw new Error(
              'Estructura de respuesta inválida: falta la propiedad "data"',
            );
          }
          return response.data;
        }),
      );
  }

  /**
   * Sincroniza masivamente los nodos (alarmas) asignados a un usuario.
   * Ruta: POST /api/assign-bulk
   */
  assignNodesToUser(user_id: string, nodeIds: number[]): Observable<any> {
    const payload = {
      userId: user_id,
      nodeIds: nodeIds,
    };

    return this.http.post<BackendResponse<any>>(
      `${this.apiUrl}/assign-bulk`,
      payload,
      { headers: this.httpUtils.getAuthHeaders() },
    );
  }
}
