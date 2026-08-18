//ESTE ARCHIVO CONTIENE CONSTANTES QUE NO SE PUEDEN DEJAR QUEMADO (HARDCORDEADO) EN EL CÓDIGO

export const APP_ROLES = {
  ADMIN: 'ADMIN',
  FINAL_USER: 'CLIENT',
  MASTER: 'MASTER',
};

export const APP_TOAST = {
  DURATION: 2000,
  POSITION: 'bottom' as 'top' | 'bottom' | 'middle',
};

export const APP_DEBOUNCE = {
  SEARCH_FILTER_MS: 300,
};

export const MENU_GENERAL_CONFIG = {
  DEFAULT_AVATAR_PATH: 'assets/img/default.png',
  AVATAR_MAX_SIZE_BYTES: 5 * 1024 * 1024,
  AVATAR_ACCEPT: 'image/png,image/jpeg,image/webp',
  AVATAR_ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  PASSWORD_MIN_LENGTH: 6,
  TOAST_DURATION_MS: 2000,
  PHONE_MAX_LENGTH: 10,
} as const;

/**
 * Almacenamiento y gestión de sesión.
 */
export const AUTH_STORAGE = {
  // Prefijo común para claves almacenadas
  SECURE_PREFIX: 'SECURE_',

  // Claves principales de sesión
  SESSION_DATA: 'SECURE_SESSION_DATA',
  ACCESS_TOKEN: 'SECURE_ACCESS_TOKEN',
  REFRESH_TOKEN: 'SECURE_REFRESH_TOKEN',
  USER_DATA: 'SECURE_USER_DATA',
  DEVICE_ID: 'SECURE_DEVICE_ID',

  // Clave de cifrado utilizada para protección de datos sensibles
  ENC_KEY_JWK: 'SECURE_ENC_KEY_JWK',

  // Claves legacy mantenidas por compatibilidad con versiones anteriores
  TOKEN: 'AUTH_TOKEN',
  USER: 'AUTH_USER',
  ROLE: 'AUTH_ROLE',
  IS_GOOGLE: 'AUTH_IS_GOOGLE',
};

/**
 * Nombres de cookie/header usados para autenticación web.
 * Deben coincidir con backend config (config.ts y authCookies.ts).
 */
export const AUTH_HTTP = {
  CSRF_COOKIE_NAME: 'vin_csrf_token',
  CSRF_HEADER_NAME: 'x-csrf-token',
} as const;

/**
 * Duración y mantenimiento de sesiones.
 */
export const SESSION_CONFIG = {
  // Duración máxima permitida para una sesión persistente
  MAX_SESSION_DURATION_MS: 36500 * 24 * 60 * 60 * 1000,

  // Fallbacks cuando el backend no envía expiración explícita
  ACCESS_TOKEN_FALLBACK_MS: 15 * 60 * 1000,
  REFRESH_TOKEN_FALLBACK_MS: 36500 * 24 * 60 * 60 * 1000,

  // Tiempo antes de expiración en el que se debe refrescar el token
  REFRESH_TOKEN_THRESHOLD_MS: 2 * 60 * 1000,

  // Intervalo para ejecutar tareas de limpieza de sesiones expiradas
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000,

  // Configuración de reintentos para refresh de token
  MAX_REFRESH_RETRY_ATTEMPTS: 3,
  REFRESH_RETRY_DELAY_MS: 1000,

  // Longitud mínima válida para un device id generado
  MIN_DEVICE_ID_LENGTH: 16,
};

/**
 * Traducción de acciones del sistema a descripciones legibles
 */
export const ACCION_TRADUCCION: { [key: string]: string } = {
  APPROVE_USER: 'Usuario Aprobado',
  CREATE_NODE: 'Nodo Creado',
  ASSIGN_NODE: 'Nodo Asignado',
  ENABLE_USER: 'Usuario Habilitado',
  ENABLE_NODE: 'Nodo Habilitado',
  REJECT_USER: 'Usuario Rechazado',
  SUSPEND_USER: 'Usuario Suspendido',
  SUSPEND_NODE: 'Nodo Suspendido',
  REVOKE_NODE: 'Nodo Revocado',
  UPDATE_NODE_DATA: 'Datos de Nodo Actualizados',
  UPDATE_USER_DATA: 'Datos de Usuario Actualizados',
  SIN_ACTIVIDAD: 'SIN ACTIVIDAD',
  'SIN ACTIVIDAD': 'SIN ACTIVIDAD', // Por si acaso el backend envía el espacio
};

/**
 * Estados de usuario disponibles en el sistema
 */
export const USUARIO_ESTADOS = [
  { label: 'APROBADO', value: 'APPROVED', color: 'success' },
  { label: 'SUSPENDIDO', value: 'SUSPENDED', color: 'danger' },
  { label: 'PENDIENTE', value: 'PENDING', color: 'warning' },
  { label: 'RECHAZADO', value: 'REJECTED', color: 'medium' },
] as const;

/**
 * Obtiene el color correspondiente a un estado de usuario
 */
export const getEstadoUsuarioColor = (estado: string): string => {
  const estadoConfig = USUARIO_ESTADOS.find((e) => e.value === estado);
  return estadoConfig?.color || 'medium';
};

/**
 * Traducción de valores técnicos a etiquetas legibles.
 */
export const VALORES_TRADUCCION: { [key: string]: string } = {
  PENDING: 'PENDIENTE',
  APPROVED: 'APROBADO',
  SUSPENDED: 'SUSPENDIDO',
  REJECTED: 'RECHAZADO',
  ACTIVE: 'ACTIVO',
  INACTIVE: 'INACTIVO',
  true: 'HABILITADO / SÍ',
  false: 'DESHABILITADO / NO',
  null: '---',
};

/**
 * Obtiene la etiqueta legible de un estado de usuario
 */
export const getEstadoTraducido = (estado: string): string => {
  return VALORES_TRADUCCION[estado] || estado;
};

/**
 * Traducción de claves utilizadas en metadata de auditoría.
 */
export const META_KEY_TRADUCCION: { [key: string]: string } = {
  valorAntes: 'Registro Anterior',
  valorDespues: 'Nuevo Registro',
  reason: 'Motivo',
  razon: 'Motivo',
  campo: 'Campo Modificado',
  field: 'Campo Modificado',
  usuarioAfectado: 'Usuario',
  nivelBateria: 'Nivel de Batería',
  ubicacion: 'Ubicación',
  phone: 'Teléfono',
  address: 'Dirección',
  full_name: 'Nombre Completo',
  status: 'Estado',
  is_enabled: 'Acceso Sistema',
  role: 'Rol Asignado',
  email: 'Correo Electrónico',
  last_maintenance: 'Último Mantenimiento',
  notes: 'Observaciones',
  is_active: 'Estado de Activación',
  node_status: 'Estado del Nodo',
  suspended: 'Suspensión',
};

/**
 * Acciones que representan estados positivos en el sistema.
 */
export const GREEN_STATUS_ACTIONS = [
  'APPROVE_USER',
  'CREATE_NODE',
  'ASSIGN_NODE',
  'ENABLE_USER',
  'ENABLE_NODE',
  'ALARM_ON',
];

/**
 * Acciones que representan estados negativos o restrictivos.
 */
export const RED_STATUS_ACTIONS = [
  'REJECT_USER',
  'SUSPEND_USER',
  'SUSPEND_NODE',
  'REVOKE_NODE',
  'ALARM_OFF',
];

/**
 * Valores por defecto para datos faltantes o nulos.
 */
export const FALLBACK_TRADUCCION = {
  NOMBRE: 'N/A',
  CODIGO: 'S/N',
  UBICACION: 'Sin ubicación registrada',
  ADMIN_DEMO: 'Administrador del Sistema',
  GENERICO: '---',
  SIN_OBSERVACIONES: 'Sin observaciones adicionales',
};

export const MODAL_ROLES = {
  CONFIRMADO: 'confirmado',
  CANCELAR: 'cancelar',
  CONFIRMAR: 'confirmar', // Usado en el detalle para la base de datos
} as const;
