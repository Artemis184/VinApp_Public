import { NextFunction, Request, Response } from 'express';

export const requireJsonContentType = (req: Request, res: Response, next: NextFunction) => {
  const isJson = req.is('application/json') || req.is('application/*+json');

  if (isJson) {
    return next();
  }

  const requestId = (req as Request & { requestId?: string }).requestId || 'n/a';

  return res.status(415).json({
    message: 'Unsupported Media Type. Se requiere application/json',
    code: 'UNSUPPORTED_MEDIA_TYPE',
    requestId,
  });
};
