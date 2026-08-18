import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const ObtenerMenus = async () => {
  try {
    // Incluir accesos y el rol asociado para que el frontend pueda filtrar por nombre de rol
    const menusObtenidos = await prisma.menus.findMany({
      where: { is_menu: true, is_active: true },
      include: {
        access: {
          where: { is_active: true, can_view: true },
          include: { roles: true },
        },
      },
      orderBy: { display_order: 'asc' },
    });
    return menusObtenidos;
  } catch (error) {
    console.error('Error al obtener los menus: ', error);
    throw error;
  }
};

export const ObtenerMenusConAcceso = async (fk_id_rol: number) => {
  try {
    const menus = await prisma.menus.findMany({
      where: {
        is_menu: true,
        is_active: true,
        access: {
          some: {
            role_id: fk_id_rol,
            is_active: true,
            can_view: true,
          },
        },
      },
      orderBy: {
        display_order: 'asc',
      },
      include: {
        access: {
          where: {
            role_id: fk_id_rol,
            is_active: true,
            can_view: true,
          },
          include: { roles: true },
        },
      },
    });

    return menus;
  } catch (error) {
    console.error('Error al obtener los menús: ', error);
    throw error;
  }
};
