import { Request } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, getCookieValue } from './authCookies';

const TRUSTED_NATIVE_ORIGINS = new Set([
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
]);

const normalizeOrigin = (value: string): string => value.trim().toLowerCase().replace(/\/$/, '');

const isTrustedNativeOrigin = (req: Request): boolean => {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || !origin.trim()) {
    return false;
  }

  return TRUSTED_NATIVE_ORIGINS.has(normalizeOrigin(origin));
};

const resolveHeaderValue = (value: string | string[] | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value;
};

export const validateCsrfCookieAndHeader = (
  req: Request
):
  | { valid: true; csrfHeader: string }
  | { valid: false; code: 'CSRF_TOKEN_INVALID' | 'CSRF_TOKEN_MISMATCH'; message: string } => {
  const csrfCookie = getCookieValue(req, CSRF_COOKIE_NAME);
  const csrfHeader = resolveHeaderValue(req.headers[CSRF_HEADER_NAME]);

  if (!csrfCookie || !csrfHeader) {
    if (csrfHeader && isTrustedNativeOrigin(req)) {
      return {
        valid: true,
        csrfHeader,
      };
    }

    return {
      valid: false,
      message: 'CSRF token inválido o ausente',
      code: 'CSRF_TOKEN_INVALID',
    };
  }

  if (csrfCookie !== csrfHeader) {
    return {
      valid: false,
      message: 'CSRF token inválido',
      code: 'CSRF_TOKEN_MISMATCH',
    };
  }

  return {
    valid: true,
    csrfHeader,
  };
};
