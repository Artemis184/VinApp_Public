import { Router } from 'express';

import { getRoles, getRoleById, postRole, putRole, deleteRoleById } from './roles.controller';
import { verifyToken } from '../../middlewares/verifyToken';
import { requireAdmin } from '../../middlewares/authorizeRoles';

const router = Router();

// Lectura: cualquier usuario autenticado (lo usa el menú para resolver su rol).
router.get(
  '/getroles',
  // #swagger.tags = ['Roles']
  // #swagger.description = 'Obtiene todos los roles'
  verifyToken,
  getRoles
);
router.get(
  '/getrolbyid/:id',
  // #swagger.tags = ['Roles']
  // #swagger.description = 'Obtiene un rol por ID'
  verifyToken,
  getRoleById
);
// Mutaciones: solo ADMIN/MASTER. Antes estaban totalmente abiertas (sin login),
// permitiendo crear/editar/eliminar roles y romper el RBAC.
router.post(
  '/postrole',
  // #swagger.tags = ['Roles']
  // #swagger.description = 'Crea un nuevo rol'
  verifyToken,
  requireAdmin,
  postRole
);
router.put(
  '/putrole/:id',
  // #swagger.tags = ['Roles']
  // #swagger.description = 'Actualiza un rol'
  verifyToken,
  requireAdmin,
  putRole
);
router.delete(
  '/deleterole/:id',
  // #swagger.tags = ['Roles']
  // #swagger.description = 'Elimina un rol'
  verifyToken,
  requireAdmin,
  deleteRoleById
);

export default router;
