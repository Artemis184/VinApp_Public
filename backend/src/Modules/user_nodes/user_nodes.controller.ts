import { Request, Response } from 'express';
import * as service from './user_nodes.service';

/**
 * Helper para normalizar parámetros de ruta (pueden ser string | string[])
 */
const getParam = (param: string | string[] | undefined): string => {
  return Array.isArray(param) ? param[0] : param || '';
};

/**
 * Obtiene todas las relaciones usuario-nodo (Admin General)
 */
export const getUserNodes = async (_req: Request, res: Response) => {
  try {
    const data = await service.getUserNodes();
    res.status(200).json({
      cant: data.length,
      data: data,
      message: 'User nodes obtenidos exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener user_nodes:', error);
    res.status(500).json({ message: 'Error al obtener user_nodes' });
  }
};

/**
 * Obtiene una relación específica por su ID primario
 */
export const getUserNodeById = async (req: Request, res: Response) => {
  try {
    const data = await service.getUserNodeById(Number(getParam(req.params.id)));
    if (data) {
      res.status(200).json({
        data: data,
        message: 'User node obtenido exitosamente',
      });
    } else {
      res.status(404).json({ message: 'User node no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener user_node por ID:', error);
    res.status(500).json({ message: 'Error al obtener user_node por ID' });
  }
};

/**
 * Obtiene solo los IDs de los nodos asignados a un usuario (Para el Modal de Angular)
 */
export const getNodesByUserId = async (req: Request, res: Response) => {
  try {
    const user_id = getParam(req.params.user_id);
    if (!user_id || user_id.trim() === '') {
      return res.status(400).json({ message: 'user_id es obligatorio' });
    }
    const data = await service.getNodesByUserId(user_id);
    res.status(200).json({
      cant: data.length,
      data: data,
      message: 'Nodos del usuario obtenidos exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener nodos por user_id:', error);
    res.status(500).json({ message: 'Error al obtener nodos por user_id' });
  }
};

/**
 * ASIGNACIÓN MASIVA (Sincronización del Modal de Alarmas)
 * POST /api/assign-bulk
 */
export const postAssignBulk = async (req: Request, res: Response) => {
  try {
    const { userId, nodeIds } = req.body;

    if (!userId || !Array.isArray(nodeIds)) {
      return res.status(400).json({
        message: 'userId y un array de nodeIds son obligatorios',
      });
    }

    // Obtenemos el ID del administrador desde el middleware verifyToken
    const adminId = (req as any).user?.user_uuid;
    if (!adminId) {
      return res.status(401).json({ message: 'Admin no autenticado' });
    }

    const result = await service.sincronizarNodosUsuario(userId, nodeIds, adminId);

    res.status(200).json({
      data: result,
      message: 'Alarmas sincronizadas y auditadas exitosamente',
    });
  } catch (error: any) {
    console.error('Error en postAssignBulk:', error);
    res.status(500).json({
      message: error.message || 'Error al sincronizar alarmas',
    });
  }
};

/**
 * Asigna un único nodo (Ruta individual legacy)
 */
export const postUserNode = async (req: Request, res: Response) => {
  try {
    const { user_id, node_id } = req.body;

    if (!user_id || !node_id) {
      return res.status(400).json({
        message: 'user_id y node_id son obligatorios',
      });
    }

    const adminId = (req as any).user?.user_uuid;
    if (!adminId) {
      return res.status(401).json({ message: 'Admin no autenticado' });
    }

    const data = await service.createOrReactivateUserNode({
      user_id,
      node_id: Number(node_id),
      assigned_by: adminId,
    });

    res.status(201).json({
      data,
      message: 'Nodo asignado al usuario exitosamente',
    });
  } catch (error: any) {
    console.error('Error en postUserNode:', error);
    res.status(500).json({
      message: error.message || 'Error al asignar nodo',
    });
  }
};

export const patchUserNodeStatus = async (req: Request, res: Response) => {
  try {
    const id = Number(getParam(req.params.id));

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const data = await service.patchUserNodeStatus(id, {
      is_revoked: true,
      revoked_at: new Date(),
    });

    res.status(200).json({
      data,
      message: 'Acceso del usuario al nodo revocado',
    });
  } catch (error) {
    console.error('Error en patchUserNodeStatus:', error);
    res.status(500).json({ message: 'Error al revocar acceso' });
  }
};
