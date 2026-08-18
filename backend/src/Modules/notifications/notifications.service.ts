import { PrismaClient } from '@prisma/client';
import validator from 'validator';
import { validationUtils } from '../../middlewares/validationMiddleware';

const prisma = new PrismaClient();

const sanitizeNotificationMessage = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error('El campo message debe ser texto');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('El campo message es obligatorio');
  }

  // Escapa HTML para persistir texto plano y bloquear XSS almacenado.
  return validator.escape(trimmed);
};

export const getNotifications = async () => {
  try {
    return await prisma.notifications.findMany();
  } catch (error) {
    console.error('Error en getNotifications:', error);
    throw error;
  }
};

export const getNotificationById = async (id: bigint) => {
  try {
    return await prisma.notifications.findUnique({ where: { id } });
  } catch (error) {
    console.error('Error en getNotificationById:', error);
    throw error;
  }
};

export const createNotification = async (data: any) => {
  try {
    // El validador ya te devuelve el user_id como string (UUID)
    const cleanData = validationUtils.notification(data);

    return await prisma.notifications.create({
      data: {
        // Simplemente usa el valor tal cual lo devuelve el validador:
        user_id: cleanData.user_id,
        type: cleanData.type,
        message: cleanData.message,
      },
    });
  } catch (error: any) {
    throw new Error(error.message, { cause: error });
  }
};

export const patchNotificationStatus = async (id: bigint, data: any) => {
  try {
    const updateData = { ...data };

    // Validar y sanear de forma individual solo si el campo está presente
    if (Object.prototype.hasOwnProperty.call(updateData, 'message')) {
      updateData.message = sanitizeNotificationMessage(updateData.message);
    }

    // Si tuvieras que sanear 'type' de forma aislada, lo harías aquí con un if similar.
    // Ya no llamamos a validationUtils.notification ni sobreescribimos campos no solicitados.

    return await prisma.notifications.update({
      where: { id },
      data: updateData,
    });
  } catch (error) {
    console.error('Error en patchNotificationStatus:', error);
    throw error;
  }
};

export const deleteNotification = async (id: bigint) => {
  try {
    return await prisma.notifications.delete({ where: { id } });
  } catch (error) {
    console.error('Error en deleteNotification:', error);
    throw error;
  }
};
