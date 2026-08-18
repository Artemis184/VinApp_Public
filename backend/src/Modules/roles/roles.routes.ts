import { Router } from 'express';

import { getRoles, getRoleById, postRole, putRole, deleteRoleById } from './roles.controller';

const router = Router();

router.get(
  '/getroles',
  // #swagger.tags = ['Roles']
  // #swagger.description = 'Obtiene todos los roles'
  getRoles
);
router.get(
  '/getrolbyid/:id',
  // #swagger.tags = ['Roles']
  // #swagger.description = 'Obtiene un rol por ID'
  getRoleById
);
router.post(
  '/postrole',
  // #swagger.tags = ['Roles']
  // #swagger.description = 'Crea un nuevo rol'
  postRole
);
router.put(
  '/putrole/:id',
  // #swagger.tags = ['Roles']
  // #swagger.description = 'Actualiza un rol'
  putRole
);
router.delete(
  '/deleterole/:id',
  // #swagger.tags = ['Roles']
  // #swagger.description = 'Elimina un rol'
  deleteRoleById
);

export default router;
