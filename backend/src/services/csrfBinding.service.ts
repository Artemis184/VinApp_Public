import crypto from 'crypto';
import { config } from '../config';
import { SECURITY_CONFIG } from '../constants/constants';

interface SignedCsrfPayload {
  sessionId: string;
  deviceId: string;
  timestamp: number;
  nonce: string;
}

/**
 * Servicio de binding de CSRF
 * - CSRF token firmado (HMAC) que incluye: sessionId, deviceId, timestamp
 * - Se valida que el CSRF venga con el session_id correcto
 * - Previene reutilización desde otra sesión o dispositivo
 */
export class CsrfBindingManager {
  private static readonly CSRF_TTL_SECONDS = SECURITY_CONFIG.TOKEN_TTL.CSRF_TOKEN_SECONDS;

  private static getCsrfSignature(payloadStr: string): string {
    if (!config.HMAC_SECRET) {
      throw new Error('HMAC secret not configured');
    }

    return crypto
      .createHmac(SECURITY_CONFIG.HASH.ALGORITHM, config.HMAC_SECRET)
      .update(payloadStr)
      .digest('hex');
  }

  // Genera un CSRF token firmado y ligado a sesión
  static generateSignedCsrfToken(sessionId: string, deviceId: string): { token: string } {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString('hex');

    const payload = {
      sessionId,
      deviceId,
      timestamp,
      nonce,
    };

    // Crear token firmado
    const payloadStr = JSON.stringify(payload);
    const signature = this.getCsrfSignature(payloadStr);

    const tokenPayload = Buffer.from(payloadStr).toString('base64');
    const token = `${tokenPayload}.${signature}`;

    return {
      token,
    };
  }

  static parseAndValidateSignedCsrfToken(csrfToken: string): {
    valid: boolean;
    payload?: SignedCsrfPayload;
    reason?: string;
  } {
    try {
      const [payloadB64, receivedSignature] = csrfToken.split('.');

      if (!payloadB64 || !receivedSignature) {
        return { valid: false, reason: 'Invalid CSRF format' };
      }

      const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf-8');
      const payload = JSON.parse(payloadStr) as Partial<SignedCsrfPayload>;

      const expectedSignature = this.getCsrfSignature(payloadStr);

      const receivedBuffer = Buffer.from(receivedSignature, 'utf-8');
      const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

      if (
        receivedBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
      ) {
        return { valid: false, reason: 'Invalid CSRF signature' };
      }

      if (
        typeof payload.sessionId !== 'string' ||
        typeof payload.deviceId !== 'string' ||
        typeof payload.timestamp !== 'number' ||
        typeof payload.nonce !== 'string'
      ) {
        return { valid: false, reason: 'Invalid CSRF payload' };
      }

      const tokenAge = Math.floor(Date.now() / 1000) - payload.timestamp;
      if (tokenAge > this.CSRF_TTL_SECONDS) {
        return { valid: false, reason: 'CSRF token expired' };
      }

      return {
        valid: true,
        payload: {
          sessionId: payload.sessionId,
          deviceId: payload.deviceId,
          timestamp: payload.timestamp,
          nonce: payload.nonce,
        },
      };
    } catch (error: any) {
      return { valid: false, reason: `CSRF validation error: ${error.message}` };
    }
  }

  // Valida que el CSRF token tenga firma válida, no esté expirado, pertenezca a la sesión en cuestión
  static validateSignedCsrfToken(
    csrfToken: string,
    expectedSessionId: string,
    expectedDeviceId: string
  ): {
    valid: boolean;
    sessionId?: string;
    reason?: string;
  } {
    const validation = this.parseAndValidateSignedCsrfToken(csrfToken);

    if (!validation.valid || !validation.payload) {
      return { valid: false, reason: validation.reason || 'Invalid CSRF token' };
    }

    if (validation.payload.sessionId !== expectedSessionId) {
      return { valid: false, reason: 'CSRF sessionId mismatch' };
    }

    if (validation.payload.deviceId !== expectedDeviceId) {
      return { valid: false, reason: 'CSRF deviceId mismatch' };
    }

    return {
      valid: true,
      sessionId: validation.payload.sessionId,
    };
  }
}
