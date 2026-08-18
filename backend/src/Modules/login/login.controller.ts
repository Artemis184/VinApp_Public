import { Request, Response, NextFunction } from 'express';
import { loginWithEmail, loginWithGoogle, refreshAccessToken } from './login.service';
import { AuthRequest } from '../../types/express';
import { PrismaClient } from '@prisma/client';
import { getCookieValue, REFRESH_TOKEN_COOKIE_NAME } from '../../utils/authCookies';
const prisma = new PrismaClient();

export const login = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password, deviceId, deviceInfo } = req.body;

  if (!email || !password || !deviceId) {
    return res.status(400).json({
      message: 'Email, password y deviceId son obligatorios',
    });
  }

  try {
    const result = await loginWithEmail(email, password, deviceId, deviceInfo);

    res.locals.loginResult = result;
    next();
  } catch (error: any) {
    return res.status(401).json({
      message: error.message || 'Credenciales inválidas',
    });
  }
};

export const loginGoogle = async (req: Request, res: Response, next: NextFunction) => {
  const { id_token, deviceId, deviceInfo } = req.body;

  if (!id_token || !deviceId) {
    return res.status(400).json({
      message: 'id_token y deviceId son obligatorios',
    });
  }

  try {
    const result = await loginWithGoogle(id_token, deviceId, deviceInfo);

    res.locals.loginResult = result;
    next();
  } catch (error: any) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 401;

    const responsePayload: Record<string, unknown> = {
      message: error?.message || 'Login con Google fallido',
    };

    if (error?.code) {
      responsePayload.code = error.code;
    }

    if (error?.details && typeof error.details === 'object') {
      Object.assign(responsePayload, error.details);
    }

    return res.status(statusCode).json(responsePayload);
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  const requestId = (req as Request & { requestId?: string }).requestId || 'n/a';
  const refreshToken = getCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);
  const deviceId = req.body?.deviceId || req.body?.device_id;

  if (!refreshToken || !deviceId) {
    return res.status(400).json({
      message: 'Cookie de refresh y deviceId son requeridos',
      requestId,
    });
  }

  try {
    const deviceMetadata = {
      ip: req.ip || '0.0.0.0',
      userAgent: req.headers['user-agent'] || 'Unknown',
    };

    const tokens = await refreshAccessToken(refreshToken, deviceId, deviceMetadata);
    return res.status(200).json(tokens);
  } catch (error: any) {
    return res.status(401).json({
      message: error.message || 'Refresh token inválido',
      requestId,
    });
  }
};

/**
 * Devuelve los datos del usuario autenticado (basado en el JWT)
 * GET /api/me
 */
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const payload = req.user;
    if (!payload || !payload.user_uuid) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    const user = await prisma.users.findUnique({ where: { id: payload.user_uuid } });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.status(200).json({
      usr_uuid: user.id,
      usr_nombres: user.full_name,
      usr_email: user.email,
      usr_rol: payload['role'] || null,
      is_master: user.is_master,
    });
  } catch (error) {
    console.error('[getMe] Error:', error);
    return res.status(500).json({ message: 'Error interno' });
  }
};
