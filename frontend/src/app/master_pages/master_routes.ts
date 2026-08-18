import { Routes } from '@angular/router';

export const masterRoutes: Routes = [
  // Agregar rutas de master aquí cuando sea necesario
  {
    path: 'lista-auditoria-admins',
    loadComponent: () =>
      import('./lista-auditoria-admins/lista-auditoria-admins.page').then(
        (m) => m.ListaAuditoriaAdminsPage,
      ),
  },
];
