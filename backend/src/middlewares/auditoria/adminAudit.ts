import { PrismaClient, admin_action_type } from '@prisma/client';
import { Response, NextFunction, Request } from 'express';
import { getClientIp } from '../../utils/auditLogger';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    user_uuid: string; // UUID REAL
  };
  node?: {
    id: number; // ID NUMERICO
  };
}

interface AdminAuditOptions {
  action: admin_action_type;
  getOldValue?: (req: AuthRequest) => Promise<any>;
  getNewValue?: (req: AuthRequest) => any;
  getAffectedUserId?: (req: AuthRequest) => string | null | Promise<string | null>;
  getAffectedNodeId?: (req: AuthRequest) => number | null | Promise<number | null>;
}

export const adminAudit =
  ({ action, getOldValue, getNewValue, getAffectedUserId, getAffectedNodeId }: AdminAuditOptions) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🟡 [ADMIN AUDIT] Middleware iniciado');
    }

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('🟡 [ADMIN AUDIT] req.user:', req.user);
      }

      const adminId = req.user?.user_uuid;
      if (!adminId) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('🟠 [ADMIN AUDIT] adminId NO encontrado');
        }
        return next();
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('🟢 [ADMIN AUDIT] adminId:', adminId);
        console.log('🟡 [ADMIN AUDIT] req.params:', req.params);
      }

      let oldValue = null;
      if (getOldValue) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('🟡 [ADMIN AUDIT] Obteniendo oldValue...');
        }
        oldValue = await getOldValue(req);
        if (process.env.NODE_ENV !== 'production') {
          console.log('🟢 [ADMIN AUDIT] oldValue:', oldValue);
        }
      }

      let newValue = null;
      if (getNewValue) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('🟡 [ADMIN AUDIT] Obteniendo newValue...');
        }
        newValue = getNewValue(req);
        if (process.env.NODE_ENV !== 'production') {
          console.log('🟢 [ADMIN AUDIT] newValue:', newValue);
        }
      }

      const affectedUserId = getAffectedUserId ? await getAffectedUserId(req) : null;

      const affectedNodeId = getAffectedNodeId ? await getAffectedNodeId(req) : null;

      const ipAddress = getClientIp(req);

      if (process.env.NODE_ENV !== 'production') {
        console.log('🟢 [ADMIN AUDIT] affectedUserId:', affectedUserId);
      }

      await prisma.audit_admin_actions.create({
        data: {
          admin_id: adminId,
          affected_user_id: affectedUserId,
          node_id: affectedNodeId,
          action_type: action,
          old_value: oldValue ?? null,
          new_value: newValue ?? null,
          ip_address: ipAddress,
        },
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log('🟢 [ADMIN AUDIT] INSERT OK');
      }

      next();
    } catch (error) {
      console.error('🔴 [ADMIN AUDIT] ERROR:', error);
      next(); // no romper el flujo
    }
  };
