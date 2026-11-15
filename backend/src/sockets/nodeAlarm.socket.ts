import { setNodeAlarm } from '../Modules/nodes/nodeAlarm.service';
import { PrismaClient } from '@prisma/client';
import { ROLE_NAMES } from '../constants/constants';

const prisma = new PrismaClient();

// ADMIN/MASTER ven y operan todos los nodos; el resto, solo los asignados.
const isPrivilegedSocketUser = (user: any): boolean =>
  user?.role === ROLE_NAMES.ADMIN || user?.is_master === true;

// Devuelve el set de node_id asignados (no revocados) a un usuario.
const getAssignedNodeIds = async (userId: string): Promise<Set<number>> => {
  const rows = await prisma.user_nodes.findMany({
    where: { user_id: userId, is_revoked: false },
    select: { node_id: true },
  });
  return new Set(rows.map((r: { node_id: number }) => r.node_id));
};

/**
 * Registra los handlers de WebSocket para control de alarmas de nodos
 * Eventos:
 * - node:alarm:set → Cambiar estado ON/OFF
 * - node:alarm:updated → Broadcast del nuevo estado
 * - node:alarm:success → Confirmación al cliente
 * - node:states:request → Solicitar estados de todos los nodos
 * - node:states:response → Respuesta con estados de nodos
 * - node:error → Error al procesar comando
 */
export function registerNodeAlarmSocket(io: any, socket: any) {
  socket.on('node:alarm:set', async ({ nodeId, state, method, wifiEndpoint }: any) => {
    try {
      const user = socket.data.user;

      if (!user) {
        return socket.emit('node:error', {
          message: 'No autenticado',
        });
      }

      if (!['on', 'off'].includes(state)) {
        return socket.emit('node:error', {
          nodeId,
          message: 'Estado inválido (on/off)',
        });
      }

      console.log(`\n🔔 SOCKET: node:alarm:set`);
      console.log('   ↳ Usuario autenticado');
      console.log(`   ↳ Nodo ID: ${nodeId}`);
      console.log(`   ↳ Estado: ${state}`);
      if (method) {
        console.log(`   ↳ Método: ${method}`);
      }

      const result = await setNodeAlarm({
        userId: user.user_uuid,
        nodeId,
        state,
        method,
        wifiEndpoint,
        isPrivileged: isPrivilegedSocketUser(user),
      });

      // ✅ Broadcast a TODOS los clientes
      io.emit('node:alarm:updated', {
        nodeId: result.nodeId,
        code: result.code,
        state: result.state,
        method: result.method,
        timestamp: result.timestamp,
      });

      socket.emit('node:alarm:success', {
        nodeId,
        code: result.code,
        state,
        method: result.method,
        message: 'Alarma actualizada',
      });
    } catch (error: any) {
      console.error(`\n❌ SOCKET ERROR:`, error.message);

      socket.emit('node:error', {
        nodeId,
        message: error.message || 'Error al cambiar estado',
      });
    }
  });

  // 🆕 Handler para solicitar estados de todos los nodos
  socket.on('node:states:request', async () => {
    try {
      const user = socket.data.user;
      if (!user) {
        return socket.emit('node:states:response', { states: [] });
      }

      console.log('📡 Solicitando estados de nodos...');

      const nodes = await prisma.nodes.findMany({
        where: {
          is_enabled: true,
        },
      });

      // Un CLIENTE solo recibe el estado de los nodos que tiene asignados.
      let visibleNodes = nodes;
      if (!isPrivilegedSocketUser(user)) {
        const assigned = await getAssignedNodeIds(user.user_uuid);
        visibleNodes = nodes.filter((node: { id: number }) => assigned.has(node.id));
      }

      const nodeStates = visibleNodes.map((node) => ({
        nodeId: node.id,
        code: node.code,
        state: node.is_alarm_on ? 'on' : 'off',
        is_online: node.is_online ?? true,
      }));

      console.log(`✅ Enviando estados de ${nodeStates.length} nodos`);

      socket.emit('node:states:response', { states: nodeStates });
    } catch (error: any) {
      console.error('❌ Error al obtener estados de nodos:', error);
      socket.emit('node:states:response', { states: [] });
    }
  });

  // 🆕 Handler para escuchar eventos de nodo offline desde otros módulos
  socket.on('node:status:change', (data: any) => {
    console.log(
      `📢 Broadcasting node status change: ${data.code} → ${data.isOnline ? 'ONLINE' : 'OFFLINE'}`
    );
    io.emit('node:status:change', data);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket desconectado: ${socket.id}`);
  });
}
