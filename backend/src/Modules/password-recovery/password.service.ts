import { PrismaClient, revoke_reason } from '@prisma/client';
import bcrypt from 'bcrypt';
import { sendPasswordResetEmail } from '../password-recovery/password.email';
import {
  CODE_EXPIRATION_MINUTES,
  MAX_PIN_ATTEMPTS,
  PIN_LOCK_DURATION_MINUTES,
} from './password.constants';
import { SessionService } from '../../services/session.service';

const prisma = new PrismaClient();

type LockState = { failedAttempts: number; lockedUntilMs: number };
const lockByUserId = new Map<string, LockState>();

const isLocked = (userId: string) => {
  const state = lockByUserId.get(userId);
  if (!state) return false;

  if (Date.now() >= state.lockedUntilMs) {
    lockByUserId.delete(userId);
    return false;
  }

  return true;
};

const registerFailedAttempt = (userId: string) => {
  const now = Date.now();
  const current = lockByUserId.get(userId) ?? { failedAttempts: 0, lockedUntilMs: 0 };

  // If already locked, keep the lock window intact.
  if (now < current.lockedUntilMs) {
    lockByUserId.set(userId, current);
    return current;
  }

  const failedAttempts = current.failedAttempts + 1;
  const lockedUntilMs =
    failedAttempts >= MAX_PIN_ATTEMPTS ? now + PIN_LOCK_DURATION_MINUTES * 60 * 1000 : 0;

  const next = { failedAttempts, lockedUntilMs };
  lockByUserId.set(userId, next);
  return next;
};

const clearLock = (userId: string) => {
  lockByUserId.delete(userId);
};

/* ======================
   GENERAR Y ENVIAR CÓDIGO
====================== */
export const generateResetCode = async (email: string): Promise<boolean> => {
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user) return false;

  // Keep only one active code per user to reduce brute force surface.
  await prisma.password_reset_codes.updateMany({
    where: {
      user_id: user.id,
      used_at: null,
      is_revoked: false,
      expires_at: { gt: new Date() },
    },
    data: { is_revoked: true },
  });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = await bcrypt.hash(code, 10);

  await prisma.password_reset_codes.create({
    data: {
      user_id: user.id,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + CODE_EXPIRATION_MINUTES * 60 * 1000),
    },
  });

  await sendPasswordResetEmail(user.email, code);
  return true;
};

/* ======================
   VERIFICAR CÓDIGO
====================== */
export const verifyResetCodeService = async (email: string, code: string) => {
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) return false;

  if (isLocked(user.id)) return false;

  const record = await prisma.password_reset_codes.findFirst({
    where: {
      user_id: user.id,
      used_at: null,
      is_revoked: false,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  });

  if (!record) return false;

  if (record.attempts >= MAX_PIN_ATTEMPTS) {
    registerFailedAttempt(user.id);
    await prisma.password_reset_codes.update({
      where: { id: record.id },
      data: { is_revoked: true },
    });
    return false;
  }

  const valid = await bcrypt.compare(code, record.code_hash);

  if (!valid) {
    const updated = await prisma.password_reset_codes.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });

    const lockState = registerFailedAttempt(user.id);

    if (updated.attempts >= MAX_PIN_ATTEMPTS || lockState.failedAttempts >= MAX_PIN_ATTEMPTS) {
      await prisma.password_reset_codes.update({
        where: { id: record.id },
        data: { is_revoked: true },
      });
    }

    return false;
  }

  clearLock(user.id);
  return true;
};

/* ======================
   RESET CONTRASEÑA
====================== */
export const resetPasswordService = async (email: string, code: string, newPassword: string) => {
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) return false;

  if (isLocked(user.id)) return false;

  const record = await prisma.password_reset_codes.findFirst({
    where: {
      user_id: user.id,
      used_at: null,
      is_revoked: false,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  });

  if (!record) return false;

  if (record.attempts >= MAX_PIN_ATTEMPTS) {
    registerFailedAttempt(user.id);
    await prisma.password_reset_codes.update({
      where: { id: record.id },
      data: { is_revoked: true },
    });
    return false;
  }

  const valid = await bcrypt.compare(code, record.code_hash);
  if (!valid) {
    registerFailedAttempt(user.id);
    return false;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
        password_changed_at: new Date(),
      },
    }),
    prisma.password_reset_codes.update({
      where: { id: record.id },
      data: { used_at: new Date() },
    }),
  ]);

  await SessionService.revokeAllUserSessions(user.id, revoke_reason.PASSWORD_CHANGED);

  clearLock(user.id);
  return true;
};
