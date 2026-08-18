import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { getIO } from '../index';
import { pingNodeByCommunication } from './nodeCommunication.service';

const prisma = new PrismaClient();

// Intervalo de heartbeat en milisegundos (configurable por env)
const HEARTBEAT_INTERVAL = config.HEARTBEAT_INTERVAL_MS;

/**
 * Ejecuta heartbeat para todos los nodos habilitados
 */
export async function runHeartbeat() {
  try {
    console.log('\n💓 HEARTBEAT: Verificando estado de nodos...');

    // ✅ Obtener TODOS los nodos habilitados (SIN filtrar por is_online)
    const nodes = await prisma.nodes.findMany({
      where: {
        is_enabled: true, // Solo nodos habilitados
        // 🔧 NO FILTRAR POR is_online para poder detectar recuperaciones
      },
      select: {
        id: true,
        code: true,
        communication_method: true,
        ip_address: true,
        rf_slot: true,
        rf_address: true,
        is_online: true,
      },
      orderBy: { id: 'asc' },
    });

    console.log(`   ↳ Nodos habilitados a verificar: ${nodes.length}`);

    const io = getIO();
    let cambiosDetectados = 0;

    for (const node of nodes) {
      // Hacer ping al nodo por su método de comunicación configurado
      const isOnlineNow = await pingNodeByCommunication({
        id: node.id,
        code: node.code,
        communication_method: node.communication_method || 'auto',
        ip_address: node.ip_address,
        rf_slot: node.rf_slot,
        rf_address: node.rf_address,
      });

      // Determinar si hubo cambio de estado
      const cambio = node.is_online !== isOnlineNow;

      if (cambio) {
        const estadoAnterior = node.is_online ? 'ONLINE' : 'OFFLINE';
        const estadoNuevo = isOnlineNow ? 'ONLINE' : 'OFFLINE';

        console.log(
          `   ${isOnlineNow ? '✅' : '❌'} ${node.code}: ${estadoAnterior} → ${estadoNuevo}`
        );
        cambiosDetectados++;

        // Actualizar base de datos
        await prisma.nodes.update({
          where: { id: node.id },
          data: {
            is_online: isOnlineNow,
            last_failure_at: isOnlineNow ? null : new Date(),
          },
        });

        // Emitir evento WebSocket
        io.emit('node:status:change', {
          nodeId: node.id,
          code: node.code,
          isOnline: isOnlineNow,
          timestamp: new Date(),
          reason: isOnlineNow ? 'HEARTBEAT_RECOVERY' : 'HEARTBEAT_FAILURE',
        });
      } else {
        // Sin cambios, solo mostrar estado actual
        console.log(
          `   ${isOnlineNow ? '🟢' : '🔴'} ${node.code}: ${isOnlineNow ? 'ONLINE' : 'OFFLINE'} (sin cambios)`
        );
      }

      // Pequeña pausa entre verificaciones para no saturar
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(
      `✅ Heartbeat completado: ${nodes.length} nodos verificados, ${cambiosDetectados} cambios detectados\n`
    );
  } catch (error) {
    console.error('❌ Error en heartbeat:', error);
  }
}

/**
 * Inicia el servicio de heartbeat periódico
 */
export function startHeartbeatService() {
  console.log('💓 Servicio de Heartbeat iniciado');
  console.log(`   ↳ Intervalo: ${HEARTBEAT_INTERVAL} ms`);
  console.log(`   ↳ Primer heartbeat en 10 segundos`);

  // Ejecutar inmediatamente al iniciar
  setTimeout(() => runHeartbeat(), 10000); // Primer heartbeat después de 10 segundos

  // Luego ejecutar periódicamente
  setInterval(runHeartbeat, HEARTBEAT_INTERVAL);
}

/**
 * Fuerza una verificación inmediata (útil para testing)
 */
export async function forceHeartbeat(req: any, res: any) {
  try {
    await runHeartbeat();
    res.json({ success: true, message: 'Heartbeat ejecutado' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
