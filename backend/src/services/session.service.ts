import { Prisma, PrismaClient, revoke_reason } from '@prisma/client';
import crypto from 'crypto';
import { config } from '../config';
import { SESSION_CONFIG, SESSION_CLEANUP_CONFIG } from '../constants/constants';

const prisma = new PrismaClient();

export class SessionService {
  // Single source of truth for session/device refresh validation and anomaly tracking.
  // =========================
  // Helpers internos
  // =========================
  private static hashRefreshToken(refreshToken: string): string {
    return crypto
      .createHmac(SESSION_CONFIG.HASH_ALGORITHM, config.HMAC_SECRET)
      .update(refreshToken)
      .digest(SESSION_CONFIG.HASH_ENCODING);
  }

  private static generateRefreshToken(): string {
    return crypto
      .randomBytes(SESSION_CONFIG.REFRESH_TOKEN_BYTES)
      .toString(SESSION_CONFIG.HASH_ENCODING);
  }

  private static isValidDeviceId(deviceId: string): boolean {
    return typeof deviceId === 'string' && deviceId.length >= SESSION_CONFIG.DEVICE_ID_MIN_LENGTH;
  }

  private static getRefreshTokenExpiry(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS);
    return expiresAt;
  }

  // =========================
  // Creación de sesión
  // =========================

  static async createPersistentSession(
    userId: string,
    deviceId: string,
    deviceInfo: Record<string, unknown> = {}
  ) {
    if (!this.isValidDeviceId(deviceId)) {
      throw new Error('deviceId inválido');
    }

    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = this.getRefreshTokenExpiry();

    // Revocar sesiones activas previas del mismo dispositivo
    await prisma.sessions.updateMany({
      where: {
        user_id: userId,
        device_id: deviceId,
        is_revoked: false,
        expires_at: { gt: new Date() },
      },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
        revoke_reason: revoke_reason.MANUAL,
      },
    });

    const session = await prisma.sessions.create({
      data: {
        user_id: userId,
        device_id: deviceId,
        device_info: (deviceInfo ?? null) as Prisma.InputJsonValue,
        refresh_token_hash: refreshTokenHash,
        expires_at: expiresAt,
      },
    });

    return {
      refreshToken,
      sessionId: session.id,
      expiresAt,
    };
  }

  // =========================
  // Refresh de sesión (CON VALIDACIÓN DE DISPOSITIVO)
  // =========================

  // Verifica y refresca sesión CON validación de metadatos del dispositivo
  static async verifyAndRefreshSession(
    refreshToken: string,
    deviceId: string,
    deviceMetadata?: { ip: string; userAgent: string }
  ) {
    if (!this.isValidDeviceId(deviceId)) return null;

    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const session = await prisma.sessions.findFirst({
      where: {
        refresh_token_hash: refreshTokenHash,
        device_id: deviceId,
        is_revoked: false,
        expires_at: { gt: new Date() },
      },
      include: {
        users: {
          include: {
            user_roles: {
              include: { roles: true },
            },
          },
        },
      },
    });

    if (!session) return null;

    // Validar metadatos del dispositivo
    if (deviceMetadata) {
      const storedDeviceInfo = session.device_info as any;

      const validation = await this.validateDeviceMetadata(
        deviceMetadata,
        storedDeviceInfo,
        session.id
      );

      if (!validation.valid) {
        return null; // Rechazar refresh
      }

      // Registrar cambios (IP change, etc)
      if (validation.anomalies.length > 0) {
        console.warn(
          `[SECURITY] Device anomalies detected on refresh. sessionId=${session.id} anomalies=${validation.anomalies.join(',')}`
        );
        // Actualizar device_info con anomalías detectadas
        await this.updateDeviceInfoWithAnomalies(session.id, validation.anomalies, deviceMetadata);
      }
    }

    const newRefreshToken = this.generateRefreshToken();
    const newRefreshTokenHash = this.hashRefreshToken(newRefreshToken);

    await prisma.sessions.update({
      where: { id: session.id },
      data: {
        refresh_token_hash: newRefreshTokenHash,
        last_used_at: new Date(),
        device_info: {
          ...(session.device_info as any),
          failedRefreshAttempts: 0,
          lastRefreshAt: new Date().toISOString(),
          ip: deviceMetadata?.ip || (session.device_info as any)?.ip,
        },
      },
    });

    return {
      newRefreshToken,
      sessionId: session.id,
      user: session.users,
    };
  }

  static async registerFailedRefreshAttempt(
    deviceId: string,
    reason: string,
    deviceMetadata?: { ip: string; userAgent: string }
  ): Promise<{ sessionId?: bigint; attempts: number; revoked: boolean }> {
    const session = await prisma.sessions.findFirst({
      where: {
        device_id: deviceId,
        is_revoked: false,
        expires_at: { gt: new Date() },
      },
      orderBy: {
        last_used_at: 'desc',
      },
    });

    if (!session) {
      return { attempts: 0, revoked: false };
    }

    const currentInfo = (session.device_info as any) || {};
    const attempts = (currentInfo.failedRefreshAttempts || 0) + 1;

    const anomalies: string[] = ['invalid_refresh_attempt'];
    if (deviceMetadata?.ip && currentInfo.ip && currentInfo.ip !== deviceMetadata.ip) {
      anomalies.push('ip_changed_on_failed_refresh');
    }
    if (
      deviceMetadata?.userAgent &&
      currentInfo.userAgent &&
      currentInfo.userAgent !== deviceMetadata.userAgent
    ) {
      anomalies.push('user_agent_changed_on_failed_refresh');
    }

    const nextInfo: Prisma.InputJsonValue = {
      ...currentInfo,
      failedRefreshAttempts: attempts,
      lastFailureAt: new Date().toISOString(),
      lastFailureReason: reason,
      anomalyFlags: [...(currentInfo.anomalyFlags || []), ...anomalies].slice(-20),
    };

    const shouldRevoke = attempts >= 5;

    await prisma.sessions.update({
      where: { id: session.id },
      data: {
        device_info: nextInfo,
        ...(shouldRevoke
          ? {
              is_revoked: true,
              revoked_at: new Date(),
              revoke_reason: revoke_reason.COMPROMISED,
            }
          : {}),
      },
    });

    if (shouldRevoke) {
      console.warn(
        `[SECURITY] Session revoked after repeated failed refresh attempts. sessionId=${session.id} deviceId=${deviceId} attempts=${attempts}`
      );
    }

    return { sessionId: session.id, attempts, revoked: shouldRevoke };
  }

  // Valida que metadatos del dispositivo sean consistentes
  private static async validateDeviceMetadata(
    current: { ip: string; userAgent: string },
    stored: any,
    sessionId: bigint
  ): Promise<{
    valid: boolean;
    anomalies: string[];
  }> {
    if (!stored) {
      return { valid: true, anomalies: [] };
    }

    const anomalies: string[] = [];

    // Detectar cambios de IP
    if (stored.ip && current.ip !== stored.ip) {
      anomalies.push('ip_changed');

      // Penalizar cambios rápidos de IP
      const ipHistory = stored.ipChangeHistory || [];
      const recentIpChanges = ipHistory.filter(
        (change: any) => Date.now() - new Date(change.timestamp).getTime() < 10 * 60 * 1000 // 10 minutos
      );

      if (recentIpChanges.length >= 3) {
        anomalies.push('rapid_ip_changes_detected');
        console.warn(
          `[SECURITY] Rapid IP changes detected. sessionId=${sessionId} changes=${recentIpChanges.length}`
        );
      }
    }

    // Detectar cambios de userAgent
    if (stored.userAgent && current.userAgent !== stored.userAgent) {
      anomalies.push('user_agent_changed');
    }

    // Validar intentos fallidos previos
    const failedAttempts = stored.failedRefreshAttempts || 0;
    if (failedAttempts >= 5) {
      return {
        valid: false,
        anomalies: ['max_failed_attempts_exceeded'],
      };
    }

    return { valid: true, anomalies };
  }

  // Actualiza device_info con anomalías detectadas
  private static async updateDeviceInfoWithAnomalies(
    sessionId: bigint,
    anomalies: string[],
    currentMetadata: { ip: string; userAgent: string }
  ): Promise<void> {
    const session = await prisma.sessions.findUnique({
      where: { id: sessionId },
    });

    if (!session) return;

    const deviceInfo = session.device_info as any;
    const ipHistory = deviceInfo?.ipChangeHistory || [];

    // Agregar cambio de IP al histórico si aplica
    if (anomalies.includes('ip_changed') && currentMetadata.ip) {
      ipHistory.push({
        ip: currentMetadata.ip,
        timestamp: new Date().toISOString(),
      });

      // Mantener últimos 20
      ipHistory.splice(0, Math.max(0, ipHistory.length - 20));
    }

    await prisma.sessions.update({
      where: { id: sessionId },
      data: {
        device_info: {
          ...deviceInfo,
          anomalyFlags: [...(deviceInfo?.anomalyFlags || []), ...anomalies].slice(-10),
          ipChangeHistory: ipHistory,
          lastAnomalyDetectedAt: new Date().toISOString(),
        },
      },
    });
  }

  // =========================
  // Revocación
  // =========================

  static async revokeSessionById(sessionId: bigint) {
    return prisma.sessions.update({
      where: { id: sessionId },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
        revoke_reason: revoke_reason.LOGOUT,
      },
    });
  }

  static async revokeDeviceSession(userId: string, deviceId: string): Promise<boolean> {
    const result = await prisma.sessions.updateMany({
      where: {
        user_id: userId,
        device_id: deviceId,
        is_revoked: false,
      },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
        revoke_reason: revoke_reason.LOGOUT,
      },
    });

    return result.count > 0;
  }

  static async revokeAllUserSessions(userId: string, reason: revoke_reason = revoke_reason.LOGOUT) {
    return prisma.sessions.updateMany({
      where: {
        user_id: userId,
        is_revoked: false,
      },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
        revoke_reason: reason,
      },
    });
  }

  // =========================
  // Limpieza
  // =========================

  static async cleanupExpiredSessions(): Promise<number> {
    const expired = await prisma.sessions.updateMany({
      where: {
        expires_at: { lt: new Date() },
        is_revoked: false,
      },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
        revoke_reason: revoke_reason.EXPIRED,
      },
    });

    const thirtyDaysAgo = new Date(
      Date.now() - SESSION_CLEANUP_CONFIG.REVOKED_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    await prisma.sessions.deleteMany({
      where: {
        is_revoked: true,
        revoked_at: { lt: thirtyDaysAgo },
      },
    });

    return expired.count;
  }
}
