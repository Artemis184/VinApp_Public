import { Request, Response } from 'express';
import { ObtenerMenus, ObtenerMenusConAcceso } from './Menus.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const GetAllMenus = async (req: Request, res: Response) => {
  try {
    const menus = await ObtenerMenus();
    res.status(200).json(menus);
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener menús',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const GetMenusByRole = async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params as Record<string, string>;

    if (!roleId) {
      return res.status(400).json({
        message: 'role_id es requerido',
      });
    }

    // Validar que roleId sea un número válido
    const parsedRoleId = parseInt(roleId, 10);
    if (isNaN(parsedRoleId) || parsedRoleId <= 0) {
      return res.status(400).json({
        message: 'role_id debe ser un número entero válido',
      });
    }

    // Verificar que el usuario autenticado pueda acceder a este rol
    const tokenPayload: any = (req as any).user;
    if (!tokenPayload || !tokenPayload.user_uuid) {
      return res.status(401).json({
        message: 'Token inválido o expirado',
      });
    }

    const user = await prisma.users.findUnique({
      where: { id: tokenPayload.user_uuid },
      include: { user_roles: { include: { roles: true } } },
    });

    if (!user) {
      return res.status(404).json({
        message: 'Usuario no encontrado',
      });
    }

    // Los usuarios no-master solo pueden ver sus propios roles
    if (!user.is_master) {
      const userRoleIds = user.user_roles.map((ur) => ur.role_id);
      if (!userRoleIds.includes(parsedRoleId)) {
        return res.status(403).json({
          message: 'No tienes permiso para acceder a este rol',
        });
      }
    }

    const menus = await ObtenerMenusConAcceso(parsedRoleId);

    // Filtrar menús /master para usuarios no master
    if (!user.is_master) {
      const filtered = menus.filter((m: any) => {
        const path = typeof m.path === 'string' ? m.path : '';
        return !path.startsWith('/master');
      });
      return res.status(200).json(filtered);
    }

    res.status(200).json(menus);
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener menús por rol',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
