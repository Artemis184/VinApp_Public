import { Routes } from '@angular/router';

export const finalUserRoutes: Routes = [
  {
    path: 'principal-usuariof',
    loadComponent: () =>
      import('./principal-usuariof/principal-usuariof.page').then(
        (m) => m.PrincipalUsuariofPage,
      ),
  },
  {
    path: 'datos-usuario-f',
    loadComponent: () =>
      import('./datos-usuario-f/datos-usuario-f.page').then(
        (m) => m.DatosUsuarioFPage,
      ),
  },
];
