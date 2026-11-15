import { Router } from 'express';
import {
  getAuditUserActions,
  getAuditUserActionById,
  postAuditUserAction,
  deleteAuditUserActionById,
  getAuditUserActionsAlarma,
  getNodesBaseList,
} from './audit_user_actions.controller';
import { validationUtils } from '../../middlewares/validationMiddleware';
import { verifyToken } from '../../middlewares/verifyToken';
import { requireAdmin } from '../../middlewares/authorizeRoles';

const router = Router();

// La auditoría de usuarios (incluye el historial de alarmas ALARM_ON/OFF y la
// eliminación de registros) expone/altera información sensible y de integridad:
// exigir JWT + rol ADMIN/MASTER en todo el módulo, igual que audit_admin_actions.
router.use(verifyToken, requireAdmin);

router.get(
  '/getaudituseractions',
  // #swagger.tags = ['Audit User Actions']
  // #swagger.description = 'Obtiene todas las acciones de auditoría de usuarios'
  getAuditUserActions
);
router.get(
  '/getaudituseractionbyid/:id',
  // #swagger.tags = ['Audit User Actions']
  // #swagger.description = 'Obtiene una acción de auditoría de usuario por ID'
  getAuditUserActionById
);
router.post(
  '/postaudituseraction',
  // #swagger.tags = ['Audit User Actions']
  // #swagger.description = 'Registra una acción de auditoría de usuario'
  (req, res, next) => {
    try {
      // Validamos que el JSON de auditoría no exceda los límites de seguridad
      validationUtils.audit(req.body.metadata || {});
      next();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
  postAuditUserAction
);
router.delete(
  '/deleteaudituseractionbyid/:id',
  // #swagger.tags = ['Audit User Actions']
  // #swagger.description = 'Elimina una acción de auditoría de usuario'
  deleteAuditUserActionById
);
router.get(
  '/getaudituseractionsalarma',
  // #swagger.tags = ['Audit User Actions']
  // #swagger.description = 'Obtiene solo las acciones de auditoría relacionadas con alarmas (ALARM_ON / ALARM_OFF)'
  getAuditUserActionsAlarma
);
router.get(
  '/getnodesbase',
  // #swagger.tags = ['Audit User Actions']
  // #swagger.description = 'Obtiene la lista base de alarmas cuando no hay historial'
  getNodesBaseList
);

export default router;
