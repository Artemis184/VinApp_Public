import { Request } from 'express';
import { PrismaClient, admin_action_type, user_action_type, Prisma } from '@prisma/client';

// Usar singleton global para Prisma
declare global {
  var auditLoggerPrisma: PrismaClient | undefined;
}

const prisma = global.auditLoggerPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.auditLoggerPrisma = prisma;
}

/**
 * Valida y serializa valores JSON para Prisma
 * Devuelve `undefined` si el valor no se puede usar en el campo JSON
 */
const validateJsonValue = (value: any): Prisma.InputJsonValue | undefined => {
  if (value === null || value === undefined) return undefined;
  try {
    JSON.stringify(value);
    return value;
  } catch {
    console.warn('⚠️ [AUDIT] Valor JSON inválido, ignorando:', value);
    return undefined;
  }
};

/**
 * Extrae la dirección IP del cliente usando la resolución de Express
 * (respeta `trust proxy`), con fallback al socket si no está disponible
 */
export const getClientIp = (req: Request): string => {
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

/**
 * Registra una acción de auditoría de administrador
 */
export const logAdminAudit = async (
  admin_id: string,
  action_type: admin_action_type,
  req: Request,
  options?: {
    affected_user_id?: string;
    node_id?: number;
    old_value?: any;
    new_value?: any;
  }
) => {
  // Validar que admin_id no esté vacío
  if (!admin_id || admin_id.trim() === '') {
    console.warn('⚠️ [ADMIN AUDIT] admin_id vacío, auditoría no registrada');
    return;
  }

  try {
    const ip_address = getClientIp(req);

    return await prisma.audit_admin_actions.create({
      data: {
        admin_id,
        action_type,
        ip_address,
        affected_user_id: options?.affected_user_id,
        node_id: options?.node_id,
        old_value: validateJsonValue(options?.old_value),
        new_value: validateJsonValue(options?.new_value),
      },
    });
  } catch (error) {
    console.error('🔴 [ADMIN AUDIT LOG] ERROR:', error);
    // No relanzamos el error para no bloquear la acción principal
  }
};

/**
 * Registra una acción de auditoría de usuario
 */
export const logUserAudit = async (
  user_id: string,
  action_type: user_action_type,
  req: Request,
  options?: {
    node_id?: number;
    metadata?: any;
  }
) => {
  // Validar que user_id no esté vacío
  if (!user_id || user_id.trim() === '') {
    console.warn('⚠️ [USER AUDIT] user_id vacío, auditoría no registrada');
    return;
  }

  try {
    const ip_address = getClientIp(req);

    return await prisma.audit_user_actions.create({
      data: {
        user_id,
        action_type,
        ip_address,
        node_id: options?.node_id,
        metadata: validateJsonValue(options?.metadata),
      },
    });
  } catch (error) {
    console.error('🔴 [USER AUDIT LOG] ERROR:', error);
    // No relanzamos el error para no bloquear la acción principal
  }
};
