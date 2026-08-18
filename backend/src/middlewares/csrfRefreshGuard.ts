import { NextFunction, Request, Response } from 'express';
import { CsrfBindingManager } from '../services/csrfBinding.service';
import { validateCsrfCookieAndHeader } from '../utils/csrfRequestValidation';
import { getRequestDeviceId, getRequestId } from '../utils/requestContext';

export const requireCsrfForRefresh = (req: Request, res: Response, next: NextFunction) => {
  const requestId = getRequestId(req);
  const requestCsrfValidation = validateCsrfCookieAndHeader(req);

  if (!requestCsrfValidation.valid) {
    return res.status(403).json({
      message: requestCsrfValidation.message,
      code: requestCsrfValidation.code,
      requestId,
    });
  }

  const validation = CsrfBindingManager.parseAndValidateSignedCsrfToken(
    requestCsrfValidation.csrfHeader
  );

  if (!validation.valid || !validation.payload) {
    return res.status(403).json({
      message: 'CSRF token inválido',
      code: 'CSRF_TOKEN_INVALID',
      reason: validation.reason,
      requestId,
    });
  }

  const requestDeviceId = getRequestDeviceId(req);
  if (typeof requestDeviceId === 'string' && requestDeviceId !== validation.payload.deviceId) {
    return res.status(403).json({
      message: 'CSRF token inválido',
      code: 'CSRF_DEVICE_MISMATCH',
      requestId,
    });
  }

  return next();
};
