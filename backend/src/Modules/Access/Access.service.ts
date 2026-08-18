import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const ObtenerAcceso = async (id_rol: number) => {
  try {
    const AccesoObtenido = await prisma.access.findMany({
      where: { role_id: id_rol },
    });
    return AccesoObtenido;
  } catch (error) {
    console.error('Error al obtener el acceso: ', error);
    throw error;
  }
};

export const CrearAcceso = async (fk_id_rol: number, fk_id_menu: number) => {
  try {
    const AccesoCreado = await prisma.access.create({
      data: {
        role_id: fk_id_rol,
        menu_id: fk_id_menu,
      },
    });
    return AccesoCreado;
  } catch (error) {
    console.error('Error al crear el acceso: ', error);
    throw error;
  }
};

export const EliminarAcceso = async (id_acc: number) => {
  try {
    const AccesoEliminado = await prisma.access.delete({
      where: { id: id_acc },
      //AGREGAR INSTRUCCIONES DE GUARDADO DE AUDITORIA
    });
    return AccesoEliminado;
  } catch (error) {
    console.error('Error al eliminar el acceso: ', error);
    throw error;
  }
};
