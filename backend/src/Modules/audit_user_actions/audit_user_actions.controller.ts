import { Request, Response } from 'express';
import * as service from './audit_user_actions.service';
import { serializeBigInt } from '../../SerializeBigInt/serializeBigInt';

// Helper para normalizar parámetros de ruta (pueden ser string | string[])
const getParam = (param: string | string[] | undefined): string => {
  return Array.isArray(param) ? param[0] : param || '';
};

export const getAuditUserActions = async (_req: Request, res: Response) => {
  try {
    const data = await service.getAuditUserActions();
    res.status(200).json({
      cant: data.length,
      data: serializeBigInt(data),
      message: 'Auditorías obtenidas exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener auditoría de usuario:', error);
    res.status(500).json({ message: 'Error al obtener auditoría de usuario' });
  }
};

export const getAuditUserActionById = async (req: Request, res: Response) => {
  try {
    const data = await service.getAuditUserActionById(BigInt(getParam(req.params.id)));
    if (data) {
      res.status(200).json({
        data: serializeBigInt(data),
        message: 'Auditoría obtenida exitosamente',
      });
    } else {
      res.status(404).json({ message: 'Auditoría no encontrada' });
    }
  } catch (error) {
    console.error('Error al obtener auditoría por ID:', error);
    res.status(500).json({ message: 'Error al obtener auditoría por ID' });
  }
};

export const postAuditUserAction = async (req: Request, res: Response) => {
  try {
    const data = await service.createAuditUserAction(req.body);
    res.status(201).json({
      data: serializeBigInt(data),
      message: 'Auditoría registrada exitosamente',
    });
  } catch (error: any) {
    console.error('Error al crear auditoría usuario:', error);
    res.status(500).json({ message: error.message || 'Error al registrar auditoría' });
  }
};

export const deleteAuditUserActionById = async (req: Request, res: Response) => {
  try {
    const data = await service.deleteAuditUserAction(BigInt(getParam(req.params.id)));
    res.status(200).json({
      data: serializeBigInt(data),
      message: 'Auditoría eliminada exitosamente',
    });
  } catch (error) {
    console.error('Error en deleteAuditUserActionById:', error);
    res.status(500).json({ message: 'Error al eliminar auditoría' });
  }
};

export const getAuditUserActionsAlarma = async (req: Request, res: Response) => {
  try {
    const { nodeId, from, to } = req.query;

    // 1. Validación de parámetros
    const parsedNodeId: number | undefined = nodeId ? Number(nodeId) : undefined;
    const startDate: Date | undefined = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
    const endDate: Date | undefined = to ? new Date(`${to}T23:59:59.999Z`) : undefined;

    const [alarmActions, allNodes] = await Promise.all([
      service.getAuditUserActionsAlarma(parsedNodeId, startDate, endDate),
      service.getAllNodesBase(),
    ]);

    const alarmNodes = parsedNodeId
      ? allNodes.filter((node: any) => node.id === parsedNodeId)
      : allNodes;

    const actionsByNode = new Set<number>();
    const actionRows = alarmActions.map((action: any) => {
      const node = action.nodes;

      if (action.node_id) {
        actionsByNode.add(Number(action.node_id));
      }

      return {
        id: Number(action.id),
        titulo: `ALARMA # ${node?.code || action.node_id || '---'}`,
        estado_texto: action.action_type,
        direccion: node?.description || 'Ubicación no definida',
        usuario: action.users?.full_name || 'Sistema',
        fecha_raw: action.action_timestamp || new Date().toISOString(),
      };
    });

    const nodesWithoutActivity = alarmNodes
      .filter((node: any) => !actionsByNode.has(Number(node.id)))
      .map((node: any) => ({
        id: 0,
        titulo: `ALARMA # ${node.code || '---'}`,
        estado_texto: 'SIN ACTIVIDAD',
        direccion: node.description || 'Ubicación no definida',
        usuario: 'Sistema',
        fecha_raw: new Date().toISOString(),
      }));

    const formattedData = [...actionRows, ...nodesWithoutActivity].sort(
      (a: any, b: any) => new Date(b.fecha_raw).getTime() - new Date(a.fecha_raw).getTime(),
    );

    res.status(200).json({
      cant: formattedData.length,
      data: serializeBigInt(formattedData),
      message: 'Historial completo de alarmas sincronizado',
    });
  } catch (error) {
    console.error('Error en controlador de auditoría:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getNodesBaseList = async (_req: Request, res: Response) => {
  try {
    // Llamamos al servicio para traer los 5 registros de la tabla 'nodes'
    const nodes = await service.getAllNodesBase();

    const formattedData = nodes.map((node: any) => ({
      id: 0,
      titulo: `ALARMA # ${node.code}`,
      estado_texto: 'SIN ACTIVIDAD',
      direccion: node.description || 'Ubicación no definida',
      usuario: 'Sistema',
      fecha_raw: new Date().toISOString(),
    }));

    res.status(200).json({
      cant: formattedData.length,
      data: serializeBigInt(formattedData),
      message: 'Nodos base obtenidos con éxito',
    });
  } catch (error) {
    console.error('Error en getNodesBaseList:', error);
    res.status(500).json({ message: 'Error al obtener lista de alarmas' });
  }
};
