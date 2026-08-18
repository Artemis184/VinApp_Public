import { Router } from 'express';
import {
  getAuditAdminActions,
  getAuditAdminActionById,
  postAuditAdminAction,
  getMasterAdminList,
  getAllNodes,
} from './audit_admin_actions.controller';
import { verifyToken } from '../../middlewares/verifyToken';
import { requireAdmin } from '../../middlewares/authorizeRoles';
import { validationUtils } from '../../middlewares/validationMiddleware';

const router = Router();

// Auditoría de admins y endpoints /master: exigir JWT + rol ADMIN/MASTER.
router.use(verifyToken, requireAdmin);

router.get(
  '/getauditadminactions',
  // #swagger.tags = ['Audit Admin Actions']
  // #swagger.description = 'Obtiene todas las acciones de auditoría de administradores'
  getAuditAdminActions
);
router.get(
  '/getauditadminactionbyid/:id',
  // #swagger.tags = ['Audit Admin Actions']
  // #swagger.description = 'Obtiene una acción de auditoría de administrador por ID'
  getAuditAdminActionById
);
router.post(
  '/postauditadminaction',
  // #swagger.tags = ['Audit Admin Actions']
  // #swagger.description = 'Registra una acción de auditoría de administrador'
  (req, res, next) => {
    try {
      // Validamos que el objeto de auditoría cumpla con los límites de tamaño
      validationUtils.audit(req.body);
      next();
    } catch (error: any) {
      // Si la validación falla, bloqueamos el registro del log
      res.status(400).json({ error: error.message });
    }
  },
  postAuditAdminAction
);

// ESTA RUTA (Asegúrate que la URL sea idéntica a la del error 404)
router.get(
  '/master/lista-auditoria-admins',
  // #swagger.tags = ['Audit Admin Actions']
  // #swagger.description = 'Obtiene la lista maestra de administradores con o sin acciones'
  getMasterAdminList
);

//ruta para las alarmas
router.get(
  '/get-all-nodes',
  // #swagger.tags = ['Audit Admin Actions']
  getAllNodes
);

export default router;
