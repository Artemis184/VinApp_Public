import { Router } from 'express';
import { GetMenus } from './Access.controller';

const router = Router();

router.get(
  '/menus/:id_rol',
  // #swagger.tags = ['Access']
  // #swagger.description = 'Obtiene los menús disponibles según el rol'
  GetMenus
);

export default router;
