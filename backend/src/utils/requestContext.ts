import { Request } from 'express';

export const getRequestId = (req: Request): string => {
  return (req as Request & { requestId?: string }).requestId || 'n/a';
};

export const getRequestDeviceId = (req: Request): string | null => {
  const body = req.body as Record<string, unknown> | undefined;
  const candidate = body?.deviceId || body?.device_id;

  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }

  return null;
};
