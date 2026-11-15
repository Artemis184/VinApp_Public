import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Lee una contraseña del seed desde .env; falla si no está definida.
const requireSeedPassword = (envName: string): string => {
  const value = process.env[envName];
  if (!value) {
    throw new Error(`Define ${envName} en .env antes de ejecutar el seed`);
  }
  return value;
};

export async function initialSeed(prisma: PrismaClient) {
  console.log('🌱 Iniciando initialSeed…');

  // ======================================================
  // 0. LIMPIAR DATOS EXISTENTES (si existen)
  // ======================================================
  try {
    console.log('🗑️  Limpiando datos existentes...');
    // Eliminar en orden de dependencias
    // NOTA: la tabla revoked_tokens no existe. Ahora la revocación de sesiones o tokens se controla con session.is_revoked
    await prisma.password_reset_codes.deleteMany({});
    await prisma.audit_admin_actions.deleteMany({});
    await prisma.audit_user_actions.deleteMany({});
    await prisma.access.deleteMany({});
    await prisma.user_nodes.deleteMany({});
    await prisma.user_roles.deleteMany({});
    await prisma.notifications.deleteMany({});
    await prisma.users.deleteMany({});
    await prisma.menus.deleteMany({});
    await prisma.nodes.deleteMany({});

    // Resetear secuencias de autoincrement
    await prisma.$executeRaw`ALTER SEQUENCE nodes_id_seq RESTART WITH 1`;
    await prisma.$executeRaw`ALTER SEQUENCE roles_id_seq RESTART WITH 1`;
    await prisma.$executeRaw`ALTER SEQUENCE menus_id_seq RESTART WITH 1`;

    console.log('✔ Datos existentes eliminados y secuencias reseteadas');
  } catch {
    console.log('⚠️  No hay datos previos para limpiar (primera ejecución)');
  }

  // ======================================================
  // 1. CREAR ROLES
  // ======================================================
  const roles = [
    { name: 'ADMIN', description: 'Administrador del sistema' },
    { name: 'CLIENT', description: 'Usuario final del sistema' },
  ];

  for (const role of roles) {
    await prisma.roles.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log('✔ Roles creados / verificados');

  // 👉 Obtener el rol ADMIN
  const adminRole = await prisma.roles.findUnique({
    where: { name: 'ADMIN' },
  });

  if (!adminRole) {
    throw new Error('❌ Rol ADMIN no encontrado');
  }

  // ======================================================
  // 2. CREAR CUENTA MAESTRA
  // ======================================================
  const masterPassword = await bcrypt.hash(requireSeedPassword('SEED_MASTER_PASSWORD'), 10);

  const masterUser = await prisma.users.upsert({
    where: { email: 'cuenta.maestra@example.com' },
    update: {},
    create: {
      email: 'cuenta.maestra@example.com',
      full_name: 'Cuenta Maestra',
      password_hash: masterPassword,
      status: 'APPROVED',
      is_master: true,
    },
  });

  // Asignar rol ADMIN al maestro
  await prisma.user_roles.upsert({
    where: {
      user_id_role_id: {
        user_id: masterUser.id,
        role_id: adminRole.id,
      },
    },
    update: {},
    create: {
      user_id: masterUser.id,
      role_id: adminRole.id,
    },
  });

  console.log('✔ Cuenta maestra creada');

  // ======================================================
  // 2.1. CREAR CUENTA ADMINISTRADOR
  // ======================================================
  const adminPassword = await bcrypt.hash(requireSeedPassword('SEED_ADMIN_PASSWORD'), 10);

  const adminUser = await prisma.users.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      full_name: 'VinAdmin',
      password_hash: adminPassword,
      status: 'APPROVED',
      is_master: false,
    },
  });

  // Asignar rol ADMIN al administrador
  await prisma.user_roles.upsert({
    where: {
      user_id_role_id: {
        user_id: adminUser.id,
        role_id: adminRole.id,
      },
    },
    update: {},
    create: {
      user_id: adminUser.id,
      role_id: adminRole.id,
    },
  });

  console.log('✔ Cuenta administrador VinAdmin creada');

  // ======================================================
  // 2.2. CREAR CUENTA USUARIO FINAL
  // ======================================================
  const clientRole = await prisma.roles.findUnique({
    where: { name: 'CLIENT' },
  });

  if (!clientRole) {
    throw new Error('❌ Rol CLIENT no encontrado');
  }

  const clientPassword = await bcrypt.hash(requireSeedPassword('SEED_CLIENT_PASSWORD'), 10);

  const clientUser = await prisma.users.upsert({
    where: { email: 'cliente@example.com' },
    update: {},
    create: {
      email: 'cliente@example.com',
      full_name: 'Usuario Final',
      password_hash: clientPassword,
      status: 'APPROVED',
      is_master: false,
    },
  });

  // Asignar rol CLIENT al usuario final
  await prisma.user_roles.upsert({
    where: {
      user_id_role_id: {
        user_id: clientUser.id,
        role_id: clientRole.id,
      },
    },
    update: {},
    create: {
      user_id: clientUser.id,
      role_id: clientRole.id,
    },
  });

  console.log('✔ Cuenta usuario final creada');

  // ======================================================
  // 3. CREAR NODOS INICIALES (1–5)
  // ======================================================
  const nodes = [
    {
      name: 'Alarma 1',
      code: 'ALM-JC-0001-L1',
      description: 'Zona 1 - Alarma de ejemplo',
      location: '-2.001, -80.9001',
      rf_slot: 1,
      uses_repeater: true,
    },
    {
      name: 'Alarma 2',
      code: 'ALM-JC-0002-L2',
      description: 'Zona 2 - Alarma de ejemplo',
      location: '-2.002, -80.9002',
      rf_slot: 2,
      uses_repeater: true,
    },
    {
      name: 'Alarma 3',
      code: 'ALM-JC-0003-L3',
      description: 'Zona 3 - Alarma de ejemplo',
      location: '-2.003, -80.9003',
      rf_slot: 3,
    },
    {
      name: 'Alarma 4',
      code: 'ALM-JC-0004-L4',
      description: 'Zona 4 - Alarma de ejemplo',
      location: '-2.004, -80.9004',
      rf_slot: 4,
    },
    {
      name: 'Alarma 5',
      code: 'ALM-JC-0005-L5',
      description: 'Zona 5 - Alarma de ejemplo',
      location: '-2.005, -80.9005',
      rf_slot: 5,
    },
  ];

  for (const node of nodes) {
    await prisma.nodes.upsert({
      where: { code: node.code },
      update: {},
      create: node,
    });
  }

  console.log(`✔ Nodos 1–${nodes.length} creados`);

  // ======================================================
  // 3.1 ASIGNAR TODOS LOS NODOS A USUARIOS ADMIN
  //     Si el nodo está deshabilitado, queda no accionable
  // ======================================================
  const allNodes = await prisma.nodes.findMany({
    select: { id: true, is_enabled: true },
  });

  const adminUserRoles = await prisma.user_roles.findMany({
    where: { role_id: adminRole.id },
    select: { user_id: true },
  });

  for (const userRole of adminUserRoles) {
    for (const node of allNodes) {
      const shouldBeRevoked = !node.is_enabled;

      await prisma.user_nodes.upsert({
        where: {
          user_id_node_id: {
            user_id: userRole.user_id,
            node_id: node.id,
          },
        },
        update: {
          is_revoked: shouldBeRevoked,
          revoked_at: shouldBeRevoked ? new Date() : null,
          assigned_by: masterUser.id,
        },
        create: {
          user_id: userRole.user_id,
          node_id: node.id,
          assigned_by: masterUser.id,
          is_revoked: shouldBeRevoked,
          revoked_at: shouldBeRevoked ? new Date() : null,
        },
      });
    }
  }

  console.log('✔ Nodos asignados a administradores (deshabilitados no accionables)');
  console.log('🌱 initialSeed COMPLETADO');

  // ======================================================
  // 4. CREAR MENÚS DEL SISTEMA
  // ======================================================
  const menus = [
    {
      name: 'Landing',
      icon: 'home',
      path: '/',
      description: 'Página de inicio',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 1,
    },
    {
      name: 'Inicio',
      icon: 'home',
      path: '/administrator/principal-administrador',
      description: 'Panel principal del administrador',
      parent_id: null,
      is_active: true,
      is_menu: true,
      display_order: 2,
    },
    {
      name: 'Lista de Alarmas',
      icon: 'list',
      path: '/administrator/lista-alarmas',
      description: 'Listado de alarmas',
      parent_id: null,
      is_active: true,
      is_menu: true,
      display_order: 3,
    },
    {
      name: 'Editar Alarma',
      icon: 'settings',
      path: '/administrator/editar-alarma/:id',
      description: 'Editar alarma',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 4,
    },
    {
      name: 'Auditoría',
      icon: 'search',
      path: '/administrator/admin-auditoria',
      description: 'Auditoría de usuarios',
      parent_id: null,
      is_active: true,
      is_menu: true,
      display_order: 5,
    },
    {
      name: 'Usuarios',
      icon: 'people',
      path: '/administrator/admin-usuarios',
      description: 'Gestión de usuarios',
      parent_id: null,
      is_active: true,
      is_menu: true,
      display_order: 6,
    },
    {
      name: 'Detalle Usuario',
      icon: 'person',
      path: '/administrator/admin-detusuario',
      description: 'Detalle de usuario',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 7,
    },
    {
      name: 'Pendientes de Acción',
      icon: 'alert',
      path: '/administrator/listado-pendientes-acciones',
      description: 'Acciones pendientes',
      parent_id: null,
      is_active: true,
      is_menu: true,
      display_order: 8,
    },
    {
      name: 'Listado de Usuarios',
      icon: 'list',
      path: '/administrator/listado-usu/:id',
      description: 'Listado de usuarios',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 9,
    },
    {
      name: 'Editar Usuario',
      icon: 'create',
      path: '/administrator/admin-editusuario',
      description: 'Editar usuario',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 10,
    },
    {
      name: 'Configurar Usuario',
      icon: 'settings',
      path: '/administrator/admin-confirusuario',
      description: 'Configuración de usuario',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 11,
    },
    {
      name: 'Principal Usuario Final',
      icon: 'person',
      path: '/final-user/principal-usuariof',
      description: 'Panel principal usuario final',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 12,
    },
    {
      name: 'Datos Usuario Final',
      icon: 'person',
      path: '/final-user/datos-usuario-f',
      description: 'Datos del usuario final',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 13,
    },
    {
      name: 'Lista Auditoría Master',
      icon: 'search',
      path: '/master/lista-auditoria-admins',
      description: 'Auditoría de administradores',
      parent_id: null,
      is_active: true,
      is_menu: true,
      display_order: 14,
    },
    {
      name: 'Login',
      icon: 'log-in',
      path: '/auth/login',
      description: 'Iniciar sesión',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 15,
    },
    {
      name: 'Registro',
      icon: 'person-add',
      path: '/auth/register',
      description: 'Registro de usuario',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 16,
    },
    {
      name: 'Recuperar Cuenta',
      icon: 'key',
      path: '/auth/account_recovery',
      description: 'Recuperar cuenta',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 17,
    },
    {
      name: 'Restablecer Contraseña',
      icon: 'lock',
      path: '/auth/reset_password',
      description: 'Restablecer contraseña',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 18,
    },
    {
      name: 'Política de Privacidad',
      icon: 'document',
      path: '/privacy-policy',
      description: 'Política de privacidad',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 19,
    },
    {
      name: 'Términos y Condiciones',
      icon: 'document',
      path: '/terms-conditions',
      description: 'Términos y condiciones',
      parent_id: null,
      is_active: true,
      is_menu: false,
      display_order: 20,
    },
  ];

  for (const menu of menus) {
    const existingMenu = await prisma.menus.findFirst({
      where: { path: menu.path },
    });

    if (existingMenu) {
      await prisma.menus.update({
        where: { id: existingMenu.id },
        data: menu,
      });
    } else {
      await prisma.menus.create({
        data: menu,
      });
    }
  }

  console.log('✔ Menús del sistema creados');

  // ======================================================
  // 5. CREAR ACCESOS PARA ROL ADMIN
  // ======================================================
  // Menús de administrador
  const adminMenus = await prisma.menus.findMany({
    where: {
      path: {
        startsWith: '/administrator',
      },
    },
  });

  // Menús de master
  const masterMenus = await prisma.menus.findMany({
    where: {
      path: {
        startsWith: '/master',
      },
    },
  });

  // Asignar acceso completo a los menús de administrador SOLO al rol ADMIN
  for (const menu of adminMenus) {
    await prisma.access.upsert({
      where: {
        role_id_menu_id: {
          role_id: adminRole.id,
          menu_id: menu.id,
        },
      },
      update: {},
      create: {
        role_id: adminRole.id,
        menu_id: menu.id,
        can_view: true,
        can_create: true,
        can_update: true,
        can_delete: true,
      },
    });
  }

  // Obtener todos los usuarios master
  const masterUsers = await prisma.users.findMany({ where: { is_master: true } });
  // Si hay al menos un usuario master, asignar acceso a /administrator y /master
  if (masterUsers.length > 0) {
    for (const menu of [...adminMenus, ...masterMenus]) {
      await prisma.access.upsert({
        where: {
          role_id_menu_id: {
            role_id: adminRole.id, // El rol master es ADMIN pero con is_master: true
            menu_id: menu.id,
          },
        },
        update: {},
        create: {
          role_id: adminRole.id,
          menu_id: menu.id,
          can_view: true,
          can_create: true,
          can_update: true,
          can_delete: true,
        },
      });
    }
  }

  // CLIENT no tiene acceso a ningún menú
  console.log('✔ Accesos ADMIN y MASTER creados según reglas. CLIENT sin acceso a menús.');
}
