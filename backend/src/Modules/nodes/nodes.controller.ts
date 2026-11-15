import { Request, Response } from 'express';
import { getIO } from '../../index';

import fs from 'fs';
import path from 'path';

import {
  obtenerTodoNodos,
  todoNodos,
  obtenerNodoporId,
  obtenerNodoporCode,
  obtenerNodosParaMaestro,
  crearNodo,
  actualizarNodo,
  eliminarNodo,
  crearRegistroSalud,
  obtenerUltimaSalud,
  obtenerNodoPorSlotRF,
  obtenerHistorialSalud,
  obtenerResumenSaludNodo,
} from './nodes.service';
import { getNodeCommunicationMethod } from '../../services/nodeCommunication.service';
import { deleteObjectByUrl, uploadObject } from '../../services/objectStorage.service';
import { getNodesByUserId } from '../user_nodes/user_nodes.service';
import { ROLE_NAMES } from '../../constants/constants';
import { validationUtils } from '../../middlewares/validationMiddleware';

// ADMIN/MASTER ven todos los nodos; el resto, solo los asignados.
const isPrivilegedRequester = (req: Request): boolean => {
  const user = (req as Request & { user?: { role?: string; is_master?: boolean } }).user;
  return user?.role === ROLE_NAMES.ADMIN || user?.is_master === true;
};

const getRequesterUserId = (req: Request): string | undefined =>
  (req as Request & { user?: { user_uuid?: string } }).user?.user_uuid;

interface NodeHealthPayload {
  nodeId?: number;
  code?: string;
  rfNode: number;
  radioReinits: number;
  boots: number;
  rxCount: number;
  uptimeHours: number;
  abnormalReset?: boolean;
  reinitThisSession?: boolean;
  viaRepeater?: string;
}
// Helper para normalizar parámetros de ruta (pueden ser string | string[])
const getParam = (param: string | string[] | undefined): string => {
  return Array.isArray(param) ? param[0] : param || '';
};

// Filtra la lista de nodos dejando solo los asignados al usuario (si no es admin).
const scopeNodosToRequester = async (req: Request, nodos: any[]): Promise<any[]> => {
  if (isPrivilegedRequester(req)) return nodos;

  const userId = getRequesterUserId(req);
  if (!userId) return [];

  const assignedIds = new Set(await getNodesByUserId(userId));
  return nodos.filter((nodo) => assignedIds.has(nodo.id));
};

export const getNodos = async (req: Request, res: Response) => {
  try {
    const nodos = await scopeNodosToRequester(req, await obtenerTodoNodos());
    res.status(200).json({
      cant: nodos.length,
      data: nodos,
      message: 'Nodos obtenidos exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener nodos:', error);
    res.status(500).json({ message: 'Error al obtener nodos' });
  }
};

export const getAllNodos = async (req: Request, res: Response) => {
  try {
    const nodos = await scopeNodosToRequester(req, await todoNodos());
    res.status(200).json({
      cant: nodos.length,
      data: nodos,
      message: 'Nodos obtenidos exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener nodos:', error);
    res.status(500).json({ message: 'Error al obtener nodos' });
  }
};

export const getMaestroNodeMap = async (req: Request, res: Response) => {
  try {
    const nodos = await obtenerNodosParaMaestro();

    const data = nodos
      .filter(
        (node) =>
          getNodeCommunicationMethod({
            id: node.id,
            code: node.code,
            communication_method: node.communication_method,
            ip_address: node.ip_address,
            rf_slot: node.rf_slot,
            rf_address: node.rf_address,
          }) === 'rf'
      )
      .map((node) => ({
        nodeId: node.id,
        code: node.code,
        rfNode: node.rf_slot,
        rfSlot: node.rf_slot,
        rfAddress: node.rf_address ?? '',
        usesRepeater: node.uses_repeater ?? false,
        isEnabled: node.is_enabled,
      }))
      .filter((node) => node.rfNode !== null && node.rfNode !== undefined);

    res.status(200).json({
      cant: data.length,
      data,
      message: 'Mapa de nodos para maestro obtenido exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener mapa de nodos para maestro:', error);
    res.status(500).json({ message: 'Error al obtener mapa de nodos para maestro' });
  }
};

// Verifica que un CLIENTE solo acceda a un nodo asignado a él.
const requesterCanSeeNode = async (req: Request, nodeId: number): Promise<boolean> => {
  if (isPrivilegedRequester(req)) return true;
  const userId = getRequesterUserId(req);
  if (!userId) return false;
  const assignedIds = new Set(await getNodesByUserId(userId));
  return assignedIds.has(nodeId);
};

export const getNodoById = async (req: Request, res: Response) => {
  const id = parseInt(getParam(req.params.id));
  try {
    if (!(await requesterCanSeeNode(req, id))) {
      return res.status(404).json({ message: 'Nodo no encontrado' });
    }
    const nodo = await obtenerNodoporId(id);
    if (nodo) {
      res.status(200).json({
        data: nodo,
        message: 'Nodo obtenido exitosamente',
      });
    } else {
      res.status(404).json({ message: 'Nodo no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener nodo por ID:', error);
    res.status(500).json({ message: 'Error al obtener nodo por ID' });
  }
};

export const getNodoByCode = async (req: Request, res: Response) => {
  const code = getParam(req.params.code);
  try {
    const nodo = await obtenerNodoporCode(code);
    if (nodo && !(await requesterCanSeeNode(req, nodo.id))) {
      return res.status(404).json({ message: 'Nodo no encontrado' });
    }
    if (nodo) {
      res.status(200).json({
        data: nodo,
        message: 'Nodo obtenido exitosamente',
      });
    } else {
      res.status(404).json({ message: 'Nodo no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener nodo por código:', error);
    res.status(500).json({ message: 'Error al obtener nodo por código' });
  }
};

export const postNodo = async (req: Request, res: Response) => {
  try {
    const data = validationUtils.nodeText(req.body);
    const newNodo = await crearNodo(data);
    res.status(201).json({
      data: newNodo,
      message: 'Nodo creado exitosamente',
    });
  } catch (error: any) {
    console.error('Error al crear nodo:', error);
    res.status(500).json({ message: error.message || 'Error al crear nodo' });
  }
};

export const PatchNodo = async (req: Request, res: Response) => {
  const id = parseInt(getParam(req.params.id));
  let sanitizedBody: Record<string, any>;
  try {
    sanitizedBody = validationUtils.nodeText(req.body);
  } catch (validationError: any) {
    return res.status(400).json({ message: validationError.message || 'Datos de nodo inválidos' });
  }
  const {
    name,
    code,
    description,
    location,
    communication_method,
    ip_address,
    rf_slot,
    installation_image,
    is_enabled,
  } = sanitizedBody;
  try {
    const existingNode = await obtenerNodoporId(id);

    if (!existingNode) {
      return res.status(404).json({ message: 'Nodo no encontrado' });
    }

    const dataToUpdate: any = {};

    if (name !== undefined) dataToUpdate.name = name;
    if (code !== undefined) dataToUpdate.code = code;
    if (description !== undefined) dataToUpdate.description = description;
    if (location !== undefined) dataToUpdate.location = location;
    if (communication_method !== undefined)
      dataToUpdate.communication_method = communication_method;
    if (ip_address !== undefined) dataToUpdate.ip_address = ip_address;
    if (rf_slot !== undefined) dataToUpdate.rf_slot = rf_slot;
    if (installation_image !== undefined) dataToUpdate.installation_image = installation_image;
    if (is_enabled !== undefined) dataToUpdate.is_enabled = is_enabled;

    // 👇 MANEJO DE IMAGEN CON MULTER
    if (req.file) {
      const extension = req.file.mimetype.split('/')[1] || 'jpg';
      const objectKey = `images/nodes/${id}/image-${Date.now()}.${extension}`;
      const publicUrl = await uploadObject({
        key: objectKey,
        body: req.file.buffer,
        contentType: req.file.mimetype,
      });

      // borrar imagen anterior si existe
      if (existingNode.installation_image) {
        let storedImagePath = existingNode.installation_image;
        // Puede ser una URL absoluta o una ruta relativa/absoluta del servidor
        if (storedImagePath.startsWith('http://') || storedImagePath.startsWith('https://')) {
          try {
            const url = new URL(storedImagePath);
            // url.pathname empieza con "/", lo removemos para usarlo como ruta relativa al cwd
            storedImagePath = url.pathname.replace(/^\/+/, '');
          } catch {
            // Si no se puede parsear como URL, seguimos usando el valor original
          }
        } else {
          // Si empieza con "/", lo tratamos como ruta relativa a la raíz pública
          storedImagePath = storedImagePath.replace(/^\/+/, '');
        }
        if (existingNode.installation_image.startsWith('http')) {
          await deleteObjectByUrl(existingNode.installation_image);
        } else {
          const oldPath = path.join(process.cwd(), storedImagePath);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
      }
      dataToUpdate.installation_image = publicUrl;
    }

    const updatedNodo = await actualizarNodo(id, dataToUpdate);

    res.status(200).json({
      data: updatedNodo,
      message: 'Nodo actualizado exitosamente',
    });
  } catch (error) {
    console.error('Error al actualizar nodo:', error);
    res.status(500).json({ message: 'Error al actualizar nodo' });
  }
};

export const changeNodeStatus = async (req: Request, res: Response, isEnabled: boolean) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'ID de nodo inválido' });
  }

  try {
    const updatedNode = await actualizarNodo(id, { is_enabled: isEnabled });

    return res.status(200).json({
      data: updatedNode,
      message: `Nodo ${isEnabled ? 'habilitado' : 'deshabilitado'} exitosamente`,
    });
  } catch (error) {
    console.error('Error al actualizar estado del nodo:', error);
    return res.status(500).json({
      message: 'Error al actualizar estado del nodo',
    });
  }
};

export const deleteNodoById = async (req: Request, res: Response) => {
  const id = parseInt(getParam(req.params.id));
  try {
    const deletedNodo = await eliminarNodo(id);
    res.status(200).json({
      data: deletedNodo,
      message: 'Nodo eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar nodo:', error);
    res.status(500).json({ message: 'Error al eliminar nodo' });
  }
};

/**
 * Reportar fallo de nodo desde el maestro RF24
 * El maestro llama a este endpoint cuando un nodo no responde (sin ACK)
 */
/**
 * Reportar recuperación de nodo (cuando vuelve a responder)
 * El maestro llama a este endpoint cuando un nodo que estaba offline vuelve a responder
 */
export const reportNodeRecovery = async (req: Request, res: Response) => {
  const { nodeId, comando } = req.body;

  if (!nodeId) {
    return res.status(400).json({ message: 'nodeId es requerido' });
  }

  try {
    console.log(`\n✅ COMANDO EXITOSO REPORTADO`);
    console.log(`   ↳ Nodo ID: ${nodeId}`);
    console.log(`   ↳ Comando exitoso: ${comando || 'N/A'}`);

    // Obtener nodo actual
    const node = await obtenerNodoporId(nodeId);

    if (!node) {
      return res.status(404).json({ message: 'Nodo no encontrado' });
    }

    // 🔧 El is_online lo maneja exclusivamente el heartbeat
    // Aquí solo emitimos evento de que el comando fue exitoso
    const io = getIO();

    io.emit('node:command:success', {
      nodeId: node.id,
      code: node.code,
      comando: comando || 'UNKNOWN',
      timestamp: new Date(),
    });

    console.log(`✅ Comando exitoso notificado: ${node.code} - ${comando}`);

    res.status(200).json({
      success: true,
      message: 'Comando exitoso registrado',
      nodeId: node.id,
      code: node.code,
    });
  } catch (error: any) {
    console.error('❌ Error al reportar recuperación:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al reportar recuperación',
    });
  }
};

/**
 * Reportar fallo de nodo desde el maestro RF24
 * El maestro llama a este endpoint cuando un nodo no responde (sin ACK)
 */
export const reportNodeFailure = async (req: Request, res: Response) => {
  console.log('\n📡 POST /api/nodes/failure - Petición recibida');

  const { nodeId, comando, intentos } = req.body;

  if (!nodeId) {
    return res.status(400).json({ message: 'nodeId es requerido' });
  }

  try {
    console.log(`\n⚠️ COMANDO FALLIDO REPORTADO`);
    console.log(`   ↳ Nodo ID: ${nodeId}`);
    console.log(`   ↳ Comando fallido: ${comando || 'N/A'}`);
    console.log(`   ↳ Intentos: ${intentos || 3}`);

    // 🔧 SOLO actualizar last_failure_at
    // El estado is_online lo maneja exclusivamente el heartbeat mediante ping
    const updatedNode = await actualizarNodo(nodeId, {
      last_failure_at: new Date(),
    });

    console.log(
      `✅ Fallo registrado: ${updatedNode.code} - Comando ${comando} falló tras ${intentos} intentos`
    );
    console.log(`   ℹ️  is_online será actualizado por heartbeat`);

    // Emitir evento de comando fallido (NO es cambio de conectividad)
    const io = getIO();

    io.emit('node:command:failed', {
      nodeId: updatedNode.id,
      code: updatedNode.code,
      comando: comando || 'UNKNOWN',
      intentos: intentos || 3,
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'Fallo de comando registrado',
      nodeId: updatedNode.id,
      code: updatedNode.code,
      note: 'is_online será determinado por heartbeat',
    });
  } catch (error: any) {
    console.error('❌ Error al reportar fallo:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al reportar fallo',
    });
  }
};

/**
 * Registra un reporte de salud de un nodo hijo.
 * Lo llama el Maestro RF24 (API Key).
 *
 * El hijo manda estos contadores dentro del ACK payload de
 * cada comando RF. Los persistentes (radioReinits, boots)
 * viven en su EEPROM y sobreviven a reinicios y cortes de
 * luz; los otros son volatiles.
 *
 * El maestro ya filtra por cadencia (solo postea cuando algo
 * cambia, o un snapshot por hora). Aca se deduplica igual
 * por si se reinicia el maestro o llegan repetidos.
 */
export const reportNodeHealth = async (req: Request, res: Response) => {
  const {
    nodeId,
    code,
    rfNode,
    radioReinits,
    boots,
    rxCount,
    uptimeHours,
    abnormalReset = false,
    reinitThisSession = false,
    viaRepeater,
  } = req.body as NodeHealthPayload;
  if (rfNode === undefined || rfNode < 1 || rfNode > 5) {
    return res.status(400).json({
      success: false,
      message: 'rfNode es requerido y debe estar entre 1 y 5',
    });
  }
  try {
    // Resolver el nodo: por id, luego por code, y como
    // ultimo recurso por slot RF.
    let node = null;
    if (nodeId) node = await obtenerNodoporId(nodeId);
    if (!node && code) node = await obtenerNodoporCode(code);
    if (!node) node = await obtenerNodoPorSlotRF(rfNode);
    if (!node) {
      console.warn(`⚠️  Salud recibida de rfNode=${rfNode} sin nodo asociado`);
      return res.status(404).json({
        success: false,
        message: 'Nodo no encontrado',
      });
    }
    const ultimo = await obtenerUltimaSalud(node.id);
    const unaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
    const sinCambios =
      ultimo &&
      ultimo.radio_reinits === radioReinits &&
      ultimo.boots === boots &&
      ultimo.abnormal_reset === abnormalReset &&
      ultimo.recorded_at > unaHoraAtras;
    if (sinCambios) {
      return res.status(200).json({
        success: true,
        message: 'Sin cambios, no se registro',
        deduplicated: true,
      });
    }
    const log = await crearRegistroSalud({
      node_id: node.id,
      rf_node: rfNode,
      radio_reinits: radioReinits ?? 0,
      boots: boots ?? 0,
      rx_count: rxCount ?? 0,
      uptime_hours: uptimeHours ?? 0,
      abnormal_reset: abnormalReset,
      reinit_this_session: reinitThisSession,
      via_repeater: viaRepeater ?? null,
    });
    // Un reinicio de radio o un reset anormal son sintomas
    // reales, no ruido. Vale la pena que queden visibles y
    // que el front se entere en el momento.
    const subioReinits = radioReinits > (ultimo?.radio_reinits ?? 0);
    if (subioReinits) {
      console.warn(
        `⚠️  ${node.code}: reinicios de radio ${ultimo?.radio_reinits ?? 0} → ${radioReinits}`
      );
    }
    if (abnormalReset) {
      console.warn(`⚠️  ${node.code}: reinicio anormal (watchdog o excepcion)`);
    }
    if (subioReinits || abnormalReset) {
      const io = getIO();
      io.emit('node:health:alert', {
        nodeId: node.id,
        code: node.code,
        radioReinits,
        boots,
        abnormalReset,
        timestamp: new Date(),
      });
    }
    return res.status(201).json({
      success: true,
      message: 'Salud registrada',
      data: {
        id: log.id.toString(),
        code: node.code,
        recordedAt: log.recorded_at,
      },
    });
  } catch (error: any) {
    console.error('❌ Error al registrar salud del nodo:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al registrar salud del nodo',
    });
  }
};
/**
 * Historial de salud de un nodo.
 * Query: ?limit=100&days=30
 */
export const getNodeHealthHistory = async (req: Request, res: Response) => {
  const id = parseInt(getParam(req.params.id));
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'ID de nodo inválido' });
  }
  try {
    const logs = await obtenerHistorialSalud(id, {
      limit: Number(req.query.limit) || undefined,
      days: Number(req.query.days) || undefined,
    });
    res.status(200).json({
      cant: logs.length,
      data: logs.map((l) => ({ ...l, id: l.id.toString() })),
      message: 'Historial de salud obtenido exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener historial de salud:', error);
    res.status(500).json({ message: 'Error al obtener historial de salud' });
  }
};
/**
 * Ultimo estado de salud de cada nodo habilitado, con el
 * delta de reinicios de los ultimos N dias.
 *
 * Esta es la vista del seguimiento semanal: si
 * reinitsLast7Days da 0 en todos, el fix del TX FIFO del
 * firmware de hijo v2.3 esta funcionando y se puede
 * replicar al resto de los nodos.
 */
export const getNodeHealthSummary = async (req: Request, res: Response) => {
  const days = Number(req.query.days) || 7;
  try {
    const nodos = await obtenerTodoNodos();
    const data = await Promise.all(
      nodos.map(async (node) => {
        const { ultimo, primeroVentana, anormalesVentana } = await obtenerResumenSaludNodo(
          node.id,
          days
        );
        if (!ultimo) {
          return {
            nodeId: node.id,
            code: node.code,
            name: node.name,
            rfSlot: node.rf_slot,
            sinDatos: true,
          };
        }
        // Delta, no absoluto: el absoluto arrastra historia
        // vieja y no dice como esta el nodo ahora.
        const reinitsEnVentana = primeroVentana
          ? ultimo.radio_reinits - primeroVentana.radio_reinits
          : 0;
        const bootsEnVentana = primeroVentana ? ultimo.boots - primeroVentana.boots : 0;
        return {
          nodeId: node.id,
          code: node.code,
          name: node.name,
          rfSlot: node.rf_slot,
          sinDatos: false,
          radioReinits: ultimo.radio_reinits,
          boots: ultimo.boots,
          uptimeHours: ultimo.uptime_hours,
          rxCount: ultimo.rx_count,
          viaRepeater: ultimo.via_repeater,
          lastReportAt: ultimo.recorded_at,
          ventanaDias: days,
          reinitsEnVentana,
          bootsEnVentana,
          resetsAnormalesEnVentana: anormalesVentana,
          healthy: reinitsEnVentana === 0 && anormalesVentana === 0,
        };
      })
    );
    res.status(200).json({
      cant: data.length,
      data,
      message: 'Resumen de salud obtenido exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener resumen de salud:', error);
    res.status(500).json({ message: 'Error al obtener resumen de salud' });
  }
};
