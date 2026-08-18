import { Request } from 'express';

export interface JwtPayloadCustom {
  user_uuid: string;
  role?: string;
  is_master?: boolean;
}

export interface AuthRequest extends Request {
  user?: JwtPayloadCustom;
}
