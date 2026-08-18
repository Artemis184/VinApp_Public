import { Router, Request, Response, NextFunction } from 'express';

import {
  getNodos,
  getAllNodos,
  getMaestroNodeMap,
  getNodoById,
  getNodoByCode,
  postNodo,
  PatchNodo,
  changeNodeStatus,
  reportNodeFailure,
  reportNodeRecovery,
} from './nodes.controller';

import { verifyToken } from '../../middlewares/verifyToken';
import { adminAudit } from '../../middlewares/auditoria/adminAudit';
import { userAudit } from '../../middlewares/auditoria/userAudit';
import { PrismaClient, admin_action_type, user_action_type } from '@prisma/client';
import { forceHeartbeat } from '../../services/nodeHeartbeat.service';

import { uploadNodeImage } from '../../middlewares/uploadNodeImage';

const prisma = new PrismaClient();

const router = Router();

/* =========================
   API KEY MIDDLEWARE
========================= */

/**
 * Middleware para validar API Key del Arduino Maestro
 * Verifica el header 'x-api-key' contra la variable de entorno
 */
const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.ARDUINO_API_KEY || '';

  console.log('\n🔑 API KEY MIDDLEWARE');
  console.log('   ↳ Header recibido:', apiKey || '(vacío)');
  console.log('   ↳ API Key esperada:', validApiKey);
  console.log('   ↳ Coincide:', apiKey === validApiKey);

  if (apiKey === validApiKey) {
    console.log('   ✅ API Key válida - Arduino Maestro autenticado');
    return next();
  }

  console.warn('   ❌ API Key inválida o faltante');
  res.status(401).json({
    success: false,
    error: 'API Key inválida o faltante',
    message: 'Se requiere header x-api-key válido',
  });
};

/* =========================
   HELPERS
========================= */

// Obtiene SOLO los valores antiguos de los campos enviados en el body
const getOldValuesFromBody = async (NodeId: number, body: Record<string, any>) => {
  const user = await prisma.nodes.findUnique({
    where: { id: NodeId },
  });

  if (!user) return null;

  const oldValues: Record<string, any> = {};

  for (const key of Object.keys(body)) {
    if (key in user) {
      oldValues[key] = (user as any)[key];
    }
  }

  return oldValues;
};

// Devuelve SOLO los campos que realmente cambian
const diffOldValues = (oldData: any, newData: any) => {
  if (!oldData || !newData) return null;

  const diff: Record<string, any> = {};

  for (const key of Object.keys(newData)) {
    if (oldData[key] !== newData[key]) {
      diff[key] = oldData[key];
    }
  }

  return Object.keys(diff).length ? diff : null;
};

/* =========================
   ROUTES
========================= */

router.get(
  '/maestro/map',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Mapa de nodos para maestro RF24 (API Key)'
  apiKeyMiddleware,
  getMaestroNodeMap
);

router.get(
  '/',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Obtiene todos los nodos'
  verifyToken,
  getNodos
);
router.get(
  '/list',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Obtiene todos los nodos incluyendo deshabilitados'
  verifyToken,
  getAllNodos
);
router.get(
  '/:id',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Obtiene un nodo por ID'
  verifyToken,
  getNodoById
);
router.get(
  '/code/:code',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Obtiene un nodo por código'
  verifyToken,
  getNodoByCode
);

/*
=========================
   CREAR NODO (ADMIN)
========================= 
*/
router.post(
  '/postnode',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Crea un nuevo nodo'
  verifyToken,
  adminAudit({
    action: admin_action_type.CREATE_NODE,
    getNewValue: (req) => req.body,
  }),
  postNodo
);
/* 
=========================
   ACTUALIZAR NODO (ADMIN)
========================= 
*/
router.patch(
  '/updatenode/:id',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Actualiza los datos de un nodo'
  verifyToken,
  uploadNodeImage.single('image'),
  adminAudit({
    action: admin_action_type.UPDATE_NODE_DATA,
    getAffectedNodeId: (req) => Number(req.params.id),
    getOldValue: async (req) => {
      const OldData = await getOldValuesFromBody(Number(req.params.id), req.body);
      return diffOldValues(OldData, req.body);
    },
    getNewValue: (req) => req.body,
  }),
  (req, res) => PatchNodo(req, res)
);

//ENABLE NODE!!!!
router.patch(
  '/enablenode/:id',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Habilita un nodo'
  verifyToken,
  adminAudit({
    action: admin_action_type.ENABLE_NODE,
    getAffectedNodeId: (req) => Number(req.params.id),
    getOldValue: async (req) =>
      prisma.nodes.findUnique({
        where: { id: Number(req.params.id) },
        select: { is_enabled: true },
      }),
    getNewValue: () => ({ is_enabled: true }),
  }),
  (req, res) => changeNodeStatus(req, res, true)
);

/* 
=========================
   ELIMINAR (DESHABILITAR)
========================= 
*/
router.patch(
  '/disablenode/:id',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Deshabilita un nodo'
  verifyToken,
  adminAudit({
    action: admin_action_type.SUSPEND_NODE,
    getAffectedNodeId: (req) => Number(req.params.id),
    getOldValue: async (req) =>
      prisma.nodes.findUnique({
        where: { id: Number(req.params.id) },
        select: { is_enabled: true },
      }),
    getNewValue: () => ({ is_enabled: false }),
  }),
  (req, res) => changeNodeStatus(req, res, false)
);

// ASIGNAR NODO A USUARIO
router.post(
  '/users/:userId/nodes/:nodeId',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Asigna un nodo a un usuario'
  verifyToken,
  adminAudit({
    action: admin_action_type.ASSIGN_NODE,
    getAffectedUserId: (req) =>
      Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId,
    getNewValue: (req) => ({
      nodeId: req.params.nodeId,
    }),
  }),
  (req, res) => res.status(200).json({ message: 'Nodo asignado' })
);

// REVOCAR NODO A USUARIO
router.delete(
  '/users/:userId/nodes/:nodeId',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Revoca un nodo de un usuario'
  verifyToken,
  adminAudit({
    action: admin_action_type.REVOKE_NODE,
    getAffectedUserId: (req) =>
      Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId,
    getNewValue: (req) => ({
      nodeId: req.params.nodeId,
    }),
  }),
  (req, res) => res.status(200).json({ message: 'Nodo revocado' })
);

//AUDITORIA PARA LOS USUARIOS FINALES

router.patch(
  '/nodes/:id/alarm/:state',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Cambia el estado de la alarma de un nodo'
  verifyToken,
  userAudit({
    action: (req) =>
      req.params.state === 'on' ? user_action_type.ALARM_ON : user_action_type.ALARM_OFF,

    getNodeId: (req) => Number(req.params.id),

    getMetadata: (req) => ({
      action: req.params.state,
    }),
  }),
  (req, res) => {
    const state = Array.isArray(req.params.state) ? req.params.state[0] : req.params.state;

    if (!['on', 'off'].includes(state)) {
      return res.status(400).json({ message: 'Estado de alarma inválido' });
    }

    res.status(200).json({
      message: `Alarma ${state === 'on' ? 'encendida' : 'apagada'}`,
    });
  }
);

// REPORTAR FALLO DE NODO (llamado por el Maestro RF24)
// 🔐 Protegido con API Key - No requiere JWT
router.post(
  '/failure',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Reporta fallo de comunicación con un nodo (requiere API Key)'
  apiKeyMiddleware,
  reportNodeFailure
);

// REPORTAR RECUPERACIÓN DE NODO (llamado por el Maestro RF24)
// 🔐 Protegido con API Key - No requiere JWT
router.post(
  '/recovery',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Reporta recuperación de un nodo que vuelve a responder (requiere API Key)'
  apiKeyMiddleware,
  reportNodeRecovery
);

// 🧪 ENDPOINT DE PRUEBA - Sin autenticación (para testing)
router.get(
  '/ping',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Endpoint de prueba de conectividad'
  (req, res) => {
    console.log('\n🏓 PING recibido desde:', req.ip);
    res.json({ message: 'pong', timestamp: new Date() });
  }
);

// 💓 FORZAR HEARTBEAT - Protegido con JWT (solo admins)
router.post(
  '/heartbeat',
  // #swagger.tags = ['Nodes']
  // #swagger.description = 'Fuerza verificación inmediata de estado de todos los nodos'
  verifyToken,
  forceHeartbeat
);

export default router;
