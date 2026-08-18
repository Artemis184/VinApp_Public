import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  getCookieValue,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../utils/authCookies';
import { getRequestId } from '../utils/requestContext';

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const normalizeOrigin = (value: string): string => value.trim().toLowerCase().replace(/\/$/, '');

const resolveOriginFromHeaders = (req: Request): string | null => {
  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string' && originHeader.trim().length > 0) {
    return originHeader;
  }

  const refererHeader = req.headers.referer;
  if (typeof refererHeader === 'string' && refererHeader.trim().length > 0) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      return null;
    }
  }

  return null;
};

const hasSessionCookie = (req: Request): boolean => {
  return (
    !!getCookieValue(req, ACCESS_TOKEN_COOKIE_NAME) ||
    !!getCookieValue(req, REFRESH_TOKEN_COOKIE_NAME)
  );
};

export const validateStateChangingOriginForSessionCookies = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!MUTATING_METHODS.includes(req.method.toUpperCase())) {
    return next();
  }

  if (!hasSessionCookie(req)) {
    return next();
  }

  const requestId = getRequestId(req);
  const requestOrigin = resolveOriginFromHeaders(req);

  if (!requestOrigin) {
    return res.status(403).json({
      message: 'Origen de solicitud ausente para operación con cookie de sesión',
      code: 'ORIGIN_REQUIRED',
      requestId,
    });
  }

  const allowedOrigins = new Set(config.CORS_ALLOWED_ORIGINS.map(normalizeOrigin));
  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);

  if (!allowedOrigins.has(normalizedRequestOrigin)) {
    return res.status(403).json({
      message: 'Origen de solicitud no permitido',
      code: 'ORIGIN_NOT_ALLOWED',
      requestId,
    });
  }

  return next();
};
