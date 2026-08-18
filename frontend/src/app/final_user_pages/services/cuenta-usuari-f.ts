import { Injectable } from '@angular/core';

export interface UsuarioFinal {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  foto: string;
  password: string;
  rol: 'ADMIN' | 'CLIENT';
}

@Injectable({
  providedIn: 'root',
})
export class CuentaUsuariF {
  // 🔐 Usuario actualmente autenticado
  private usuarioActivo: UsuarioFinal | null = null;

  constructor() {}
}
