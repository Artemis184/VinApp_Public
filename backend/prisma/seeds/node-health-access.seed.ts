import { PrismaClient } from '@prisma/client';

const NODE_HEALTH_MENU = {
  name: 'Salud de Nodos',
  icon: 'pulse-outline',
  path: '/master/graficas-salud-nodos',
  description: 'Estado y métricas de salud de los nodos',
  parent_id: null,
  is_menu: true,
  is_active: true,
  display_order: 15,
};

export async function seedNodeHealthAccess(prisma: PrismaClient) {
  const existingMenu = await prisma.menus.findFirst({
    where: { path: NODE_HEALTH_MENU.path },
  });
  const menu = existingMenu
    ? await prisma.menus.update({
        where: { id: existingMenu.id },
        data: NODE_HEALTH_MENU,
      })
    : await prisma.menus.create({ data: NODE_HEALTH_MENU });

  const roles = await prisma.roles.findMany({
    where: { name: { in: ['ADMIN', 'MASTER'] } },
    select: { id: true },
  });

  for (const role of roles) {
    await prisma.access.upsert({
      where: {
        role_id_menu_id: {
          role_id: role.id,
          menu_id: menu.id,
        },
      },
      update: {
        can_view: true,
        is_active: true,
      },
      create: {
        role_id: role.id,
        menu_id: menu.id,
        can_view: true,
      },
    });
  }

  console.log(`✔ Menú "${NODE_HEALTH_MENU.name}" y accesos actualizados.`);
}
