import { Request, Response } from 'express';
import * as service from './notifications.service';
import { serializeBigInt } from '../../SerializeBigInt/serializeBigInt';
import { logAdminAudit } from '../../utils/auditLogger';

interface AuthenticatedRequest extends Request {
  user?: {
    user_uuid: string;
  };
}

// Helper para normalizar parámetros de ruta (pueden ser string | string[])
const getParam = (param: string | string[] | undefined): string => {
  return Array.isArray(param) ? param[0] : param || '';
};

export const getNotifications = async (_req: Request, res: Response) => {
  try {
    const data = await service.getNotifications();
    res.status(200).json({
      cant: data.length,
      data: serializeBigInt(data),
      message: 'Notificaciones obtenidas exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ message: 'Error al obtener notificaciones' });
  }
};

export const getNotificationById = async (req: Request, res: Response) => {
  try {
    const data = await service.getNotificationById(BigInt(getParam(req.params.id)));
    if (data) {
      res.status(200).json({
        data: serializeBigInt(data),
        message: 'Notificación obtenida exitosamente',
      });
    } else {
      res.status(404).json({ message: 'Notificación no encontrada' });
    }
  } catch (error) {
    console.error('Error al obtener notificación por ID:', error);
    res.status(500).json({ message: 'Error al obtener notificación por ID' });
  }
};

export const postNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await service.createNotification(req.body);

    // Auditar envío de notificación - siempre como acción de admin
    // (protegido por verifyToken + authorizeRoles en routes)
    const adminId = req.user?.user_uuid;
    if (adminId) {
      await logAdminAudit(adminId, 'SEND_NOTIFICATION', req, {
        affected_user_id: req.body.user_id,
        new_value: { notification_type: req.body.type, message: req.body.message },
      });
    }

    res.status(201).json({
      data: serializeBigInt(data),
      message: 'Notificación creada exitosamente',
    });
  } catch (error: any) {
    console.error('Error al crear notificación:', error);
    res.status(500).json({ message: error.message || 'Error al registrar notificación' });
  }
};

export const patchNotificationStatus = async (req: Request, res: Response) => {
  try {
    const data = await service.patchNotificationStatus(BigInt(getParam(req.params.id)), req.body);
    res.status(200).json({
      data: serializeBigInt(data),
      message: 'Estado de notificación actualizado exitosamente',
    });
  } catch (error) {
    console.error('Error al actualizar estado de notificación:', error);
    res.status(500).json({ message: 'Error al actualizar estado' });
  }
};

export const deleteNotificationById = async (req: Request, res: Response) => {
  try {
    const data = await service.deleteNotification(BigInt(getParam(req.params.id)));
    res.status(200).json({
      data: serializeBigInt(data),
      message: 'Notificación eliminada exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar notificación:', error);
    res.status(500).json({ message: 'Error al eliminar notificación' });
  }
};
