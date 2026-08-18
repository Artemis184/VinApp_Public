import { PrismaClient, user_action_type } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Registra acciones de alarma (ON/OFF) del usuario en la auditoría
 * Reusable para REST y WebSocket
 */
export async function auditUserAlarmAction({
  userId,
  nodeId,
  code,
  state,
  source = 'websocket',
}: {
  userId: string;
  nodeId: number;
  code: string;
  state: 'on' | 'off';
  source?: string;
}) {
  try {
    await prisma.audit_user_actions.create({
      data: {
        user_id: userId,
        node_id: nodeId,
        action_type: state === 'on' ? user_action_type.ALARM_ON : user_action_type.ALARM_OFF,
        metadata: {
          code,
          action: state,
          source,
        },
      },
    });

    console.log(`📝 Auditoría registrada: ${code} - ${state.toUpperCase()} (${source})`);
  } catch (error) {
    console.error('❌ Error registrando auditoría:', error);
    throw new Error('Error al registrar auditoría', { cause: error });
  }
}
