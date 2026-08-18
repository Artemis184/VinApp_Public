import { Routes } from '@angular/router';

export const administratorRoutes: Routes = [
  {
    path: 'principal-administrador',
    loadComponent: () =>
      import('./principal-administrador/principal-administrador.page').then(
        (m) => m.PrincipalAdministradorPage,
      ),
  },
  {
    path: 'lista-alarmas',
    loadComponent: () =>
      import('./lista-alarmas/lista-alarmas.page').then(
        (m) => m.ListaAlarmasPage,
      ),
  },
  {
    path: 'editar-alarma/:id',
    loadComponent: () =>
      import('./editar-alarma/editar-alarma.page').then(
        (m) => m.EditarAlarmaPage,
      ),
  },
  {
    path: 'admin-auditoria',
    loadComponent: () =>
      import('./admin-auditoria/admin-auditoria.page').then(
        (m) => m.AdminAuditoriaPage,
      ),
  },
  {
    path: 'admin-usuarios',
    loadComponent: () =>
      import('./admin-usuarios/admin-usuarios.page').then(
        (m) => m.AdminUsuariosPage,
      ),
  },
  {
    path: 'admin-detusuario',
    loadComponent: () =>
      import('./admin-detusuario/admin-detusuario.page').then(
        (m) => m.AdminDetusuarioPage,
      ),
  },
  {
    path: 'listado-pendientes-acciones',
    loadComponent: () =>
      import('./listado-pendientes-acciones/listado-pendientes-acciones.page').then(
        (m) => m.ListadoPendientesAccionesPage,
      ),
  },
  {
    path: 'listado-usu/:id',
    loadComponent: () =>
      import('./listado-usu/listado-usu.page').then((m) => m.ListadoUsuPage),
  },
  {
    path: 'admin-editusuario',
    loadComponent: () =>
      import('./admin-editusuario/admin-editusuario.page').then(
        (m) => m.AdminEditusuarioPage,
      ),
  },
  {
    path: 'admin-confirusuario',
    loadComponent: () =>
      import('./admin-confirusuario/admin-confirusuario.page').then(
        (m) => m.AdminConfirusuarioPage,
      ),
  },
];
