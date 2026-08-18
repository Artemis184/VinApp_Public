import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';

export type EstadoPeticion = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface UsuarioPendiente {
  id: string;
  nombre: string;
  telefono: string;
  correo: string;
  direccion: string;
  referencia: string;
  edad: number;
  estado: EstadoPeticion;
  alarmasSeleccionadas: number[]; // ✅ AHORA EXISTE
}

interface BackendUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  reference: string | null;
  age: number | null;
}

interface BackendResponse {
  data: BackendUser[];
}

@Injectable({
  providedIn: 'root',
})
export class UsuPendientesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users`;

  /* =========================
      LISTAR PENDIENTES
     ========================= */
  getUsuarios(): Observable<UsuarioPendiente[]> {
    return this.http.get<BackendResponse>(`${this.apiUrl}/pending`).pipe(
      map((response) =>
        Array.isArray(response?.data)
          ? response.data.map((user) => ({
              id: user.id,
              nombre: user.full_name ?? 'Sin nombre',
              telefono: user.phone ?? 'Sin teléfono',
              correo: user.email,
              direccion: user.address ?? 'Sin dirección',
              referencia: user.reference ?? 'Sin referencia',
              edad: user.age ?? 0,
              estado: 'PENDIENTE',
              alarmasSeleccionadas: [], // ✅ inicializamos
            }))
          : [],
      ),
    );
  }

  /* =========================
      OBTENER USUARIO POR ID
     ========================= */
  getUsuarioById(id: string): Observable<UsuarioPendiente> {
    return this.getUsuarios().pipe(
      map((usuarios) => usuarios.find((u) => u.id === id)!),
    );
  }

  /* =========================
    APROBAR USUARIO
   ========================= */
  aprobarUsuario(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/approveuser/${id}`, {});
  }

  /* =========================
      RECHAZAR USUARIO
     ========================= */
  rechazarUsuario(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/rejectuser/${id}`, {});
  }

  /* =========================
      ASIGNAR NODO
     ========================= */
  asignarNodo(userId: string, nodeId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/user_nodes/postusernode`, {
      user_id: userId,
      node_id: nodeId,
    });
  }

  /* =========================
      CONTADOR PENDIENTES
     ========================= */
  getCantidadPendientes(): Observable<number> {
    return this.http
      .get<BackendResponse>(`${this.apiUrl}/pending`)
      .pipe(map((res) => res?.data?.length ?? 0));
  }
}
