import { Routes } from '@angular/router';

export const masterRoutes: Routes = [
  {
    path: 'lista-auditoria-admins',
    loadComponent: () =>
      import('./lista-auditoria-admins/lista-auditoria-admins.page').then(
        (m) => m.ListaAuditoriaAdminsPage,
      ),
  },
  {
    path: 'graficas-salud-nodos',
    loadComponent: () =>
      import('./graficas-salud-nodos/graficas-salud-nodos.page').then(
        (m) => m.GraficasSaludNodosPage,
      ),
  },
];
