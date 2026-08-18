import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ROLE_NAMES } from '../constants/constants';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

interface AuthRequest extends Request {
  user?: {
    user_uuid: string;
    email: string;
    role: string;
    is_master?: boolean;
  };
}

/**
 * Verificar que el usuario sea ADMIN o MASTER
 * Uso:
 * router.get('/endpoint', verifyToken, requireAdmin, controller);
 */
export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user || !req.user.user_uuid) {
      return res.status(401).json({
        message: 'Usuario no autenticado',
      });
    }

    const userRole = req.user.role;

    // Si es ADMIN, permitir acceso
    if (userRole === ROLE_NAMES.ADMIN) {
      return next();
    }

    // Si el token ya trae is_master=true, permitir acceso sin consultar DB
    if (req.user.is_master === true) {
      return next();
    }

    // Compatibilidad con tokens antiguos que no incluyen is_master
    if (req.user.is_master === undefined) {
      const user = await prisma.users.findUnique({
        where: { id: req.user.user_uuid },
        select: { is_master: true },
      });

      if (user?.is_master === true) {
        return next();
      }
    }

    // No tiene permisos
    return res.status(403).json({
      message: 'No tienes permisos para acceder a este recurso',
      requiredRoles: [`${ROLE_NAMES.ADMIN} o ser usuario ${ROLE_NAMES.MASTER}`],
      yourRole: userRole,
    });
  } catch (error) {
    console.error('Error en requireAdmin middleware:', error);
    return res.status(500).json({
      message: 'Error al verificar permisos',
    });
  }
};

/**
 * Middleware genérico para autorizar por roles
 * Uso:
 * router.post('/x', verifyToken, authorizeRoles(['Admin','SuperAdmin']), controller)
 */
export const authorizeRoles = (allowedRoles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.user_uuid) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const userRole = req.user.role;

      // Permitir si el rol está en la lista
      if (allowedRoles.includes(userRole)) return next();

      // Permitir si es master
      if (req.user.is_master === true) return next();

      // Si is_master es indefinido, consultar DB
      if (req.user.is_master === undefined) {
        const user = await prisma.users.findUnique({
          where: { id: req.user.user_uuid },
          select: { is_master: true },
        });
        if (user?.is_master === true) return next();
      }

      return res.status(403).json({
        message: 'No tienes permisos para acceder a este recurso',
        requiredRoles: allowedRoles,
        yourRole: userRole,
      });
    } catch (error) {
      console.error('Error en authorizeRoles middleware:', error);
      return res.status(500).json({ message: 'Error al verificar permisos' });
    }
  };
};
