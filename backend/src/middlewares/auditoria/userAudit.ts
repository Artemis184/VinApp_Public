import { PrismaClient, user_action_type } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { getClientIp } from '../../utils/auditLogger';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    user_uuid: string;
  };
}

interface UserAuditOptions {
  action: user_action_type | ((req: AuthRequest) => user_action_type);
  getNodeId?: (req: AuthRequest) => number | null;
  getMetadata?: (req: AuthRequest) => any | Promise<any>;
}

export const userAudit =
  ({ action, getNodeId, getMetadata }: UserAuditOptions) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.user_uuid;
      if (!userId) return next();

      const actionType = typeof action === 'function' ? action(req) : action;
      const nodeId = getNodeId ? getNodeId(req) : null;
      const metadata = getMetadata ? await getMetadata(req) : null;
      const ipAddress = getClientIp(req);

      await prisma.audit_user_actions.create({
        data: {
          user_id: userId,
          node_id: nodeId,
          action_type: actionType,
          metadata,
          ip_address: ipAddress,
        },
      });

      next();
    } catch (error) {
      console.error('🔴 [USER AUDIT] ERROR:', error);
      next();
    }
  };
