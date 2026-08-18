/**
 * Estructura de datos de sesión almacenada localmente.
 */
export interface SessionData {
  // Identificación del usuario autenticado
  user_uuid: string;
  email: string;
  full_name: string;
  role: string;
  is_master?: boolean;

  // Información del dispositivo asociado a la sesión
  device_id: string;
  device_info?: Record<string, unknown>;

  // Fechas de expiración expresadas en timestamp en milisegundos
  access_token_expires_at: number;
  refresh_token_expires_at: number;

  // CSRF firmado emitido por el backend para rehidratar la cookie nativa
  csrf_token?: string;

  // Datos de auditoría local
  created_at: number;
  last_activity_at: number;
}

/**
 * Respuesta devuelta por el backend al realizar login.
 */
export interface LoginResponse {
  Login: boolean;
  access_token_expires_at?: number;
  session_expires_at?: string;
  csrf_token?: string;
  user_uuid: string;
  User_data: {
    usr_uuid: string;
    usr_nombres: string;
    usr_email: string;
    usr_rol: string;
    is_master?: boolean;
  };
}

/**
 * Respuesta devuelta por el backend al refrescar el access token.
 */
export interface RefreshTokenResponse {
  Login: boolean;

  // Timestamp en milisegundos enviado por el backend
  access_token_expires_at: number;
  csrf_token?: string;

  user_uuid: string;
  User_data?: {
    usr_uuid: string;
    usr_nombres: string;
    usr_email: string;
    usr_rol: string;
    is_master?: boolean;
  };
}

/**
 * Información del usuario expuesta al resto de la aplicación.
 * No contiene tokens ni datos sensibles de sesión.
 */
export interface UserData {
  uuid: string;
  email: string;
  full_name: string;
  role: string;
  is_master?: boolean;
}
