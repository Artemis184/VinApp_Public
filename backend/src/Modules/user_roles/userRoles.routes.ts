import { Router } from 'express';
import { verifyToken } from '../../middlewares/verifyToken';
import { requireAdmin, requireSelfOrAdmin } from '../../middlewares/authorizeRoles';

import {
  getRolesByUserId,
  getUsersByRoleId,
  postAssignRoleToUser,
  deleteRemoveRoleFromUser,
} from './userRoles.controller';

const router = Router();

// Antes sin auth. Los roles de un usuario los puede ver él mismo o un admin.
router.get(
  '/getrolesbyuserid/:user_id',
  // #swagger.tags = ['User Roles']
  // #swagger.description = 'Obtiene roles por ID de usuario'
  verifyToken,
  requireSelfOrAdmin('user_id'),
  getRolesByUserId
);
// Listar todos los usuarios de un rol es información administrativa.
router.get(
  '/getusersbyroleid/:role_id',
  // #swagger.tags = ['User Roles']
  // #swagger.description = 'Obtiene usuarios por ID de rol'
  verifyToken,
  requireAdmin,
  getUsersByRoleId
);
router.post('/postassignroletouser', verifyToken, requireAdmin, postAssignRoleToUser);
router.delete(
  '/deleteremoverolefromuser',
  verifyToken,
  requireAdmin,
  // #swagger.tags = ['User Roles']
  // #swagger.description = 'Remueve un rol de un usuario'
  deleteRemoveRoleFromUser
);

export default router;
