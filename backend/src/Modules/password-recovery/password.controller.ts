import { Request, Response } from 'express';
import validator from 'validator';
import {
  generateResetCode,
  verifyResetCodeService,
  resetPasswordService,
} from './password.service';
import { logUserAudit } from '../../utils/auditLogger';

// Usar singleton global para Prisma
declare global {
  var passwordPrisma: any;
}

const getPrisma = () => {
  if (!global.passwordPrisma) {
    const { PrismaClient } = require('@prisma/client');
    global.passwordPrisma = new PrismaClient();
  }
  return global.passwordPrisma;
};

/* ======================
   SOLICITAR CÓDIGO
====================== */
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ message: 'Email inválido' });
  }

  const sent = await generateResetCode(email);

  if (!sent) {
    return res.status(404).json({
      message: 'No existe una cuenta asociada a este correo',
    });
  }

  return res.status(200).json({
    message: 'Código de recuperación enviado al correo',
  });
};

/* ======================
   VERIFICAR CÓDIGO
====================== */
export const verifyResetCode = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      message: 'Email y código son requeridos',
    });
  }

  const valid = await verifyResetCodeService(email, code);

  if (!valid) {
    return res.status(400).json({
      message: 'Código incorrecto o expirado',
    });
  }

  return res.status(200).json({ message: 'Código válido' });
};

/* ======================
   RESET CONTRASEÑA
====================== */
export const resetPassword = async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      message: 'La contraseña debe tener al menos 6 caracteres',
    });
  }

  const success = await resetPasswordService(email, code, newPassword);

  if (!success) {
    return res.status(400).json({
      message: 'Código inválido o expirado',
    });
  }

  // Auditar cambio de contraseña
  const prisma = getPrisma();
  const user = await prisma.users.findUnique({ where: { email } });
  if (user) {
    await logUserAudit(user.id, 'PASSWORD_CHANGED', req, {
      metadata: { email, timestamp: new Date().toISOString() },
    });
  }

  return res.status(200).json({
    message: 'Contraseña actualizada correctamente',
  });
};
