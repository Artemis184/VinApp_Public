import { setNodeAlarm } from '../Modules/nodes/nodeAlarm.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      console.log(`   ↳ Usuario: ${user.user_uuid}`);
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
      console.log('📡 Solicitando estados de todos los nodos...');

      const nodes = await prisma.nodes.findMany({
        where: {
          is_enabled: true,
        },
      });

      const nodeStates = nodes.map((node) => ({
        nodeId: node.id,
        code: node.code,
        estado: node.is_alarm_on ?? false,
        isOnline: node.is_online ?? true,
      }));

      console.log(`✅ Enviando estados de ${nodeStates.length} nodos`);

      socket.emit('node:states:response', nodeStates);
    } catch (error: any) {
      console.error('❌ Error al obtener estados de nodos:', error);
      socket.emit('node:states:response', []);
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
