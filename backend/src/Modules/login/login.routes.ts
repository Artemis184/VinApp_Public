import { Router } from 'express';
import { login, loginGoogle, getMe } from './login.controller';
import { logout } from './logout.controller';
import { verifyToken } from '../../middlewares/verifyToken';
import { userAudit } from '../../middlewares/auditoria/userAudit';
import { user_action_type } from '@prisma/client';
import { refreshAccessToken } from './login.service';
import { Request, Response } from 'express';
import {
  clearAuthCookies,
  getCookieValue,
  REFRESH_TOKEN_COOKIE_NAME,
  setAuthCookies,
} from '../../utils/authCookies';
import { loginRateLimiter, refreshRateLimiter } from '../../middlewares/authRateLimit';
import { requireJsonContentType } from '../../middlewares/requireJsonContentType';
import { requireCsrfForRefresh } from '../../middlewares/csrfRefreshGuard';
import { SECURITY_CONFIG } from '../../constants/constants';
import { getRequestDeviceId, getRequestId } from '../../utils/requestContext';

const router = Router();

const buildLoginResponse = (result: {
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_master: boolean;
  };
  accessToken?: string;
  csrfToken?: string;
}): {
  Login: boolean;
  access_token_expires_at: number;
  csrf_token?: string;
  user_uuid: string;
  User_data: {
    usr_uuid: string;
    usr_nombres: string;
    usr_email: string;
    usr_rol: string;
    is_master: boolean;
  };
} => ({
  Login: true,
  access_token_expires_at: Date.now() + SECURITY_CONFIG.TOKEN_TTL.ACCESS_TOKEN_MS,
  csrf_token: result.csrfToken,
  user_uuid: result.user.id,
  User_data: {
    usr_uuid: result.user.id,
    usr_nombres: result.user.full_name,
    usr_email: result.user.email,
    usr_rol: result.user.role,
    is_master: result.user.is_master,
  },
});

// LOGIN
router.post(
  '/login',
  // #swagger.tags = ['Login']
  // #swagger.description = 'Endpoint para autenticar usuarios'
  requireJsonContentType,
  loginRateLimiter,
  login,
  userAudit({
    action: user_action_type.LOGIN,
    getMetadata: (req) => ({
      email: req.body.email,
      has_device_id: !!req.body.deviceId,
    }),
  }),
  (req, res) => {
    const result = res.locals.loginResult;

    // Pasar sessionId y deviceId a setAuthCookies for CSRF binding
    const csrfToken = setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      String(result.sessionId),
      result.deviceId
    );

    res.status(200).json(buildLoginResponse({ ...result, csrfToken }));
  }
);

router.post(
  '/refresh',
  // #swagger.tags = ['Login']
  // #swagger.description = 'Obtener nuevo access token usando cookie HttpOnly de refresh y deviceId. Validación de metadatos del dispositivo.'
  requireJsonContentType,
  refreshRateLimiter,
  requireCsrfForRefresh,
  async (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const refreshToken = getCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);
    const deviceId = getRequestDeviceId(req);

    if (!refreshToken || !deviceId) {
      console.warn(
        `[SECURITY] Refresh rejected: missing refresh cookie or deviceId. ip=${req.ip}, hasCookie=${!!refreshToken}, hasDeviceId=${!!deviceId}, requestId=${requestId}`
      );
      return res.status(400).json({
        message: 'Cookie de refresh y deviceId son requeridos',
        requestId,
      });
    }

    try {
      // Pasar metadatos del dispositivo a verificación
      const deviceMetadata = {
        ip: req.ip || '0.0.0.0',
        userAgent: req.headers['user-agent'] || 'Unknown',
      };

      const tokens = await refreshAccessToken(refreshToken, deviceId, deviceMetadata);

      // CSRF binding con nueva sesión
      const csrfToken = setAuthCookies(
        res,
        tokens.accessToken,
        tokens.refreshToken,
        String(tokens.sessionId),
        deviceId
      );

      res.status(200).json({
        Login: true,
        access_token_expires_at: tokens.access_token_expires_at,
        csrf_token: csrfToken,
        user_uuid: tokens.user_uuid,
        User_data: tokens.User_data,
      });
    } catch (error: any) {
      console.warn(
        `[SECURITY] Invalid refresh attempt. ip=${req.ip}, deviceId=${String(deviceId)} error=${error?.message || 'unknown'}, requestId=${requestId}`
      );
      return res.status(401).json({
        message: error.message || 'Refresh token inválido',
        requestId,
      });
    }
  }
);

router.post(
  '/login/google',
  // #swagger.tags = ['Login']
  // #swagger.description = 'Iniciar sesión o registrarse con Google OAuth'
  requireJsonContentType,
  loginGoogle,
  userAudit({
    action: user_action_type.LOGIN,
    getMetadata: (req) => ({
      google_auth: true,
      has_device_id: !!req.body.deviceId,
    }),
  }),
  (req, res) => {
    const result = res.locals.loginResult;
    // Incluir sessionId y deviceId en CSRF binding
    const csrfToken = setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      String(result.sessionId),
      result.deviceId
    );

    res.status(200).json(buildLoginResponse({ ...result, csrfToken }));
  }
);

// LOGOUT
router.post(
  '/logout',
  // #swagger.tags = ['Login']
  // #swagger.description = 'Endpoint para cerrar sesión'
  verifyToken,
  logout,
  userAudit({
    action: user_action_type.LOGOUT,
  }),
  (req, res) => {
    clearAuthCookies(res);
    res.status(200).json({ success: true, message: 'Sesión cerrada exitosamente' });
  }
);
// ME - información del usuario autenticado
router.get('/me', verifyToken, (req, res) => getMe(req as any, res));
export default router;
