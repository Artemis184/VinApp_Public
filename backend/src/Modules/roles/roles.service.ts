import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const obtenerTodoRoles = async () => {
  try {
    const lista_Roles = await prisma.roles.findMany();
    return lista_Roles;
  } catch (error) {
    console.error('Error al obtener los roles:', error);
    throw new Error('Error al obtener los roles', { cause: error });
  }
};

export const obtenerRolporId = async (id: number) => {
  try {
    const rol = await prisma.roles.findUnique({
      where: { id },
    });
    return rol;
  } catch (error) {
    console.error('Error al obtener el rol por ID:', error);
    throw new Error('Error al obtener el rol por ID', { cause: error });
  }
};

export const createRole = async (name: string, description?: string) => {
  try {
    const existe_Rol = await prisma.roles.findUnique({
      where: { name },
    });

    if (existe_Rol) {
      throw new Error('El rol ya existe');
    }

    const nuevo_Rol = await prisma.roles.create({
      data: {
        name,
        description,
      },
    });

    return nuevo_Rol;
  } catch (error) {
    console.error('Error al crear el rol:', error);
    throw error;
  }
};

export const updateRole = async (id: number, data: any) => {
  try {
    const rol_Actualizado = await prisma.roles.update({
      where: { id },
      data,
    });

    return rol_Actualizado;
  } catch (error) {
    console.error('Error al actualizar el rol:', error);
    throw new Error('Error al actualizar el rol', { cause: error });
  }
};

export const deleteRole = async (id: number) => {
  try {
    const rol_Eliminado = await prisma.roles.delete({
      where: { id },
    });

    return rol_Eliminado;
  } catch (error) {
    console.error('Error al eliminar el rol:', error);
    throw new Error('Error al eliminar el rol', { cause: error });
  }
};
