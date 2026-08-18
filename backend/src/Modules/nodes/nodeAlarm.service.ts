import { PrismaClient } from '@prisma/client';
import { NodeCommunicationMethod, sendNodeCommand } from '../../services/nodeCommunication.service';
import { auditUserAlarmAction } from '../../middlewares/auditoria/userAudit.helper';

const prisma = new PrismaClient();

/**
 * Cambia el estado ON/OFF de una alarma de un nodo
 * Valida permisos y envía comando al maestro
 * Registra en auditoría
 */
export async function setNodeAlarm({
  userId,
  nodeId,
  state,
  method,
  wifiEndpoint,
}: {
  userId: string;
  nodeId: number;
  state: 'on' | 'off';
  method?: NodeCommunicationMethod;
  wifiEndpoint?: string;
}) {
  // 1️⃣ Validar nodo y obtener su código único
  const node = await prisma.nodes.findUnique({
    where: { id: nodeId },
    select: {
      id: true,
      code: true,
      communication_method: true,
      ip_address: true,
      rf_slot: true,
      rf_address: true,
      is_online: true,
      is_enabled: true,
    },
  });

  if (!node) {
    throw new Error('Nodo no existe');
  }

  if (!node.is_enabled) {
    throw new Error('Nodo deshabilitado por administración');
  }

  if (!node.is_online) {
    throw new Error('Nodo desconectado');
  }

  console.log(`\n🔔 SET NODE ALARM`);
  console.log(`   ↳ Nodo ID: ${nodeId}`);
  console.log(`   ↳ Código: ${node.code}`);
  console.log(`   ↳ Estado: ${state.toUpperCase()}`);

  // 2️⃣ Enviar comando por método de comunicación seleccionado
  const commandResult = await sendNodeCommand(
    {
      id: node.id,
      code: node.code,
      communication_method: node.communication_method || 'auto',
      ip_address: node.ip_address,
      rf_slot: node.rf_slot,
      rf_address: node.rf_address,
    },
    state === 'on',
    {
      method,
      wifiEndpoint,
    }
  );

  if (!commandResult.success) {
    throw new Error(commandResult.message || 'Error al enviar comando al nodo');
  }

  // 3️⃣ Auditoría con código
  await auditUserAlarmAction({
    userId,
    nodeId,
    code: node.code,
    state,
    source: 'websocket',
  });

  console.log(`✅ Alarma actualizada: ${node.code} → ${state.toUpperCase()}`);

  return {
    nodeId,
    code: node.code,
    state,
    method: commandResult.method,
    timestamp: new Date().toISOString(),
  };
}
