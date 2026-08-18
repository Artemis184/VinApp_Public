import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, revoke_reason } from '@prisma/client';
import { config } from '../config';
import { SECURITY_CONFIG } from '../constants/constants';
import { SessionService } from '../services/session.service';
import { CsrfBindingManager } from '../services/csrfBinding.service';
import { ACCESS_TOKEN_COOKIE_NAME, getCookieValue } from '../utils/authCookies';
import { validateCsrfCookieAndHeader } from '../utils/csrfRequestValidation';
import { getRequestId } from '../utils/requestContext';

const prisma = new PrismaClient();

interface TokenPayload {
  user_uuid: string;
  email: string;
  role: string;
  is_master?: boolean;
  device_id?: string;
  session_id?: number;
  iat: number;
  exp: number;
}

type AuthStrategy = 'cookie' | 'bearer';

const isBrowserOriginRequest = (req: Request): boolean => {
  const origin = req.headers.origin;
  return typeof origin === 'string' && origin.trim().length > 0;
};

const resolveAuthStrategy = (
  req: Request
): {
  strategy: AuthStrategy | null;
  token: string | null;
} => {
  const cookieToken = getCookieValue(req, ACCESS_TOKEN_COOKIE_NAME);
  const header = req.headers.authorization;

  // En clientes web priorizamos cookie para forzar CSRF en métodos de estado.
  if (cookieToken) {
    return { strategy: 'cookie', token: cookieToken };
  }

  if (header) {
    const [type, bearerToken] = header.split(' ');

    if (type === 'Bearer' && bearerToken) {
      if (isBrowserOriginRequest(req) && !config.AUTH_ALLOW_BROWSER_BEARER) {
        return { strategy: null, token: null };
      }

      return { strategy: 'bearer', token: bearerToken };
    }
  }

  return { strategy: null, token: null };
};

const shouldValidateCsrf = (strategy: AuthStrategy | null, method: string): boolean => {
  if (strategy !== 'cookie') {
    return false;
  }

  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
};

const verifyJwtToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
};

const getActiveSession = async (sessionId: number, userUuid: string) => {
  return prisma.sessions.findFirst({
    where: {
      id: BigInt(sessionId),
      user_id: userUuid,
      is_revoked: false,
      expires_at: { gt: new Date() },
    },
  });
};

export const verifyToken = async (
  req: Request & { user?: TokenPayload },
  res: Response,
  next: NextFunction
) => {
  const requestId = getRequestId(req);
  const { strategy: authStrategy, token } = resolveAuthStrategy(req);

  if (!token) {
    console.warn(
      `[SECURITY] Missing auth token/cookie. method=${req.method} path=${req.path} ip=${req.ip} requestId=${requestId}`
    );
    return res.status(401).json({ message: 'Token requerido', requestId });
  }

  if (!config.JWT_SECRET) {
    console.error('JWT_SECRET no configurado');
    return res.status(500).json({ message: 'Error de configuración del servidor' });
  }

  // Verificar firma/expiración del JWT una sola vez y reutilizar payload
  let decoded: TokenPayload;
  try {
    decoded = verifyJwtToken(token);
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Token inválido',
        code: 'INVALID_TOKEN',
      });
    }

    console.error('Error en verificación de token', error.message);
    return res.status(401).json({
      message: 'Error de autenticación',
      code: 'AUTH_ERROR',
    });
  }

  // - strategy=cookie  => CSRF obligatorio en métodos de estado
  // - strategy=bearer  => CSRF NO aplica
  if (shouldValidateCsrf(authStrategy, req.method)) {
    const requestCsrfValidation = validateCsrfCookieAndHeader(req);

    if (!requestCsrfValidation.valid) {
      console.warn(
        `[SECURITY] CSRF validation failed: ${requestCsrfValidation.code}. method=${req.method} path=${req.path} ip=${req.ip} requestId=${requestId}`
      );
      return res.status(403).json({
        message: requestCsrfValidation.message,
        code: requestCsrfValidation.code,
        requestId,
      });
    }

    // Validar CSRF firmado y ligado a sesión/dispositivo.
    try {
      const sessionId = String(decoded.session_id);
      const deviceId = decoded.device_id;

      const csrfValidation = CsrfBindingManager.validateSignedCsrfToken(
        requestCsrfValidation.csrfHeader,
        sessionId,
        deviceId || 'unknown'
      );

      if (!csrfValidation.valid) {
        console.warn(
          `[SECURITY] CSRF validation failed: ${csrfValidation.reason}. method=${req.method} path=${req.path} ip=${req.ip} requestId=${requestId}`
        );
        return res.status(403).json({
          message: 'CSRF token inválido',
          code: 'CSRF_TOKEN_INVALID',
          reason: csrfValidation.reason,
          requestId,
        });
      }
    } catch (csrfError: any) {
      console.warn(
        `[SECURITY] CSRF validation error: ${csrfError.message}. method=${req.method} path=${req.path} requestId=${requestId}`
      );
      return res.status(403).json({
        message: 'CSRF validation error',
        code: 'CSRF_VALIDATION_ERROR',
        requestId,
      });
    }
  }

  try {
    // Controles de sesión (password change, revocación, expiración).

    // Validar por cambio de contraseña
    const user = await prisma.users.findUnique({
      where: { id: decoded.user_uuid },
      select: { password_changed_at: true },
    });

    if (user?.password_changed_at) {
      const tokenIssuedAt = new Date(decoded.iat * 1000);
      if (user.password_changed_at > tokenIssuedAt) {
        await SessionService.revokeAllUserSessions(
          decoded.user_uuid,
          revoke_reason.PASSWORD_CHANGED
        );
        return res.status(401).json({
          message: 'Sesión inválida. Inicia sesión nuevamente.',
        });
      }
    }

    // Validar sesión activa asociada al token
    if (decoded.session_id) {
      const activeSession = await getActiveSession(decoded.session_id, decoded.user_uuid);

      if (!activeSession) {
        return res.status(401).json({
          message: 'Sesión inválida o revocada. Inicia sesión nuevamente.',
        });
      }

      // Actualizar última actividad de forma periódica
      const updateActivityThreshold = new Date(
        Date.now() - SECURITY_CONFIG.SESSION_ACTIVITY.LAST_USED_UPDATE_INTERVAL_MS
      );

      if (!activeSession.last_used_at || activeSession.last_used_at < updateActivityThreshold) {
        await prisma.sessions.update({
          where: { id: activeSession.id },
          data: { last_used_at: new Date() },
        });
      }
    }

    // Exponer identidad validada para controladores/rutas posteriores
    req.user = decoded;
    next();
  } catch (error: any) {
    console.error('Error en verificación de token', error.message);

    return res.status(401).json({
      message: 'Error de autenticación',
      code: 'AUTH_ERROR',
    });
  }
};

export const verifyTokenSocket = async (token: string): Promise<TokenPayload | null> => {
  if (!config.JWT_SECRET) {
    console.error('Jwt secret no configurado');
    return null;
  }

  try {
    const decoded = verifyJwtToken(token);

    // Validar sesión activa para conexiones websocket
    if (decoded.session_id) {
      const activeSession = await getActiveSession(decoded.session_id, decoded.user_uuid);

      if (!activeSession) {
        return null;
      }
    }

    return decoded;
  } catch (error: any) {
    console.error('Error en verificación de token socket', error.message);
    return null;
  }
};
