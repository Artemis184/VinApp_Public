import { Router } from 'express';
import { verifyToken } from '../../middlewares/verifyToken';
import { requireAdmin } from '../../middlewares/authorizeRoles';

import {
  getRolesByUserId,
  getUsersByRoleId,
  postAssignRoleToUser,
  deleteRemoveRoleFromUser,
} from './userRoles.controller';

const router = Router();

router.get(
  '/getrolesbyuserid/:user_id',
  // #swagger.tags = ['User Roles']
  // #swagger.description = 'Obtiene roles por ID de usuario'
  getRolesByUserId
);
router.get(
  '/getusersbyroleid/:role_id',
  // #swagger.tags = ['User Roles']
  // #swagger.description = 'Obtiene usuarios por ID de rol'
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
