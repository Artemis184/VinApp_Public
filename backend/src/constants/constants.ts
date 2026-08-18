// =========================
// CONFIGURACIÓN DE SESIONES
// =========================
import crypto from 'crypto';
/**
 * Configuración de generación y manejo de tokens de sesión.
 *
 * - HASH_ALGORITHM: Algoritmo HMAC usado para hashear refresh tokens
 * - HASH_ENCODING: Formato de salida del hash
 * - REFRESH_TOKEN_BYTES: Longitud en bytes del refresh token generado
 * - REFRESH_TOKEN_EXPIRY_DAYS: Días de validez del refresh token
 * - DEVICE_ID_MIN_LENGTH: Longitud mínima válida para un device_id
 */
export const SESSION_CONFIG = {
  HASH_ALGORITHM: 'sha256',
  HASH_ENCODING: 'hex' as crypto.BinaryToTextEncoding,
  REFRESH_TOKEN_BYTES: 32,
  REFRESH_TOKEN_EXPIRY_DAYS: 36500,
  DEVICE_ID_MIN_LENGTH: 16,
};

/**
 * Configuración de limpieza automática de sesiones expiradas/revocadas.
 *
 * - REVOKED_SESSION_RETENTION_DAYS: Días que se mantienen sesiones revocadas
 *   antes de ser eliminadas permanentemente (registro de auditoría)
 */
export const SESSION_CLEANUP_CONFIG = {
  REVOKED_SESSION_RETENTION_DAYS: 30,
};

// =========================
// EVENTOS WEBSOCKET
// =========================

/**
 * Eventos de revocación de sesiones por WebSocket.
 *
 * Se utilizan para notificar a los clientes cuando sus sesiones
 * han sido revocadas, permitiendo que se desconecten de forma ordenada.
 *
 * - SESSION_REVOKED: Una sesión específica del usuario ha sido revocada
 */
export const WEBSOCKET_EVENTS = {
  SESSION_REVOKED: 'session_revoked',
};

/**
 * Razones de revocación de sesiones en eventos WebSocket.
 *
 * Se envían como metadata junto con el evento de revocación
 * para que el cliente entienda por qué fue revocada su sesión.
 */
export const SESSION_REVOCATION_REASONS = {
  SESSION_REVOKED: 'SESSION_REVOKED',
};

/**
 * Nombres globales de roles del sistema.
 */
export const ROLE_NAMES = {
  ADMIN: 'ADMIN',
  MASTER: 'MASTER',
  CLIENT: 'CLIENT',
} as const;

/**
 * Configuración de carga de archivos (uploads).
 */
export const UPLOAD_CONFIG = {
  BASE_DIR_NAME: 'uploads',
  AVATARS_DIR_NAME: 'avatars',
  AVATAR_FILE_PREFIX: 'avatar',
  DEFAULT_AVATAR_EXTENSION: '.jpg',
  AVATAR_FILE_RANDOM_MAX: 1e9,
  MAX_AVATAR_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  MAX_FILES_PER_REQUEST: 1,
  ALLOWED_AVATAR_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

export const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Configuración de seguridad para auth/sesiones.
 */
export const SECURITY_CONFIG = {
  HASH: {
    ALGORITHM: 'sha256',
    USER_AGENT_HASH_LENGTH: 16,
  },
  TOKEN_TTL: {
    ACCESS_TOKEN_EXPIRES_IN: '15m',
    ACCESS_TOKEN_MS: 15 * 60 * 1000,
    REFRESH_TOKEN_MS: 36500 * 24 * 60 * 60 * 1000,
    CSRF_TOKEN_SECONDS: 36500 * 24 * 60 * 60,
  },
  SESSION_ACTIVITY: {
    LAST_USED_UPDATE_INTERVAL_MS: 5 * 60 * 1000,
  },
} as const;
