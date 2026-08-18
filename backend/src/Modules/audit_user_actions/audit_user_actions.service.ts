import { PrismaClient } from '@prisma/client';
import { validationUtils } from '../../middlewares/validationMiddleware';
const prisma = new PrismaClient();

export const getAuditUserActions = async () => {
  try {
    return await prisma.audit_user_actions.findMany();
  } catch (error) {
    console.error('Error en getAuditUserActions:', error);

    throw error;
  }
};

export const getAuditUserActionById = async (id: bigint) => {
  try {
    return await prisma.audit_user_actions.findUnique({ where: { id } });
  } catch (error) {
    console.error('Error en getAuditUserActionById:', error);
    throw error;
  }
};

export const createAuditUserAction = async (data: any) => {
  try {
    validationUtils.audit(data.metadata || {});
    return await prisma.audit_user_actions.create({
      data: {
        user_id: data.user_id,
        node_id: data.node_id,
        action_type: data.action_type,
        metadata: data.metadata,
      },
    });
  } catch (error) {
    console.error('Error al crear auditoría usuario:', error);
    throw error;
  }
};

export const deleteAuditUserAction = async (id: bigint) => {
  try {
    return await prisma.audit_user_actions.delete({ where: { id } });
  } catch (error) {
    console.error('Error en deleteAuditUserAction:', error);
    throw error;
  }
};

export const getAuditUserActionsAlarma = async (
  nodeId?: number,
  startDate?: Date,
  endDate?: Date
) => {
  try {
    // 1. Iniciamos con las condiciones base obligatorias
    const where: any = {
      action_type: {
        in: ['ALARM_ON', 'ALARM_OFF'],
      },
    };

    // 2. Agregamos el filtro de nodo solo si existe un valor válido
    if (nodeId !== undefined) {
      where.node_id = nodeId;
    }

    // 3. Construimos el filtro de fechas dinámicamente para evitar campos vacíos
    if (startDate || endDate) {
      where.action_timestamp = {};

      if (startDate) {
        where.action_timestamp.gte = startDate;
      }

      if (endDate) {
        where.action_timestamp.lte = endDate;
      }
    }

    // 4. Ejecutamos la consulta con el objeto 'where' limpio
    return await prisma.audit_user_actions.findMany({
      where,
      include: {
        users: { select: { full_name: true } },
        nodes: { select: { code: true, description: true } },
      },
      orderBy: {
        action_timestamp: 'desc',
      },
    });
  } catch (error) {
    console.error('Error en getAuditUserActionsAlarma:', error);
    throw error;
  }
};

export const getAllNodesBase = async () => {
  try {
    return await prisma.nodes.findMany({
      select: {
        id: true,
        code: true,
        description: true,
      },
    });
  } catch (error) {
    console.error('Error en getAllNodesBase:', error);
    throw error;
  }
};

export const getNodesWithLastAudit = async (nodeId?: number, from?: Date, to?: Date) => {
  return await prisma.nodes.findMany({
    where: nodeId ? { id: nodeId } : {},
    include: {
      // Traemos la última acción de usuario (activaciones)
      audit_user_actions: {
        where: {
          action_timestamp: { gte: from, lte: to },
          action_type: { in: ['ALARM_ON', 'ALARM_OFF'] },
        },
        orderBy: { action_timestamp: 'desc' },
        take: 1,
        include: { users: true },
      },
      // Traemos la última acción de admin (lo que tú insertaste)
      audit_admin_actions: {
        where: {
          action_timestamp: { gte: from, lte: to },
        },
        orderBy: { action_timestamp: 'desc' },
        take: 1,
        include: { users_audit_admin_actions_admin_idTousers: true },
      },
    },
  });
};
