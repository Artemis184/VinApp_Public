import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { switchMap, map } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  // Llama a GET /api/menus
  getAllMenus() {
    return this.http.get<any[]>(`${this.api}/menus`);
  }

  // Llama a GET /api/getroles y busca el rol por nombre
  private getRoleIdByName(roleName: string) {
    if (!roleName) return of(null);
    return this.http.get<any>(`${this.api}/getroles`).pipe(
      map((res) => {
        // El backend devuelve { cant, data, message }.
        const roles = Array.isArray(res) ? res : res?.data || [];
        const found = (roles || []).find((r: any) => r.name === roleName);
        return found ? found.id : null;
      }),
    );
  }

  // Llama a GET /api/menus/role/:roleId
  getMenusByRoleId(roleId: number) {
    if (!roleId) return of([]);
    return this.http.get<any[]>(`${this.api}/menus/role/${roleId}`);
  }

  /**
   * Obtiene menús usando el nombre del rol desde localStorage
   * El backend decide qué menús incluir basándose en el JWT
   */
  getMenusForRoleName(roleName: string) {
    // obtener id del rol por nombre y luego pedir menús por id
    return this.getRoleIdByName(roleName).pipe(
      switchMap((roleId) => {
        if (!roleId) return of([]);
        return this.getMenusByRoleId(roleId).pipe(
          map((menus) => {
            // backend ya filtra por is_menu=true
            // además filtra menús /master basándose en JWT
            const filtered = (menus || []).filter((m: any) => m.is_active);
            return filtered;
          }),
        );
      }),
    );
  }
}
