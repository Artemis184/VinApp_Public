import { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config';

export const globalRateLimiter = rateLimit({
  windowMs: config.GLOBAL_RATE_LIMIT_WINDOW_MS,
  max: config.GLOBAL_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip || '0.0.0.0'),
  skip: (req: Request) => req.path.startsWith('/api-docs'),
  handler: (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId || 'n/a';

    console.warn(
      `[SECURITY] Global rate limit exceeded for ip=${req.ip || 'unknown'} path=${req.path} method=${req.method} requestId=${requestId}`
    );

    res.status(429).json({
      message: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.',
      code: 'GLOBAL_RATE_LIMIT_EXCEEDED',
      requestId,
    });
  },
});
