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
} from './nodes.service';
import { getNodeCommunicationMethod } from '../../services/nodeCommunication.service';

// Helper para normalizar parámetros de ruta (pueden ser string | string[])
const getParam = (param: string | string[] | undefined): string => {
  return Array.isArray(param) ? param[0] : param || '';
};

export const getNodos = async (req: Request, res: Response) => {
  try {
    const nodos = await obtenerTodoNodos();
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
    const nodos = await todoNodos();
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

export const getNodoById = async (req: Request, res: Response) => {
  const id = parseInt(getParam(req.params.id));
  try {
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
  const data = req.body;
  try {
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
  const {
    name,
    code,
    description,
    location,
    communication_method,
    ip_address,
    rf_address,
    rf_slot,
    installation_image,
    is_enabled,
  } = req.body;
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
    if (rf_address !== undefined) dataToUpdate.rf_address = rf_address;
    if (rf_slot !== undefined) dataToUpdate.rf_slot = rf_slot;
    if (installation_image !== undefined) dataToUpdate.installation_image = installation_image;
    if (is_enabled !== undefined) dataToUpdate.is_enabled = is_enabled;

    // 👇 MANEJO DE IMAGEN CON MULTER
    if (req.file) {
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
        const oldPath = path.join(process.cwd(), storedImagePath);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      // Guardamos una URL pública absoluta para que el frontend (en otro dominio)
      // pueda usarla directamente como src de la imagen.
      const publicPath = `/uploads/nodes_images/${req.file.filename}`;
      const host = req.get('host');
      const protocol = req.protocol;
      const publicUrl = host != null ? `${protocol}://${host}${publicPath}` : publicPath;
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
  console.log('   ↳ Body:', req.body);
  console.log('   ↳ Headers:', req.headers);

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
