import { PrismaClient } from '@prisma/client';
import { notifyNodeStateChange } from '../../services/telegram.service';

const prisma = new PrismaClient();

export const obtenerTodoNodos = async () => {
  // con esto solo funciona con los nodos habilitados, lo que
  // antes hacia era obtener todos los nodos hasta los deshabilitados
  try {
    return await prisma.nodes.findMany({
      where: {
        is_enabled: true,
      },
      orderBy: { id: 'asc' },
    });
  } catch (error) {
    console.error('Error al obtener los nodos:', error);
    throw new Error('Error al obtener los nodos', { cause: error });
  }
};

export const todoNodos = async () => {
  // Obtiene todos los nodos incluyendo los deshabilitados
  try {
    return await prisma.nodes.findMany({
      orderBy: { id: 'asc' },
    });
  } catch (error) {
    console.error('Error al obtener los nodos:', error);
    throw new Error('Error al obtener los nodos', { cause: error });
  }
};

export const obtenerNodosParaMaestro = async () => {
  try {
    return await prisma.nodes.findMany({
      select: {
        id: true,
        code: true,
        communication_method: true,
        ip_address: true,
        rf_address: true,
        rf_slot: true,
        is_enabled: true,
        uses_repeater: true,
      },
      orderBy: { id: 'asc' },
    });
  } catch (error) {
    console.error('Error al obtener nodos para maestro:', error);
    throw new Error('Error al obtener nodos para maestro', { cause: error });
  }
};

export const obtenerNodoporId = async (id: number) => {
  try {
    const node = await prisma.nodes.findUnique({
      where: { id },
    });
    return node;
  } catch (error) {
    console.error('Error al obtener el nodo por ID:', error);
    throw new Error('Error al obtener el nodo por ID', { cause: error });
  }
};

export const obtenerNodoporCode = async (code: string) => {
  try {
    const node = await prisma.nodes.findUnique({
      where: { code },
    });
    return node;
  } catch (error) {
    console.error('Error al obtener el nodo por código:', error);
    throw new Error('Error al obtener el nodo por código', { cause: error });
  }
};

export const crearNodo = async (data: any) => {
  try {
    const existe_Node = await prisma.nodes.findUnique({
      where: { code: data.code },
    });

    if (existe_Node) {
      throw new Error('El código del nodo ya existe');
    }

    const nuevo_Node = await prisma.nodes.create({
      data,
    });

    return nuevo_Node;
  } catch (error) {
    console.error('Error al crear el nodo:', error);
    throw error;
  }
};

export const actualizarNodo = async (
  id: number,
  data: {
    name?: string;
    code?: string;
    description?: string;
    location?: string;
    communication_method?: 'rf' | 'wifi' | 'auto';
    ip_address?: string;
    rf_address?: string;
    rf_slot?: number;
    installation_image?: string;
    is_enabled?: boolean;
    is_online?: boolean;
    is_alarm_on?: boolean;
    last_failure_at?: Date;
  }
) => {
  try {
    const previousNode = await prisma.nodes.findUnique({
      where: { id },
      select: {
        name: true,
        code: true,
        is_online: true,
        is_alarm_on: true,
        is_enabled: true,
      },
    });

    const node_Actualizado = await prisma.nodes.update({
      where: { id },
      data,
    });

    if (previousNode) {
      await notifyNodeStateChange(node_Actualizado, {
        online: previousNode.is_online !== node_Actualizado.is_online,
        alarm: previousNode.is_alarm_on !== node_Actualizado.is_alarm_on,
        enabled: previousNode.is_enabled !== node_Actualizado.is_enabled,
      });
    }

    return node_Actualizado;
  } catch (error) {
    console.error('Error al actualizar el nodo:', error);
    throw new Error('Error al actualizar el nodo', { cause: error });
  }
};

export const eliminarNodo = async (id: number) => {
  //ahora en ves de eliminar lo deshabilite
  try {
    return await actualizarNodo(id, { is_enabled: false });
  } catch (error) {
    console.error('Error al deshabilitar nodo:', error);
    throw new Error('Error al deshabilitar nodo', { cause: error });
  }
};

export const nodoEnabled = async (id: number, is_enabled: boolean) => {
  try {
    return await actualizarNodo(id, { is_enabled });
  } catch (error) {
    console.error('Error al cambiar is_enabled del nodo:', error);
    throw new Error('Error al cambiar is_enabled del nodo', { cause: error });
  }
};

/* =========================
   SALUD DE NODOS
========================= */

export const crearRegistroSalud = async (data: {
  node_id: number;
  rf_node: number;
  radio_reinits: number;
  boots: number;
  rx_count: number;
  uptime_hours: number;
  abnormal_reset: boolean;
  reinit_this_session: boolean;
  via_repeater?: string | null;
}) => {
  try {
    return await prisma.node_health_logs.create({ data });
  } catch (error) {
    console.error('Error al crear registro de salud:', error);
    throw new Error('Error al crear registro de salud', { cause: error });
  }
};

export const obtenerUltimaSalud = async (nodeId: number) => {
  try {
    return await prisma.node_health_logs.findFirst({
      where: { node_id: nodeId },
      orderBy: { recorded_at: 'desc' },
    });
  } catch (error) {
    console.error('Error al obtener ultima salud:', error);
    throw new Error('Error al obtener ultima salud', { cause: error });
  }
};

export const obtenerNodoPorSlotRF = async (rfSlot: number) => {
  try {
    return await prisma.nodes.findFirst({
      where: { rf_slot: rfSlot },
    });
  } catch (error) {
    console.error('Error al obtener nodo por slot RF:', error);
    throw new Error('Error al obtener nodo por slot RF', { cause: error });
  }
};
export const obtenerHistorialSalud = async (
  nodeId: number,
  opciones: { limit?: number; days?: number } = {}
) => {
  const limit = Math.min(opciones.limit ?? 100, 500);
  const days = opciones.days ?? 30;
  const desde = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    return await prisma.node_health_logs.findMany({
      where: {
        node_id: nodeId,
        recorded_at: { gte: desde },
      },
      orderBy: { recorded_at: 'desc' },
      take: limit,
    });
  } catch (error) {
    console.error('Error al obtener historial de salud:', error);
    throw new Error('Error al obtener historial de salud', { cause: error });
  }
};
/**
 * Resumen de salud de un nodo en una ventana de dias.
 *
 * Devuelve el DELTA de reinicios en la ventana, no el
 * absoluto: el absoluto arrastra historia vieja y no dice
 * nada sobre como esta el nodo ahora.
 */
export const obtenerResumenSaludNodo = async (nodeId: number, days = 7) => {
  const desde = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    const [ultimo, primeroVentana, anormalesVentana] = await Promise.all([
      prisma.node_health_logs.findFirst({
        where: { node_id: nodeId },
        orderBy: { recorded_at: 'desc' },
      }),
      prisma.node_health_logs.findFirst({
        where: { node_id: nodeId, recorded_at: { gte: desde } },
        orderBy: { recorded_at: 'asc' },
      }),
      prisma.node_health_logs.count({
        where: {
          node_id: nodeId,
          abnormal_reset: true,
          recorded_at: { gte: desde },
        },
      }),
    ]);
    return { ultimo, primeroVentana, anormalesVentana };
  } catch (error) {
    console.error('Error al obtener resumen de salud:', error);
    throw new Error('Error al obtener resumen de salud', { cause: error });
  }
};
export const purgarSaludAntigua = async (days = 90) => {
  const limite = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    // Los reinicios anormales se conservan: son pocos y son
    // justo los que vas a querer mirar cuando algo raro pase.
    return await prisma.node_health_logs.deleteMany({
      where: {
        recorded_at: { lt: limite },
        abnormal_reset: false,
      },
    });
  } catch (error) {
    console.error('Error al purgar salud antigua:', error);
    throw new Error('Error al purgar salud antigua', { cause: error });
  }
};
