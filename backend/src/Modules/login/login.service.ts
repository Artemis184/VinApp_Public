import { PrismaClient, user_status } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { verifyGoogleIdToken } from '../../services/googleAuth.service';
import { SessionService } from '../../services/session.service';
import { asignarRolaUser } from '../user_roles/userRoles.service';
import { sendStatusEmail } from '../email/email.service';
import { ROLE_NAMES, SECURITY_CONFIG } from '../../constants/constants';

const prisma = new PrismaClient();

const notifyPendingStatusEmail = (userId: string, emailForLogs: string) => {
  sendStatusEmail(userId, user_status.PENDING).catch((error) => {
    console.error(`Error al enviar email de estado PENDING a ${emailForLogs}:`, error);
  });
};

class GoogleAuthFlowError extends Error {
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const generateAccessToken = (user: any, sessionId: string, deviceId: string) => {
  return jwt.sign(
    {
      user_uuid: user.id,
      email: user.email,
      role: user.user_roles[0]?.roles?.name ?? null,
      is_master: user.is_master,
      session_id: sessionId,
      device_id: deviceId,
    },
    config.JWT_SECRET,
    { expiresIn: SECURITY_CONFIG.TOKEN_TTL.ACCESS_TOKEN_EXPIRES_IN }
  );
};

export const loginWithEmail = async (
  email: string,
  password: string,
  deviceId: string,
  deviceInfo: Record<string, unknown> = {}
) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.users.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
    include: { user_roles: { include: { roles: true } } },
  });

  if (!user || !user.password_hash) {
    throw new Error('Credenciales inválidas');
  }

  if (user.status !== user_status.APPROVED) {
    throw new Error('Usuario no aprobado');
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    throw new Error('Credenciales inválidas');
  }

  const session = await SessionService.createPersistentSession(user.id, deviceId, deviceInfo);
  const accessToken = generateAccessToken(user, String(session.sessionId), deviceId);

  await prisma.users.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  return {
    accessToken,
    refreshToken: session.refreshToken,
    sessionId: session.sessionId,
    deviceId,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.user_roles[0]?.roles?.name ?? null,
      is_master: user.is_master,
    },
  };
};

export const loginWithGoogle = async (
  idToken: string,
  deviceId: string,
  deviceInfo: Record<string, unknown> = {}
) => {
  const googleUser = await verifyGoogleIdToken(idToken);
  const normalizedEmail = googleUser.email.trim().toLowerCase();
  const googleDisplayName = googleUser.full_name?.trim() || '';
  const normalizedGooglePhotoUrl = googleUser.profile_photo
    ?.trim()
    .replace(/^http:\/\//i, 'https://');
  let wasUserCreated = false;

  let user = await prisma.users.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
    include: { user_roles: { include: { roles: true } } },
  });

  // Crear usuario si no existe y dejarlo pendiente de aprobación
  if (!user) {
    user = await prisma.users.create({
      data: {
        email: normalizedEmail,
        google_id: googleUser.google_id,
        full_name: googleUser.full_name,
        profile_photo: normalizedGooglePhotoUrl,
        status: user_status.PENDING,
      },
      include: { user_roles: { include: { roles: true } } },
    });

    const rol = await prisma.roles.findUnique({
      where: { name: ROLE_NAMES.CLIENT },
    });

    if (!rol) {
      throw new Error(`Rol cliente no existe`);
    }

    await asignarRolaUser(user.id, rol.id);
    wasUserCreated = true;
  }

  // Para usuarios existentes, sincronizar campos de Google faltantes
  if (!wasUserCreated) {
    const googlePhoto = normalizedGooglePhotoUrl || '';
    const fieldsToSync: {
      google_id?: string;
      full_name?: string;
      profile_photo?: string;
    } = {};

    if (!user.google_id) {
      fieldsToSync.google_id = googleUser.google_id;
    }

    if (!user.full_name?.trim() && googleDisplayName) {
      fieldsToSync.full_name = googleDisplayName;
    }

    if (googlePhoto && user.profile_photo !== googlePhoto) {
      fieldsToSync.profile_photo = googlePhoto;
    }

    if (Object.keys(fieldsToSync).length > 0) {
      user = await prisma.users.update({
        where: { id: user.id },
        data: fieldsToSync,
        include: { user_roles: { include: { roles: true } } },
      });
    }
  }

  if (user.status === user_status.SUSPENDED) {
    throw new GoogleAuthFlowError('Tu cuenta está suspendida', 403, 'ACCOUNT_SUSPENDED');
  }

  if (user.status !== user_status.APPROVED) {
    // Al intentar acceder con Google y quedar en PENDING, se notifica por correo inmediatamente.
    if (user.status === user_status.PENDING || wasUserCreated) {
      notifyPendingStatusEmail(user.id, user.email);
    }

    const resolvedFullName = user.full_name?.trim() || googleDisplayName;
    const requiresProfileCompletion = !user.full_name?.trim() || !user.phone || !user.address;

    if (requiresProfileCompletion) {
      throw new GoogleAuthFlowError(
        'Completa tus datos personales para continuar',
        403,
        'PENDING_PROFILE_COMPLETION',
        {
          requires_profile_completion: true,
          user: {
            id: user.id,
            email: user.email,
            full_name: resolvedFullName,
          },
        }
      );
    }

    throw new GoogleAuthFlowError('Tu cuenta está en revisión', 403, 'ACCOUNT_PENDING_APPROVAL', {
      requires_profile_completion: false,
      user: {
        id: user.id,
        email: user.email,
        full_name: resolvedFullName,
      },
    });
  }

  const session = await SessionService.createPersistentSession(user.id, deviceId, deviceInfo);

  const accessToken = generateAccessToken(user, String(session.sessionId), deviceId);

  await prisma.users.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  return {
    accessToken,
    refreshToken: session.refreshToken,
    sessionId: session.sessionId,
    deviceId,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.user_roles[0]?.roles?.name ?? null,
      is_master: user.is_master,
    },
  };
};

export const refreshAccessToken = async (
  refreshToken: string,
  deviceId: string,
  deviceMetadata?: { ip: string; userAgent: string }
) => {
  // Pasar metadatos del dispositivo para validación
  const result = await SessionService.verifyAndRefreshSession(
    refreshToken,
    deviceId,
    deviceMetadata
  );

  if (!result) {
    await SessionService.registerFailedRefreshAttempt(
      deviceId,
      'INVALID_OR_EXPIRED_REFRESH_TOKEN',
      deviceMetadata
    );
    throw new Error('Refresh token inválido o expirado');
  }

  const user = result.user;

  const accessToken = generateAccessToken(user, String(result.sessionId), deviceId);

  return {
    accessToken,
    refreshToken: result.newRefreshToken,
    sessionId: result.sessionId, // Retornar sessionId para CSRF binding
    access_token_expires_at: Date.now() + SECURITY_CONFIG.TOKEN_TTL.ACCESS_TOKEN_MS,
    user_uuid: user.id,
    User_data: {
      usr_uuid: user.id,
      usr_nombres: user.full_name,
      usr_email: user.email,
      usr_rol: user.user_roles[0]?.roles?.name ?? null,
      is_master: user.is_master,
    },
  };
};
