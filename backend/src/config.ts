import dotenv from 'dotenv';
dotenv.config();

const parseAllowedOrigins = (rawOrigins: string | undefined): string[] => {
  if (!rawOrigins || !rawOrigins.trim()) {
    return [];
  }

  const parsedOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return parsedOrigins;
};

const DEFAULT_DEV_CORS_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4200',
  'http://localhost:8100',
];

const CAPACITOR_CORS_ALLOWED_ORIGINS = [
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
];

const dedupeOrigins = (origins: string[]): string[] => [...new Set(origins)];

const resolveCorsAllowedOrigins = (rawOrigins: string | undefined, nodeEnv: string): string[] => {
  const configuredOrigins = parseAllowedOrigins(rawOrigins);

  if (configuredOrigins.length > 0) {
    return dedupeOrigins([...configuredOrigins, ...CAPACITOR_CORS_ALLOWED_ORIGINS]);
  }

  if (nodeEnv === 'development') {
    return dedupeOrigins([...DEFAULT_DEV_CORS_ALLOWED_ORIGINS, ...CAPACITOR_CORS_ALLOWED_ORIGINS]);
  }

  return [];
};

const NODE_ENV = process.env.NODE_ENV || 'development';

export const config = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  ARDUINO_API_KEY: process.env.ARDUINO_API_KEY || '',
  ENABLE_HEARTBEAT: process.env.ENABLE_HEARTBEAT !== 'false',
  HEARTBEAT_INTERVAL_MS: Number(process.env.HEARTBEAT_INTERVAL_MS) || 60_000,

  // HMAC Secret para hashear refresh tokens
  HMAC_SECRET: (process.env.HMAC_SECRET || '').trim(),

  // Swagger / OpenAPI docs (recomendado: restringir en producción)
  SWAGGER_DOCS_PROTECT:
    process.env.SWAGGER_DOCS_PROTECT === undefined
      ? NODE_ENV === 'production'
      : process.env.SWAGGER_DOCS_PROTECT !== 'false',
  SWAGGER_DOCS_BASIC_USER: process.env.SWAGGER_DOCS_BASIC_USER || '',
  SWAGGER_DOCS_BASIC_PASS: process.env.SWAGGER_DOCS_BASIC_PASS || '',
  SWAGGER_DOCS_ALLOWED_IPS: process.env.SWAGGER_DOCS_ALLOWED_IPS || '',

  // Email configuration
  GMAIL: process.env.GOOGLE_EMAIL || '',
  GMAIL_CLIENT_ID: process.env.GOOGLE_CLIENT_ID_EMAIL || '',
  GMAIL_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET_EMAIL || '',
  GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN || '',
  CORREO_ADMINISTRACION: process.env.CORREO_ADMINISTRACION || '',
  GMAIL_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI_EMAIL || '',

  // Cookie auth configuration
  ACCESS_TOKEN_COOKIE_NAME: process.env.ACCESS_TOKEN_COOKIE_NAME || 'vin_access_token',
  REFRESH_TOKEN_COOKIE_NAME: process.env.REFRESH_TOKEN_COOKIE_NAME || 'vin_refresh_token',
  AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN || '',
  AUTH_COOKIE_SAMESITE: process.env.AUTH_COOKIE_SAMESITE || 'lax',
  AUTH_COOKIE_SECURE:
    process.env.AUTH_COOKIE_SECURE === undefined
      ? NODE_ENV === 'production'
      : process.env.AUTH_COOKIE_SECURE === 'true',
  AUTH_COOKIE_PRIORITY: process.env.AUTH_COOKIE_PRIORITY || 'high',
  AUTH_ALLOW_BROWSER_BEARER: process.env.AUTH_ALLOW_BROWSER_BEARER === 'true',
  CSRF_COOKIE_NAME: process.env.CSRF_COOKIE_NAME || 'vin_csrf_token',
  CSRF_HEADER_NAME: process.env.CSRF_HEADER_NAME || 'x-csrf-token',
  AUTH_RATE_LIMIT_WINDOW_MS: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 60_000,
  AUTH_LOGIN_RATE_LIMIT_MAX: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX) || 8,
  AUTH_REFRESH_RATE_LIMIT_MAX: Number(process.env.AUTH_REFRESH_RATE_LIMIT_MAX) || 10,
  GLOBAL_RATE_LIMIT_WINDOW_MS: Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS) || 60_000,
  GLOBAL_RATE_LIMIT_MAX: Number(process.env.GLOBAL_RATE_LIMIT_MAX) || 300,
  BODY_JSON_LIMIT: process.env.BODY_JSON_LIMIT || '5mb',
  BODY_URLENCODED_LIMIT: process.env.BODY_URLENCODED_LIMIT || '5mb',
  CORS_ALLOWED_ORIGINS: resolveCorsAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS, NODE_ENV),

  // API
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
};

const requiredEnvVarsForAuth = ['JWT_SECRET', 'HMAC_SECRET'] as const;

if (config.NODE_ENV !== 'test') {
  const missingEnvVars = requiredEnvVarsForAuth.filter((envVar) => !config[envVar]);

  if (missingEnvVars.length > 0) {
    throw new Error(
      `[config] Missing required environment variable(s): ${missingEnvVars.join(', ')}. ` +
        'Define them before starting the backend to avoid auth/CSRF runtime failures.'
    );
  }

  if (config.NODE_ENV !== 'development' && config.CORS_ALLOWED_ORIGINS.length === 0) {
    throw new Error(
      `[config] CORS_ALLOWED_ORIGINS is required when NODE_ENV=${config.NODE_ENV}. ` +
        'Define a comma-separated allowlist of trusted origins before starting the backend.'
    );
  }
}
