import { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config';
import { getRequestDeviceId, getRequestId } from '../utils/requestContext';

const createAuthLimiter = (maxRequests: number, routeLabel: string, includeDeviceId = false) =>
  rateLimit({
    windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const ipKey = ipKeyGenerator(req.ip || '0.0.0.0');
      if (!includeDeviceId) return ipKey;
      return `${ipKey}:${getRequestDeviceId(req) || 'unknown-device'}`;
    },
    handler: (req: Request, res: Response) => {
      const key = req.ip || 'unknown';
      const requestId = getRequestId(req);
      const deviceId = includeDeviceId ? getRequestDeviceId(req) || 'unknown-device' : 'n/a';
      console.warn(
        `[SECURITY] Rate limit exceeded on ${routeLabel} for key=${key}, deviceId=${deviceId}, requestId=${requestId}`
      );
      res.status(429).json({
        message: 'Demasiados intentos. Intenta de nuevo en unos segundos.',
        code: 'RATE_LIMIT_EXCEEDED',
        requestId,
      });
    },
  });

export const loginRateLimiter = createAuthLimiter(config.AUTH_LOGIN_RATE_LIMIT_MAX, '/login', true);

export const refreshRateLimiter = createAuthLimiter(
  config.AUTH_REFRESH_RATE_LIMIT_MAX,
  '/refresh',
  true
);
