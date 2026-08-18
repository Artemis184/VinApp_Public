import { Router } from 'express';
import { authorizeRoles } from '../../middlewares/authorizeRoles';
import { validationUtils } from '../../middlewares/validationMiddleware'; // Importa tu validador
import {
  getNotifications,
  getNotificationById,
  postNotification,
  patchNotificationStatus,
  deleteNotificationById,
} from './notifications.controller';
import { verifyToken } from '../../middlewares/verifyToken';
import { requireAdmin } from '../../middlewares/authorizeRoles';

const router = Router();

// Auditoría/notificaciones suelen exponer información sensible: exigir JWT + rol ADMIN/MASTER.
router.use(verifyToken, requireAdmin);

router.get(
  '/getnotifications',
  // #swagger.tags = ['Notifications']
  // #swagger.description = 'Obtiene todas las notificaciones'
  (req, res, next) => {
    try {
      // Validamos y saneamos los datos antes de pasar al controlador
      req.body = validationUtils.notification(req.body);
      next();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
  getNotifications
);
router.get(
  '/getnotificationbyid/:id',
  // #swagger.tags = ['Notifications']
  // #swagger.description = 'Obtiene una notificación por ID'
  getNotificationById
);
router.post(
  '/postnotification',
  verifyToken,
  authorizeRoles(['Admin', 'SuperAdmin']),
  // #swagger.tags = ['Notifications']
  // #swagger.description = 'Crea una nueva notificación - Solo administradores'
  postNotification
);
router.patch(
  '/patchnotificationstatus/:id',
  // #swagger.tags = ['Notifications']
  // #swagger.description = 'Actualiza el estado de una notificación'
  (req, res, next) => {
    try {
      if (req.body && Object.keys(req.body).length > 0) {
        // 1. Pasamos el body por nuestro nuevo validador parcial.
        // Solo revisará y saneará 'type' y 'message' si existen.
        const cleanUpdateData = validationUtils.notificationUpdate(req.body);
        // 2. Mezclamos el body original con los datos saneados.
        // Así preservamos campos que no son de texto (ej. is_read: true)
        // pero aseguramos que 'message' y 'type' estén escapados.
        req.body = { ...req.body, ...cleanUpdateData };
      }
      next();
    } catch (error: any) {
      // Devolvemos 400 Bad Request si la validación falla (ej. message no es string)
      return res.status(400).json({ error: error.message });
    }
  },
  patchNotificationStatus
);

router.delete(
  '/deletenotificationbyid/:id',
  // #swagger.tags = ['Notifications']
  // #swagger.description = 'Elimina una notificación'
  deleteNotificationById
);

export default router;
