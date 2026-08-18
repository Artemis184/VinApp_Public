import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Usuario } from 'src/app/interfaces/usuario.interface';

// Respuesta del backend
interface BackendResponse {
  cant: number;
  data: Usuario[];
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminUsuarios {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users`;

  /**
   * Obtiene todos los usuarios desde el backend
   */
  getUsuarios(): Observable<Usuario[]> {
    return this.http.get<BackendResponse>(`${this.apiUrl}/getusers`).pipe(
      map((response) => {
        if (!Array.isArray(response?.data)) {
          return [];
        }
        return response.data;
      }),
    );
  }

  /**
   * Obtiene un usuario específico por ID desde el backend
   */
  getUserById(id: string): Observable<Usuario> {
    return this.http
      .get<{ data: Usuario; message: string }>(`${this.apiUrl}/getuser/${id}`)
      .pipe(map((response) => response.data));
  }

  updateUser(
    id: string,
    payload: Partial<Usuario>, // 👈 Ahora acepta 'status', 'age', etc.
  ): Observable<Usuario> {
    return this.http
      .patch<{
        data: Usuario;
        message: string;
      }>(`${this.apiUrl}/updateuser/${id}`, payload)
      .pipe(map((response) => response.data));
  }
}
