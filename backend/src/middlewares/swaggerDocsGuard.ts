import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';

function normalizeIp(ip?: string) {
  if (!ip) return '';
  // Express can return IPv6-mapped IPv4 like ::ffff:127.0.0.1
  if (ip.startsWith('::ffff:')) return ip.slice('::ffff:'.length);
  return ip;
}

function ipV4ToInt(ip: string) {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function matchesCidrV4(ip: string, cidr: string) {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (!base || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const ipInt = ipV4ToInt(ip);
  const baseInt = ipV4ToInt(base);
  if (ipInt === null || baseInt === null) return false;

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function isAllowedByIp(req: Request) {
  const raw = config.SWAGGER_DOCS_ALLOWED_IPS.trim();
  if (!raw) return true;

  const clientIp = normalizeIp(req.ip);
  const allowed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of allowed) {
    if (entry.includes('/')) {
      if (matchesCidrV4(clientIp, entry)) return true;
      continue;
    }

    if (normalizeIp(entry) === clientIp) return true;
  }

  return false;
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isAuthorizedBasic(req: Request) {
  const expectedUser = config.SWAGGER_DOCS_BASIC_USER;
  const expectedPass = config.SWAGGER_DOCS_BASIC_PASS;

  if (!expectedUser || !expectedPass) return false;

  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
  } catch {
    return false;
  }

  const sep = decoded.indexOf(':');
  if (sep === -1) return false;

  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);

  return safeEqual(user, expectedUser) && safeEqual(pass, expectedPass);
}

/**
 * Protege Swagger/OpenAPI en producción para evitar enumeración de endpoints.
 * - Por defecto en producción requiere Basic Auth (si está configurado).
 * - Opcionalmente limita por IP con SWAGGER_DOCS_ALLOWED_IPS (lista de IPs o CIDR IPv4).
 */
export function swaggerDocsGuard(req: Request, res: Response, next: NextFunction) {
  // En no producción (desarrollo) se permite mostrar sin restriccion.
  if (process.env.NODE_ENV !== 'production') return next();

  // Si el "protect" está apagado explícitamente, se deja pasar.
  if (!config.SWAGGER_DOCS_PROTECT) return next();

  res.setHeader('Cache-Control', 'no-store');

  if (!isAllowedByIp(req)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const basicConfigured = Boolean(config.SWAGGER_DOCS_BASIC_USER && config.SWAGGER_DOCS_BASIC_PASS);

  if (!basicConfigured) {
    return res.status(503).json({
      message: 'Swagger docs protected but not configured',
    });
  }

  if (!isAuthorizedBasic(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="API Docs"');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  return next();
}
