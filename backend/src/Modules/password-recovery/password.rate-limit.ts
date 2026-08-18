import type { NextFunction, Request, Response } from 'express';
import { VERIFY_PIN_RATE_LIMIT_MAX, VERIFY_PIN_RATE_LIMIT_WINDOW_MS } from './password.constants';

type Bucket = { count: number; resetAtMs: number };

const buckets = new Map<string, Bucket>();

const getClientIp = (req: Request) => {
  const xff = req.headers['x-forwarded-for'];
  const forwardedIp = typeof xff === 'string' ? xff.split(',')[0]?.trim() : undefined;
  return forwardedIp || req.ip || req.socket.remoteAddress || 'unknown';
};

const createIpRateLimiter = (opts: { windowMs: number; max: number; message: string }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = getClientIp(req);
    const now = Date.now();

    const existing = buckets.get(key);
    if (!existing || now >= existing.resetAtMs) {
      buckets.set(key, { count: 1, resetAtMs: now + opts.windowMs });
      return next();
    }

    if (existing.count >= opts.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ message: opts.message });
    }

    existing.count += 1;
    buckets.set(key, existing);
    return next();
  };
};

const lockoutMinutes = Math.round(VERIFY_PIN_RATE_LIMIT_WINDOW_MS / 60000);

export const verifyPinRateLimiter = createIpRateLimiter({
  windowMs: VERIFY_PIN_RATE_LIMIT_WINDOW_MS,
  max: VERIFY_PIN_RATE_LIMIT_MAX,
  message: `Demasiados intentos. Intenta de nuevo en ${lockoutMinutes} minutos.`,
});

export const resetPasswordRateLimiter = createIpRateLimiter({
  windowMs: VERIFY_PIN_RATE_LIMIT_WINDOW_MS,
  max: VERIFY_PIN_RATE_LIMIT_MAX,
  message: `Demasiados intentos. Intenta de nuevo en ${lockoutMinutes} minutos.`,
});
