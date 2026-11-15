import { PrismaClient } from '@prisma/client';
import { NodeCommunicationMethod, sendNodeCommand } from '../../services/nodeCommunication.service';
import { auditUserAlarmAction } from '../../middlewares/auditoria/userAudit.helper';
import { notifyNodeStateChange } from '../../services/telegram.service';

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
  isPrivileged = false,
}: {
  userId: string;
  nodeId: number;
  state: 'on' | 'off';
  method?: NodeCommunicationMethod;
  wifiEndpoint?: string;
  // ADMIN/MASTER pueden operar cualquier nodo; un CLIENTE solo los suyos.
  isPrivileged?: boolean;
}) {
  // Coerción defensiva: el socket puede entregar nodeId como string ("5"),
  // y node_id/id son Int en Prisma. Sin esto, un CLIENTE con el nodo asignado
  // recibiría un falso "No tienes acceso" por no hacer match el tipo.
  const numericNodeId = Number(nodeId);
  if (!Number.isInteger(numericNodeId)) {
    throw new Error('nodeId inválido');
  }

  // 0️⃣ Autorización horizontal: salvo ADMIN/MASTER, el usuario solo puede
  // controlar nodos que tenga asignados y no revocados. Antes NO se validaba,
  // así que cualquier usuario podía operar la alarma de cualquier nodo.
  // El CLIENTE SÍ puede encender/apagar sus nodos asignados; solo se bloquean
  // los nodos que no son suyos.
  if (!isPrivileged) {
    const assignment = await prisma.user_nodes.findFirst({
      where: { user_id: userId, node_id: numericNodeId, is_revoked: false },
      select: { id: true },
    });

    if (!assignment) {
      throw new Error('No tienes acceso a este nodo');
    }
  }

  // 1️⃣ Validar nodo y obtener su código único
  const node = await prisma.nodes.findUnique({
    where: { id: numericNodeId },
    select: {
      id: true,
      name: true,
      code: true,
      communication_method: true,
      ip_address: true,
      rf_slot: true,
      rf_address: true,
      is_online: true,
      is_enabled: true,
      is_alarm_on: true,
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
    nodeId: numericNodeId,
    code: node.code,
    state,
    source: 'websocket',
  });

  const alarmIsOn = state === 'on';
  if (node.is_alarm_on !== alarmIsOn) {
    await prisma.nodes.update({
      where: { id: nodeId },
      data: { is_alarm_on: alarmIsOn },
    });

    await notifyNodeStateChange(
      {
        ...node,
        is_alarm_on: alarmIsOn,
      },
      { alarm: true }
    );
  }

  console.log(`✅ Alarma actualizada: ${node.code} → ${state.toUpperCase()}`);

  return {
    nodeId,
    code: node.code,
    state,
    method: commandResult.method,
    timestamp: new Date().toISOString(),
  };
}
