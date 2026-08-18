import { CookieOptions, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { SECURITY_CONFIG } from '../constants/constants';
import { CsrfBindingManager } from '../services/csrfBinding.service';

const ACCESS_TOKEN_TTL_MS = SECURITY_CONFIG.TOKEN_TTL.ACCESS_TOKEN_MS;
const REFRESH_TOKEN_TTL_MS = SECURITY_CONFIG.TOKEN_TTL.REFRESH_TOKEN_MS;
const CSRF_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_MS;

export const ACCESS_TOKEN_COOKIE_NAME = config.ACCESS_TOKEN_COOKIE_NAME;
export const REFRESH_TOKEN_COOKIE_NAME = config.REFRESH_TOKEN_COOKIE_NAME;
export const CSRF_COOKIE_NAME = config.CSRF_COOKIE_NAME;
export const CSRF_HEADER_NAME = config.CSRF_HEADER_NAME.toLowerCase();

const getCookiePriority = (): 'low' | 'medium' | 'high' => {
  const value = (config.AUTH_COOKIE_PRIORITY || 'high').toLowerCase();
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return 'high';
};

const getSameSite = (): 'lax' | 'strict' | 'none' => {
  const value = (config.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase();
  if (value === 'strict' || value === 'none' || value === 'lax') {
    return value;
  }
  return 'lax';
};

const isSecureCookie = (): boolean => {
  if (getSameSite() === 'none') {
    return true;
  }

  return config.AUTH_COOKIE_SECURE;
};

const deriveSharedCookieDomainFromOrigins = (): string | undefined => {
  const configuredDomain = (config.AUTH_COOKIE_DOMAIN || '').trim();
  if (configuredDomain) {
    return configuredDomain;
  }

  for (const origin of config.CORS_ALLOWED_ORIGINS) {
    try {
      const hostname = new URL(origin).hostname.toLowerCase();

      // localhost/IP no son válidos para un dominio compartido útil.
      if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        continue;
      }

      const labels = hostname.split('.').filter(Boolean);
      if (labels.length < 2) {
        continue;
      }

      return `.${labels.slice(-2).join('.')}`;
    } catch {
      continue;
    }
  }

  return undefined;
};

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isSecureCookie(),
  sameSite: getSameSite(),
  domain: config.AUTH_COOKIE_DOMAIN || undefined,
  priority: getCookiePriority(),
});

const csrfCookieOptions = (): CookieOptions => ({
  httpOnly: false,
  secure: true,
  sameSite: 'none',
  domain: deriveSharedCookieDomainFromOrigins(),
  priority: getCookiePriority(),
});

/**
 * Genera CSRF token con binding a sessionId y deviceId
 * El cliente recibe el token y debe incluirlo en X-CSRF-Token
 * El servidor valida la firma y vinculación
 */
export const setCsrfCookie = (res: Response, sessionId?: string, deviceId?: string): string => {
  // Si tenemos sessionId y deviceId, usar tokens firmados
  if (sessionId && deviceId) {
    const { token } = CsrfBindingManager.generateSignedCsrfToken(sessionId, deviceId);

    res.cookie(CSRF_COOKIE_NAME, token, {
      ...csrfCookieOptions(),
      maxAge: CSRF_TOKEN_TTL_MS,
      path: '/',
    });

    return token;
  }

  // Token simple (para compatibilidad)
  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    ...csrfCookieOptions(),
    maxAge: CSRF_TOKEN_TTL_MS,
    path: '/',
  });

  return csrfToken;
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
  sessionId?: string,
  deviceId?: string
) => {
  res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
    ...baseCookieOptions(),
    maxAge: ACCESS_TOKEN_TTL_MS,
    path: '/',
  });

  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...baseCookieOptions(),
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/',
  });

  return setCsrfCookie(res, sessionId, deviceId);
};

export const clearAuthCookies = (res: Response) => {
  const options = baseCookieOptions();

  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
    ...options,
    path: '/',
  });

  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    ...options,
    path: '/',
  });

  res.clearCookie(CSRF_COOKIE_NAME, {
    ...csrfCookieOptions(),
    path: '/',
  });
};

export const getCookieValue = (req: Request, name: string): string | null => {
  const parsedCookies = req.cookies as Record<string, string> | undefined;
  if (parsedCookies && parsedCookies[name]) {
    return parsedCookies[name];
  }

  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split('=');
    if (key === name) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
};

export const getCookieValueFromHeader = (
  cookieHeader: string | undefined,
  name: string
): string | null => {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split('=');
    if (key === name) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
};
