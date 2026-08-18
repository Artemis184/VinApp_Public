import { Request, Response } from 'express';

import {
  obtenerTodoRoles,
  obtenerRolporId,
  createRole,
  updateRole,
  deleteRole,
} from './roles.service';

// Helper para normalizar parámetros de ruta (pueden ser string | string[])
const getParam = (param: string | string[] | undefined): string => {
  return Array.isArray(param) ? param[0] : param || '';
};

export const getRoles = async (req: Request, res: Response) => {
  try {
    const roles = await obtenerTodoRoles();
    res.status(200).json({
      cant: roles.length,
      data: roles,
      message: 'Roles obtenidos exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({ message: 'Error al obtener roles' });
  }
};

export const getRoleById = async (req: Request, res: Response) => {
  const id = parseInt(getParam(req.params.id));
  try {
    const role = await obtenerRolporId(id);
    if (role) {
      res.status(200).json({
        data: role,
        message: 'Rol obtenido exitosamente',
      });
    } else {
      res.status(404).json({ message: 'Rol no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener rol por ID:', error);
    res.status(500).json({ message: 'Error al obtener rol por ID' });
  }
};

export const postRole = async (req: Request, res: Response) => {
  const { name, description } = req.body;
  try {
    const newRole = await createRole(name, description);
    res.status(201).json({
      data: newRole,
      message: 'Rol creado exitosamente',
    });
  } catch (error: any) {
    console.error('Error al crear rol:', error);
    res.status(500).json({ message: error.message || 'Error al crear rol' });
  }
};
export const putRole = async (req: Request, res: Response) => {
  const id = parseInt(getParam(req.params.id));
  const data = req.body;
  try {
    const updatedRole = await updateRole(id, data);
    res.status(200).json({
      data: updatedRole,
      message: 'Rol actualizado exitosamente',
    });
  } catch (error) {
    console.error('Error al actualizar rol:', error);
    res.status(500).json({ message: 'Error al actualizar rol' });
  }
};

export const deleteRoleById = async (req: Request, res: Response) => {
  const id = parseInt(getParam(req.params.id));
  try {
    const deletedRole = await deleteRole(id);
    res.status(200).json({
      data: deletedRole,
      message: 'Rol eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar rol:', error);
    res.status(500).json({ message: 'Error al eliminar rol' });
  }
};
