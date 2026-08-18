import { PrismaClient, user_status } from '@prisma/client';
const prisma = new PrismaClient();

export const getUserNodes = async () => {
  try {
    return await prisma.user_nodes.findMany();
  } catch (error) {
    console.error('Error en getUserNodes:', error);
    throw error;
  }
};

export const getUserNodeById = async (id: number) => {
  try {
    return await prisma.user_nodes.findUnique({ where: { id } });
  } catch (error) {
    console.error('Error en getUserNodeById:', error);
    throw error;
  }
};

export const getNodesByUserId = async (user_id: string) => {
  try {
    // Buscamos las relaciones activas (no revocadas) para este usuario
    const userNodes = await prisma.user_nodes.findMany({
      where: {
        user_id: user_id,
        is_revoked: false,
      },
      select: {
        node_id: true, // Solo necesitamos los IDs para marcar los checkboxes
      },
      orderBy: { node_id: 'asc' },
    });

    return userNodes.map((relation) => relation.node_id);
  } catch (error) {
    console.error('Error en getNodesByUserId:', error);
    throw error;
  }
};

export const createOrReactivateUserNode = async (data: {
  user_id: string;
  node_id: number;
  assigned_by: string;
}) => {
  // 1️⃣ Validar usuario
  const user = await prisma.users.findUnique({
    where: { id: data.user_id },
    select: { id: true, status: true },
  });

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (user.status !== user_status.APPROVED) {
    throw new Error('El usuario no está aprobado para asignar nodos');
  }

  // 2️⃣ Buscar relación existente
  const existing = await prisma.user_nodes.findUnique({
    where: {
      user_id_node_id: {
        user_id: data.user_id,
        node_id: data.node_id,
      },
    },
  });

  // 3️⃣ Reactivar si existe
  if (existing) {
    if (existing.is_revoked) {
      return prisma.user_nodes.update({
        where: { id: existing.id },
        data: {
          is_revoked: false,
          revoked_at: null,
          assigned_by: data.assigned_by,
          assigned_at: new Date(),
        },
      });
    }

    throw new Error('El usuario ya tiene asignado este nodo');
  }

  // 4️⃣ Crear si no existe
  return prisma.user_nodes.create({
    data: {
      user_id: data.user_id,
      node_id: data.node_id,
      assigned_by: data.assigned_by,
    },
  });
};

export const patchUserNodeStatus = async (id: number, data: any) => {
  try {
    return await prisma.user_nodes.update({
      where: { id },
      data,
    });
  } catch (error) {
    console.error('Error en patchUserNodeStatus:', error);
    throw error;
  }
};

export const deleteUserNode = async (id: number) => {
  try {
    return await prisma.user_nodes.delete({ where: { id } });
  } catch (error) {
    console.error('Error en deleteUserNode:', error);
    throw error;
  }
};

// Nueva función para manejar el guardado masivo del modal
export const sincronizarNodosUsuario = async (
  userId: string,
  nodeIds: number[],
  assignedBy: string
) => {
  try {
    // 1. Validar existencia del usuario
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { full_name: true, status: true },
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    /**
     * 🛡️ VALIDACIÓN LÓGICA:
     * Solo bloqueamos si se intentan ASIGNAR nodos (nodeIds > 0) a alguien no aprobado.
     * Si el admin está quitando todo (nodeIds = 0), permitimos la acción sin importar el estado.
     */
    if (nodeIds.length > 0 && user.status !== user_status.APPROVED) {
      throw new Error('No se pueden mantener o asignar alarmas a un usuario que no esté APROBADO');
    }

    // 2. Ejecución atómica
    return await prisma.$transaction(async (tx) => {
      // Limpieza total de asignaciones previas
      await tx.user_nodes.deleteMany({
        where: { user_id: userId },
      });

      // Creamos las nuevas asignaciones solo si el usuario está aprobado y hay IDs
      if (nodeIds.length > 0) {
        const dataToInsert = nodeIds.map((id) => ({
          user_id: userId,
          node_id: id,
          assigned_by: assignedBy,
          is_revoked: false,
        }));

        await tx.user_nodes.createMany({
          data: dataToInsert,
        });
      }

      return {
        full_name: user.full_name || 'Usuario Desconocido',
        count: nodeIds.length,
        nodeIds: nodeIds.join(', '),
      };
    });
  } catch (error: any) {
    console.error('Error en sincronizarNodosUsuario:', error);
    throw new Error(error.message || 'Error al sincronizar nodos', { cause: error });
  }
};
