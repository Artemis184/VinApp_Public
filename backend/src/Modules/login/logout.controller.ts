import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../../services/session.service';
import { forceDisconnect } from '../../index';

interface AuthRequest extends Request {
  user?: {
    user_uuid: string;
    device_id?: string;
    session_id?: number;
  };
}

export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.user_uuid;
    const sessionId = req.user?.session_id;
    const deviceId = req.user?.device_id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario no identificado',
      });
    }

    // Revocar sesión específica si existe
    if (sessionId) {
      try {
        await SessionService.revokeSessionById(BigInt(sessionId));
        forceDisconnect(userId, BigInt(sessionId));
      } catch {
        // La sesión puede no existir o ya estar revocada
      }
    }
    // Revocar sesiones asociadas al dispositivo
    else if (deviceId) {
      await SessionService.revokeDeviceSession(userId, deviceId);
      forceDisconnect(userId);
    }
    // Revocar todas las sesiones como último recurso
    else {
      await SessionService.revokeAllUserSessions(userId);
      forceDisconnect(userId);
    }

    next();
  } catch (error: any) {
    console.error('Error al cerrar sesión', error.message);

    return res.status(500).json({
      success: false,
      message: 'Error interno al cerrar sesión',
    });
  }
};
