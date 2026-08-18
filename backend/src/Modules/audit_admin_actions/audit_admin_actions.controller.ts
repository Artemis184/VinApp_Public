import { Request, Response } from 'express';
import * as service from './audit_admin_actions.service';
import { serializeBigInt } from '../../SerializeBigInt/serializeBigInt';
/**
 * Serializa BigInt para evitar errores en res.json()
 */

// Helper para normalizar parámetros de ruta (pueden ser string | string[])
const getParam = (param: string | string[] | undefined): string => {
  return Array.isArray(param) ? param[0] : param || '';
};

const isValidUUID = (uuid: any): boolean => {
  const s = '' + uuid;
  const regex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return regex.test(s);
};

export const getAuditAdminActions = async (req: Request, res: Response) => {
  try {
    const { adminId, nodeId, from, to, take, skip } = req.query;

    // --- AGREGAR AQUÍ (Filtro de seguridad) ---
    let finalAdminId: string | undefined = undefined;
    if (typeof adminId === 'string' && adminId !== 'undefined' && isValidUUID(adminId)) {
      finalAdminId = adminId;
    }

    const data = await service.getAuditAdminActions({
      adminId: finalAdminId, // Usamos la variable limpia
      //adminId: typeof adminId === 'string' ? adminId : undefined,
      nodeId: typeof nodeId === 'string' ? Number(nodeId) : undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
      take: typeof take === 'string' ? Number(take) : 20,
      skip: typeof skip === 'string' ? Number(skip) : 0,
    });

    res.status(200).json({
      cant: data.length,
      data: serializeBigInt(data),
      message: 'Auditorías de administrador obtenidas exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener auditoría admin:', error);
    res.status(500).json({ message: 'Error al obtener auditoría admin' });
  }
};

export const getMasterAdminList = async (req: Request, res: Response) => {
  try {
    const data = await service.getAdminsWithOrWithoutActions();

    // Usamos tu función serializeBigInt que ya importaste arriba
    // Esto es mucho más eficiente que el JSON.parse/stringify
    res.status(200).json({
      data: serializeBigInt(data),
      message: 'Lista maestra obtenida con éxito',
    });
  } catch (error) {
    console.error('Error en getMasterAdminList:', error);
    res.status(500).json({ message: 'Error en el servidor', error });
  }
};

export const getAuditAdminActionById = async (req: Request, res: Response) => {
  try {
    const idStr = getParam(req.params.id);
    if (!idStr || idStr === 'undefined') {
      return res.status(400).json({ message: 'ID no válido' });
    }
    const data = await service.getAuditAdminActionById(BigInt(getParam(req.params.id)));
    if (data) {
      res.status(200).json({
        data: serializeBigInt(data),
        message: 'Auditoría de administrador obtenida exitosamente',
      });
    } else {
      res.status(404).json({ message: 'Auditoría de administrador no encontrada' });
    }
  } catch (error) {
    console.error('Error al obtener auditoría admin por ID:', error);
    res.status(500).json({ message: 'Error al obtener auditoría admin por ID' });
  }
};

export const getAllNodes = async (req: Request, res: Response) => {
  try {
    const data = await service.getAllNodes();
    res.status(200).json({
      cant: data.length,
      data: serializeBigInt(data),
      message: 'Lista de nodos obtenida exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener nodos:', error);
    res.status(500).json({ message: 'Error al obtener nodos' });
  }
};

export const postAuditAdminAction = async (req: Request, res: Response) => {
  try {
    const data = await service.createAuditAdminAction(req.body);
    res.status(201).json({
      data: serializeBigInt(data),
      message: 'Auditoría de administrador registrada exitosamente',
    });
  } catch (error: any) {
    console.error('Error al crear auditoría admin:', error);
    res.status(500).json({ message: error.message || 'Error al registrar auditoría admin' });
  }
};
