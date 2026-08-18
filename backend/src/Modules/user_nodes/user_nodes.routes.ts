import { Router } from 'express';

import {
  postUserNode,
  patchUserNodeStatus,
  getNodesByUserId,
  postAssignBulk,
} from './user_nodes.controller';

import { verifyToken } from '../../middlewares/verifyToken';
import { adminAudit } from '../../middlewares/auditoria/adminAudit';
import { PrismaClient, admin_action_type } from '@prisma/client';
const prisma = new PrismaClient();

const router = Router();

/**
 * NUEVA RUTA: Sincronización masiva desde el Modal
 * Soluciona el error 404
 */
router.post('/assign-bulk', verifyToken, postAssignBulk);

router.get(
  '/getnodesbyuserid/:user_id',
  // #swagger.tags = ['User Nodes']
  // #swagger.description = 'Obtiene los nodos asignados a un usuario por su ID'
  verifyToken,
  getNodesByUserId
);

router.post(
  '/user_nodes/postusernode',
  // #swagger.tags = ['User Nodes']
  // #swagger.description = 'Asigna un nodo a un usuario'
  verifyToken,
  adminAudit({
    action: admin_action_type.ASSIGN_NODE,
    getNewValue: (req) => ({
      user_id: req.body.user_id,
      node_id: Number(req.body.node_id),
      is_revoked: false,
    }),
    getAffectedUserId: (req) => req.body.user_id,
    getAffectedNodeId: (req) => Number(req.body.node_id),
  }),
  postUserNode
);

router.patch(
  '/patchusernodestatus/:id',
  // #swagger.tags = ['User Nodes']
  // #swagger.description = 'Actualiza el estado de un nodo de usuario'
  verifyToken,
  adminAudit({
    action: admin_action_type.REVOKE_NODE,

    getOldValue: async (req) => {
      return prisma.user_nodes.findUnique({
        where: { id: Number(req.params.id) },
        select: {
          user_id: true,
          node_id: true,
          is_revoked: true,
          revoked_at: true,
        },
      });
    },

    // 🔴 SIN BODY → siempre revocar
    getNewValue: () => ({
      is_revoked: true,
      revoked_at: new Date(),
    }),

    getAffectedUserId: async (req) => {
      const record = await prisma.user_nodes.findUnique({
        where: { id: Number(req.params.id) },
        select: { user_id: true },
      });
      return record?.user_id ?? null;
    },

    getAffectedNodeId: async (req) => {
      const record = await prisma.user_nodes.findUnique({
        where: { id: Number(req.params.id) },
        select: { node_id: true },
      });
      return record?.node_id ?? null;
    },
  }),
  patchUserNodeStatus
);

export default router;
