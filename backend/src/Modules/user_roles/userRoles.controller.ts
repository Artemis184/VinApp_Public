import { Request, Response } from 'express';

import {
  obtenerRolesporUserId,
  obtenerUsersporRoleId,
  asignarRolaUser,
  removerRolaUser,
  UserRolesServiceError,
} from './userRoles.service';

interface AuthenticatedRequest extends Request {
  user?: {
    user_uuid: string;
  };
}

// Helper para normalizar parámetros de ruta (pueden ser string | string[])
const getParam = (param: string | string[] | undefined): string => {
  return Array.isArray(param) ? param[0] : param || '';
};

export const getRolesByUserId = async (req: Request, res: Response) => {
  const user_id = getParam(req.params.user_id);
  try {
    const roles = await obtenerRolesporUserId(user_id);
    res.status(200).json({
      cant: roles.length,
      data: roles,
      message: 'Roles del usuario obtenidos exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener roles del usuario:', error);
    res.status(500).json({ message: 'Error al obtener roles del usuario' });
  }
};

export const getUsersByRoleId = async (req: Request, res: Response) => {
  const role_id = parseInt(getParam(req.params.role_id));
  try {
    const users = await obtenerUsersporRoleId(role_id);
    res.status(200).json({
      cant: users.length,
      data: users,
      message: 'Usuarios con el rol obtenidos exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener usuarios por rol:', error);
    res.status(500).json({ message: 'Error al obtener usuarios por rol' });
  }
};

/**
 * POST /postassignroletouser
 * Asigna un rol a un usuario.
 * Body requerido:
 * - user_id: string
 * - role_id: number
 */
export const postAssignRoleToUser = async (req: AuthenticatedRequest, res: Response) => {
  const { user_id, role_id } = req.body;

  // Validación de parámetros
  if (!user_id) {
    return res.status(400).json({
      message: 'El Id del usuario es requerido.',
    });
  }

  if (role_id === undefined) {
    return res.status(400).json({
      message: 'El Id del rol es requerido.',
    });
  }

  try {
    const numericRoleId = Number(role_id);
    const assignedRole = await asignarRolaUser(user_id, numericRoleId, {
      admin_id: req.user?.user_uuid,
    });

    res.status(201).json({
      data: assignedRole,
      message: 'Rol asignado al usuario exitosamente',
    });
  } catch (error: any) {
    console.error('Error al asignar rol al usuario:', error);
    if (error instanceof UserRolesServiceError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    res.status(500).json({
      message: error.message || 'Error al asignar rol al usuario',
    });
  }
};

export const deleteRemoveRoleFromUser = async (req: AuthenticatedRequest, res: Response) => {
  const { user_id, role_id } = req.body;
  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({
      message: 'El Id del usuario es requerido y debe ser válido',
    });
  }

  if (role_id === undefined || isNaN(Number(role_id))) {
    return res.status(400).json({
      message: 'El Id del rol es requerido y debe ser válido',
    });
  }
  try {
    const numericRoleId = Number(role_id);
    const removedRole = await removerRolaUser(user_id, numericRoleId, {
      admin_id: req.user?.user_uuid,
    });

    res.status(200).json({
      data: removedRole,
      message: 'Rol removido del usuario exitosamente',
    });
  } catch (error) {
    console.error('Error al quitar rol al usuario:', error);
    if (error instanceof UserRolesServiceError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error al quitar rol al usuario' });
  }
};
