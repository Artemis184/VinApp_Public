import { PrismaClient, Prisma, admin_action_type } from '@prisma/client';

const prisma = new PrismaClient();

export class UserRolesServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'UserRolesServiceError';
    this.statusCode = statusCode;
  }
}

export const asignarRolaUser = async (
  user_id: string,
  role_id: number,
  options?: { admin_id?: string }
) => {
  try {
    const targetUser = await prisma.users.findUnique({
      where: { id: user_id },
      select: { id: true },
    });

    if (!targetUser) {
      throw new UserRolesServiceError('El usuario especificado no existe.', 404);
    }

    const role = await prisma.roles.findUnique({
      where: { id: role_id },
      select: { id: true },
    });

    if (!role) {
      throw new UserRolesServiceError('El rol especificado no existe.', 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      const existe_Relacion = await tx.user_roles.findUnique({
        where: {
          user_id_role_id: {
            user_id,
            role_id,
          },
        },
        select: {
          user_id: true,
          role_id: true,
        },
      });

      if (existe_Relacion) {
        throw new UserRolesServiceError('El usuario ya tiene asignado este rol', 409);
      }

      const nuevo_User_Rol = await tx.user_roles.create({
        data: {
          user_id,
          role_id,
        },
      });

      if (options?.admin_id) {
        await tx.audit_admin_actions.create({
          data: {
            admin_id: options.admin_id,
            affected_user_id: user_id,
            action_type: admin_action_type.ASSIGN_ROLE,
            old_value: Prisma.JsonNull,
            new_value: {
              user_id,
              role_id,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return nuevo_User_Rol;
    });

    return result;
  } catch (error) {
    if (error instanceof UserRolesServiceError) {
      throw error;
    }

    console.error('Error al asignar rol al usuario:', error);
    throw new UserRolesServiceError('Error al asignar rol al usuario', 500);
  }
};

export const removerRolaUser = async (
  user_id: string,
  role_id: number,
  options?: { admin_id?: string }
) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const oldRoleRelation = await tx.user_roles.findUnique({
        where: {
          user_id_role_id: {
            user_id,
            role_id,
          },
        },
        select: {
          user_id: true,
          role_id: true,
        },
      });

      if (!oldRoleRelation) {
        throw new UserRolesServiceError('El usuario no tiene asignado este rol', 404);
      }

      const rol_Eliminado = await tx.user_roles.delete({
        where: {
          user_id_role_id: {
            user_id,
            role_id,
          },
        },
      });

      if (options?.admin_id) {
        await tx.audit_admin_actions.create({
          data: {
            admin_id: options.admin_id,
            affected_user_id: user_id,
            action_type: admin_action_type.REVOKE_ROLE,
            old_value: oldRoleRelation as Prisma.InputJsonValue,
            new_value: {
              user_id,
              role_id,
              removed: true,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return rol_Eliminado;
    });

    return result;
  } catch (error) {
    if (error instanceof UserRolesServiceError) {
      throw error;
    }

    console.error('Error al quitar el rol al usuario:', error);
    throw new UserRolesServiceError('Error al quitar el rol al usuario', 500);
  }
};

export const obtenerRolesporUserId = async (user_id: string) => {
  try {
    const lista_Roles = await prisma.user_roles.findMany({
      where: { user_id },
      include: {
        roles: true,
      },
    });

    return lista_Roles;
  } catch (error) {
    console.error('Error al obtener roles del usuario:', error);
    throw new Error('Error al obtener roles del usuario', { cause: error });
  }
};

export const obtenerUsersporRoleId = async (role_id: number) => {
  try {
    const lista_Usuarios = await prisma.user_roles.findMany({
      where: { role_id },
      include: {
        users: true,
      },
    });

    return lista_Usuarios;
  } catch (error) {
    console.error('Error al obtener usuarios por rol:', error);
    throw new Error('Error al obtener usuarios por rol', { cause: error });
  }
};
