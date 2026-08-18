import { PrismaClient } from '@prisma/client';

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
    const node_Actualizado = await prisma.nodes.update({
      where: { id },
      data,
    });

    return node_Actualizado;
  } catch (error) {
    console.error('Error al actualizar el nodo:', error);
    throw new Error('Error al actualizar el nodo', { cause: error });
  }
};

export const eliminarNodo = async (id: number) => {
  //ahora en ves de eliminar lo deshabilite
  try {
    return await prisma.nodes.update({
      where: { id },
      data: { is_enabled: false },
    });
  } catch (error) {
    console.error('Error al deshabilitar nodo:', error);
    throw new Error('Error al deshabilitar nodo', { cause: error });
  }
};

export const nodoEnabled = async (id: number, is_enabled: boolean) => {
  try {
    return await prisma.nodes.update({
      where: { id },
      data: { is_enabled },
    });
  } catch (error) {
    console.error('Error al cambiar is_enabled del nodo:', error);
    throw new Error('Error al cambiar is_enabled del nodo', { cause: error });
  }
};
