import { PrismaClient, Prisma } from '@prisma/client';
import { validationUtils } from '../../middlewares/validationMiddleware';
const prisma = new PrismaClient();

export const getAuditAdminActions = async ({
  adminId,
  nodeId,
  from,
  to,
  take = 20,
  skip = 0,
}: {
  adminId?: string;
  nodeId?: number;
  from?: string;
  to?: string;
  take?: number;
  skip?: number;
}) => {
  try {
    const where: Prisma.audit_admin_actionsWhereInput = {};

    // 🔹 Filtro por Admin (UUID)
    if (adminId) {
      where.admin_id = adminId;
    }

    // 🔹 Filtro por Nodo (corregido y robusto)
    if (nodeId !== undefined && nodeId !== null) {
      where.node_id = nodeId; // ⚠ IMPORTANTE: usar node_id (no nodeId)
    }

    // 🔹 Filtro por Fecha
    if (from || to) {
      where.action_timestamp = {};

      if (from) {
        // Creamos la fecha agregando la hora manualmente para evitar saltos de zona horaria
        const start = new Date(`${from}T00:00:00`);
        if (!isNaN(start.getTime())) {
          where.action_timestamp.gte = start;
        }
      }

      if (to) {
        // El final del día debe ser el último segundo
        const end = new Date(`${to}T23:59:59.999`);
        if (!isNaN(end.getTime())) {
          where.action_timestamp.lte = end;
        }
      }
    }

    return await prisma.audit_admin_actions.findMany({
      where,
      include: {
        users_audit_admin_actions_admin_idTousers: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
        users_audit_admin_actions_affected_user_idTousers: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
        nodes: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            location: true,
          },
        },
      },
      orderBy: {
        action_timestamp: 'desc',
      },
      take,
      skip,
    });
  } catch (error) {
    console.error('Error en getAuditAdminActions:', error);
    throw error;
  }
};

export const getAllNodes = async () => {
  try {
    return await prisma.nodes.findMany({
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  } catch (error) {
    console.error('Error al obtener todos los nodos:', error);
    throw error;
  }
};

export const getAuditAdminActionById = async (id: bigint) => {
  try {
    return await prisma.audit_admin_actions.findUnique({ where: { id } });
  } catch (error) {
    console.error('Error en getAuditAdminActionById:', error);
    throw error;
  }
};

export const getAdminsWithOrWithoutActions = async () => {
  return await prisma.users.findMany({
    where: {
      OR: [
        { is_master: true },
        {
          user_roles: {
            some: {
              roles: {
                name: 'ADMIN', // Asegúrate que en tu tabla 'roles' el nombre sea exactamente 'ADMIN'
              },
            },
          },
        },
      ],
    },
    include: {
      // ESTE ES EL NOMBRE CORRECTO SEGÚN TU SCHEMA
      audit_admin_actions_audit_admin_actions_admin_idTousers: {
        include: {
          nodes: true,
          users_audit_admin_actions_affected_user_idTousers: {
            select: { full_name: true, email: true },
          },
        },
        orderBy: {
          action_timestamp: 'desc',
        },
      },
    },
  });
};

export const createAuditAdminAction = async (
  data: Prisma.audit_admin_actionsCreateInput //MEJORADO (antes era any)
) => {
  try {
    // 1. Validamos el tamaño y la integridad del objeto antes de persistir
    // Esto previene ataques de DoS o inyección de carga masiva en logs
    validationUtils.audit(data);

    // 2. Persistimos el log validado
    return await prisma.audit_admin_actions.create({
      data,
    });
  } catch (error: any) {
    throw new Error('Validación de auditoría fallida: ' + error.message, { cause: error });
  }
};
