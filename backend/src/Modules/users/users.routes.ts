import { Router, Request, Response, NextFunction } from 'express';
import {
  getUsers,
  getUserById,
  getUserByName,
  postUserWithEmail,
  patchPersonalData,
  postUserGoogle,
  patchUser,
  changeUserStatus,
  updateMyProfile,
  getPendingUsers,
  getMyProfile,
} from './users.controller';
import { validationUtils } from '../../middlewares/validationMiddleware';

import { verifyToken } from '../../middlewares/verifyToken';
import { requireAdmin } from '../../middlewares/authorizeRoles';
import { adminAudit } from '../../middlewares/auditoria/adminAudit';
import { userAudit } from '../../middlewares/auditoria/userAudit';
import { PrismaClient, admin_action_type, user_status, user_action_type } from '@prisma/client';
import { avatarUpload } from '../../middlewares/users/avatarUpload';
import multer from 'multer';

const prisma = new PrismaClient();
const router = Router();

const uploadAvatarMiddleware = (req: Request, res: Response, next: NextFunction) => {
  avatarUpload.single('avatar')(req, res, (error: any) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'La imagen supera el límite de 5MB' });
    }

    return res.status(400).json({
      message: error.message || 'Error al cargar imagen de avatar',
    });
  });
};

const sanitizeProfileUpdate = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.body && Object.keys(req.body).length > 0) {
      // Los campos que validationUtils sabe manejar
      const fieldsToSanitize = ['full_name', 'apodo', 'address', 'reference', 'email'];
      // Extraemos solo esos campos del body original
      const textFields = Object.fromEntries(
        fieldsToSanitize
          .filter((field) => req.body[field] !== undefined)
          .map((field) => [field, req.body[field]])
      );

      // Si hay campos para sanear, los pasamos por validationUtils y los mezclamos de vuelta
      if (Object.keys(textFields).length > 0) {
        const sanitizedTextFields = validationUtils.userUpdate(textFields);
        req.body = { ...req.body, ...sanitizedTextFields };
      }
    }
    next();
  } catch (error: any) {
    // Captura errores de validación (ej. email inválido) y corta la petición aquí mismo
    return res.status(400).json({ message: error.message || 'Error de validación en los datos' });
  }
};

/* =========================
   HELPERS
========================= */

// Normaliza userId desde req.params (puede ser string | string[])
const getUserId = (userId: string | string[] | undefined): string => {
  if (Array.isArray(userId)) return userId[0];
  return userId || '';
};

// Valida formato UUID v4 (simple regex)
const isValidUUID = (value: string): boolean =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value
  );

// Middleware para asegurar que el userId del path sea un UUID válido
const validateUserIdParam = (req: Request, res: Response, next: NextFunction) => {
  const userId = getUserId(req.params.userId);

  if (!isValidUUID(userId)) {
    return res.status(400).json({ message: 'userId inválido' });
  }

  req.params.userId = userId;
  next();
};

// Obtiene SOLO los valores antiguos de los campos enviados en el body
const getOldValuesFromBody = async (userId: string, body: Record<string, any>) => {
  const user = await prisma.users.findUnique({
    where: { id: userId },
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
  '/users/getusers',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Obtiene todos los usuarios (filtrados por rol del usuario autenticado)'
  // #swagger.security = [{"bearerAuth": []}]
  verifyToken,
  requireAdmin,
  getUsers
);
router.get(
  '/users/pending',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Obtiene usuarios con estado PENDING'
  verifyToken,
  requireAdmin,
  getPendingUsers
);
router.get(
  '/users/getuser/:id',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Obtiene un usuario por ID'
  // #swagger.security = [{"bearerAuth": []}]
  verifyToken,
  requireAdmin,
  getUserById
);
router.get(
  '/users/getuserbyname/:name',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Obtiene usuarios por nombre o apodo'
  // #swagger.security = [{"bearerAuth": []}]
  verifyToken,
  requireAdmin,
  getUserByName
);
router.post(
  '/users/postuserwithemail',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Crea un usuario con email'
  postUserWithEmail
);
router.post(
  '/users/postusergoogle',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Crea un usuario con Google'
  postUserGoogle
);

/* ===================================
   USER REGISTRATION – PERSONAL DATA
   (STEP 2)
====================================== */

router.patch(
  '/users/register/:userId',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Completa los datos personales del usuario en el registro (PASO 2)'
  validateUserIdParam,
  patchPersonalData
);

/* =========================
   UPDATE MY PROFILE (SELF)
========================= */

router.get(
  '/users/profile',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Obtiene el perfil del usuario autenticado'
  verifyToken,
  getMyProfile
);

router.patch(
  '/users/profile',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Actualiza el perfil del usuario autenticado (sus propios datos)'
  verifyToken,
  uploadAvatarMiddleware,
  sanitizeProfileUpdate,
  userAudit({
    action: user_action_type.UPDATE_USER_DATA,
    getMetadata: async (req) => {
      const userId = req.user?.user_uuid;
      if (!userId) return null;

      const avatarFile = (req as Request & { file?: Express.Multer.File }).file;

      // Gracias al middleware anterior, este req.body ya viene con los strings saneados
      // y con los demás campos (password, age) intactos.
      const payloadForAudit: Record<string, any> = { ...req.body };

      if (avatarFile?.filename) {
        payloadForAudit.profile_photo = avatarFile.filename;
      }

      const oldData = await getOldValuesFromBody(userId, payloadForAudit);
      const changedFields = diffOldValues(oldData, payloadForAudit);

      return {
        old_values: changedFields,
        new_values: payloadForAudit,
      };
    },
  }),
  (req, res) => updateMyProfile(req, res)
);
/* =========================
   UPDATE USER DATA (ADMIN)
========================= */

router.patch(
  '/users/updateuser/:userId',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Actualiza los datos de OTRO usuario (solo admin)'
  verifyToken,
  validateUserIdParam,
  adminAudit({
    action: admin_action_type.UPDATE_USER_DATA,
    getAffectedUserId: (req) => getUserId(req.params.userId),
    getOldValue: async (req) => {
      const oldData = await getOldValuesFromBody(getUserId(req.params.userId), req.body);
      return diffOldValues(oldData, req.body);
    },
    getNewValue: (req) => req.body,
  }),
  (req, res) => patchUser(req, res)
);

/* =========================
   APPROVE USER
========================= */

router.patch(
  '/users/approveuser/:userId',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Aprueba un usuario'
  verifyToken,
  validateUserIdParam,
  adminAudit({
    action: admin_action_type.APPROVE_USER,
    getAffectedUserId: (req) => getUserId(req.params.userId),
    getOldValue: async (req) =>
      prisma.users.findUnique({
        where: { id: getUserId(req.params.userId) },
        select: { status: true },
      }),
    getNewValue: () => ({ status: user_status.APPROVED }),
  }),
  (req, res) => changeUserStatus(req, res, user_status.APPROVED)
);

/* =========================
   REJECT USER
========================= */

router.patch(
  '/users/rejectuser/:userId',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Rechaza un usuario'
  verifyToken,
  validateUserIdParam,
  adminAudit({
    action: admin_action_type.REJECT_USER,
    getAffectedUserId: (req) => getUserId(req.params.userId),
    getOldValue: async (req) =>
      prisma.users.findUnique({
        where: { id: getUserId(req.params.userId) },
        select: { status: true },
      }),
    getNewValue: () => ({ status: user_status.REJECTED }),
  }),
  (req, res) => changeUserStatus(req, res, user_status.REJECTED)
);

/* =========================
   SUSPEND USER
========================= */

router.patch(
  '/users/suspenduser/:userId',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Suspende un usuario'
  verifyToken,
  validateUserIdParam,
  adminAudit({
    action: admin_action_type.SUSPEND_USER,
    getAffectedUserId: (req) => getUserId(req.params.userId),
    getOldValue: async (req) =>
      prisma.users.findUnique({
        where: { id: getUserId(req.params.userId) },
        select: { status: true },
      }),
    getNewValue: () => ({ status: user_status.SUSPENDED }),
  }),
  (req, res) => changeUserStatus(req, res, user_status.SUSPENDED)
);

/*
  Permite que el usuario autenticado actualice su propia información.
  Esta acción se registra en la auditoría de usuarios finales (audit_user_actions),
  almacenando:
  - UUID_USUARIO
  - ACCION_TYPE = UPDATE_USER_DATA
  - METADATA con los campos modificados
*/
router.patch(
  '/user_updatedata/:userId',
  // #swagger.tags = ['Users']
  // #swagger.description = 'Permite al usuario actualizar su propia información'
  verifyToken,
  validateUserIdParam,
  userAudit({
    action: user_action_type.UPDATE_USER_DATA,
    getMetadata: (req) => req.body,
  }),
  (req, res) => patchUser(req, res)
);

export default router;
