import { Request, Response } from 'express';
import {
  obtenerTodoUsers,
  obtenerUserporId,
  buscarUserporNombre,
  crearUserconEmail,
  crearUserGoogle,
  actualizarUser,
  completarRegistroUsuario,
  obtenerUsuariosPendientes,
  obtenerPerfilPropio,
} from './users.service';
import { user_status, PrismaClient } from '@prisma/client';
import { verifyGoogleIdToken } from '../../services/googleAuth.service';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import fs from 'fs';
import path from 'path';
import { getAvatarUploadDir } from '../../utils/uploads';
import bcrypt from 'bcrypt';
import { SessionService } from '../../services/session.service';
import { setAuthCookies } from '../../utils/authCookies';
import { SECURITY_CONFIG } from '../../constants/constants';

interface AuthRequest extends Request {
  user?: {
    user_uuid: string;
    role: string;
  };
  file?: Express.Multer.File;
}

const prisma = new PrismaClient();
const avatarUploadDir = getAvatarUploadDir();

const resolveDeviceId = (req: Request): string => {
  const body = req.body as Record<string, unknown>;
  const rawDeviceId = body.deviceId || body.device_id;

  if (typeof rawDeviceId === 'string' && rawDeviceId.trim()) {
    return rawDeviceId.trim();
  }

  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.ip || 'unknown';
  const fallbackBase = `${userAgent}:${ip}`;

  return `legacy-${Buffer.from(fallbackBase).toString('base64url').slice(0, 32)}`;
};

// Helper para normalizar parámetros de ruta (pueden ser string | string[])
const getParam = (param: string | string[] | undefined): string => {
  return Array.isArray(param) ? param[0] : param || '';
};

const isManagedAvatar = (profilePhoto?: string | null): boolean => {
  if (!profilePhoto) return false;
  return !profilePhoto.startsWith('http://') && !profilePhoto.startsWith('https://');
};

const removeAvatarFile = async (fileName?: string | null): Promise<void> => {
  if (!isManagedAvatar(fileName)) return;

  const safeFileName = path.basename(fileName as string);
  const fullPath = path.join(avatarUploadDir, safeFileName);

  try {
    await fs.promises.unlink(fullPath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.error('Error al eliminar avatar anterior:', error);
    }
  }
};

// Obtener todos los usuarios con filtrado por rol del usuario autenticado
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.user_uuid;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const users = await obtenerTodoUsers(userId, userRole);
    res.status(200).json({
      cant: users.length,
      data: users,
      message: 'Usuarios obtenidos exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
};

export const getPendingUsers = async (req: Request, res: Response) => {
  try {
    const pendingUsers = await obtenerUsuariosPendientes();
    res.status(200).json({
      cant: pendingUsers.length,
      data: pendingUsers,
      message: 'Usuarios pendientes obtenidos exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener usuarios pendientes:', error);
    res.status(500).json({ message: 'Error al obtener usuarios pendientes' });
  }
};

export const getMyProfile = async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.user_uuid;

  if (!currentUserId) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  try {
    const user = await obtenerPerfilPropio(currentUserId);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.status(200).json({
      data: user,
      message: 'Perfil obtenido exitosamente',
    });
  } catch (error) {
    console.error('Error al obtener perfil propio:', error);
    return res.status(500).json({ message: 'Error al obtener perfil' });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  try {
    const user = await obtenerUserporId(id);
    if (user) {
      res.status(200).json({
        data: user,
        message: 'Usuario obtenido exitosamente',
      });
    } else {
      res.status(404).json({ message: 'Usuario no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener usuario por ID:', error);
    res.status(500).json({ message: 'Error al obtener usuario por ID' });
  }
};

export const getUserByName = async (req: AuthRequest, res: Response) => {
  const name = getParam(req.params.name);
  try {
    const userId = req.user?.user_uuid;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const users = await buscarUserporNombre(name, userId, userRole);
    res.status(200).json({
      cant: users.length,
      data: users,
      message: 'Usuarios obtenidos exitosamente',
    });
  } catch (error) {
    console.error('Error al buscar usuarios por nombre:', error);
    res.status(500).json({ message: 'Error al buscar usuarios por nombre' });
  }
};

export const postUserWithEmail = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: 'Faltan campos requeridos: email, password son obligatorios.' });
  }
  try {
    const newUser = await crearUserconEmail(email, password);
    res.status(201).json({
      data: newUser,
      message: 'Usuario creado exitosamente',
    });
  } catch (error: any) {
    console.error('Error al crear usuario con email:', error);
    res.status(500).json({ message: error.message || 'Error al crear usuario' });
  }
};

/*
 Completa los datos personales del usuario durante el registro (PASO 2)
 Utiliza el UUID generado en el registro inicial
*/
export const patchPersonalData = async (req: Request, res: Response) => {
  const userId = getParam(req.params.userId);

  const { full_name, phone, address, reference } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'userId es requerido' });
  }

  // Validación básica
  if (!full_name && !phone && !address && !reference) {
    return res.status(400).json({
      message: 'No se enviaron datos para completar el registro',
    });
  }

  try {
    const updatedUser = await completarRegistroUsuario(userId, {
      full_name,
      phone,
      address,
      reference,
    });

    return res.status(200).json({
      message: 'Datos de registro guardados correctamente',
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(400).json({
      message: error.message || 'Error al completar el registro',
    });
  }
};

export const postUserGoogle = async (req: Request, res: Response) => {
  const { id_token } = req.body;

  if (!id_token) {
    return res.status(400).json({
      message: 'Token de Google requerido',
    });
  }

  try {
    console.log(`🔐 [postUserGoogle] Validando token de Google...`);
    // 1️⃣ Validar token con Google
    const googleUser = await verifyGoogleIdToken(id_token);
    console.log(`✅ [postUserGoogle] Token validado. Email: ${googleUser.email}`);

    // 2️⃣ Buscar usuario por email
    console.log(`🔍 [postUserGoogle] Buscando usuario con email: ${googleUser.email}`);
    const user = await prisma.users.findUnique({
      where: { email: googleUser.email },
      include: {
        user_roles: { include: { roles: true } },
      },
    });

    // 3️⃣ Si NO existe → crear usuario en PENDING
    if (!user) {
      console.log(`➕ [postUserGoogle] Usuario NO existe. Creando nuevo usuario...`);
      const newUser = await crearUserGoogle(
        googleUser.email,
        googleUser.google_id,
        googleUser.full_name,
        googleUser.profile_photo
      );

      console.log(`✅ [postUserGoogle] Usuario creado exitosamente`);
      return res.status(201).json({
        message: 'Usuario registrado con Google. Cuenta pendiente de aprobación.',
        data: {
          usr_uuid: newUser.id,
          usr_email: newUser.email,
          usr_nombres: newUser.full_name,
        },
      });
    }

    console.log(`👤 [postUserGoogle] Usuario YA EXISTE. Estado: ${user.status}`);

    // 4️⃣ Usuario existe pero no aprobado
    if (user.status !== user_status.APPROVED) {
      console.log(`⛔ [postUserGoogle] Usuario existe pero NO está aprobado (${user.status})`);
      return res.status(403).json({
        message: 'Tu cuenta aún no ha sido aprobada',
      });
    }

    // 5️⃣ Login exitoso - generar sesión persistente y cookies HttpOnly
    const deviceId = resolveDeviceId(req);
    const session = await SessionService.createPersistentSession(user.id, deviceId, {
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.ip,
      source: 'users.postusergoogle',
    });

    console.log(`✅ [postUserGoogle] Usuario aprobado. Generando access token y cookies...`);
    const accessToken = jwt.sign(
      {
        user_uuid: user.id,
        email: user.email,
        role: user.user_roles[0]?.roles?.name,
        is_master: user.is_master,
        session_id: String(session.sessionId),
        device_id: deviceId,
      },
      config.JWT_SECRET,
      { expiresIn: SECURITY_CONFIG.TOKEN_TTL.ACCESS_TOKEN_EXPIRES_IN }
    );

    const csrfToken = setAuthCookies(
      res,
      accessToken,
      session.refreshToken,
      String(session.sessionId),
      deviceId,
    );

    await prisma.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    console.log(`🎉 [postUserGoogle] Login exitoso para ${googleUser.email}`);
    return res.status(200).json({
      Login: true,
      access_token_expires_at: Date.now() + SECURITY_CONFIG.TOKEN_TTL.ACCESS_TOKEN_MS,
      csrf_token: csrfToken,
      User_data: {
        usr_uuid: user.id,
        usr_nombres: user.full_name,
        usr_email: user.email,
        usr_rol: user.user_roles[0]?.roles?.name ?? null,
      },
    });
  } catch (error) {
    console.error('❌ Error al registrar/login usuario de Google:', error);
    return res.status(401).json({
      message: 'Token de Google inválido',
    });
  }
};

export const patchUser = async (req: AuthRequest, res: Response) => {
  const id = getParam(req.params.userId);
  const adminId = req.user?.user_uuid;

  if (adminId === id) {
    return res.status(400).json({
      message: 'No puedes actualizar tus propios datos por esta ruta. Usa PATCH /api/users/profile',
    });
  }

  const { full_name, email, password, phone, address, reference, profile_photo, age, status } =
    req.body;

  try {
    const dataToUpdate: any = {};

    if (full_name !== undefined) dataToUpdate.full_name = full_name;
    if (email !== undefined) dataToUpdate.email = email;
    if (password !== undefined) dataToUpdate.password = password;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (address !== undefined) dataToUpdate.address = address;
    if (reference !== undefined) dataToUpdate.reference = reference;
    if (profile_photo !== undefined) dataToUpdate.profile_photo = profile_photo;

    // 🛡️ LÓGICA DE EDAD CORREGIDA
    if (age !== undefined) {
      // Si es null o un string vacío, enviamos null a la DB para "limpiar" el campo
      if (age === null || (typeof age === 'string' && age.trim() === '')) {
        dataToUpdate.age = null;
      } else {
        const ageNum = Number(age);
        // Validamos que sea un número finito y dentro de un rango lógico
        if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120) {
          return res.status(400).json({
            message: 'La edad debe ser un número válido entre 0 y 120',
          });
        }
        dataToUpdate.age = ageNum;
      }
    }

    if (status !== undefined) {
      dataToUpdate.status = status as user_status;
    }

    // Pasamos adminId para asegurar que el Service ejecute la auditoría
    const updatedUser = await actualizarUser(id, dataToUpdate);

    res.status(200).json({
      data: updatedUser,
      message: 'Usuario actualizado y cambios auditados exitosamente',
    });
  } catch (error: any) {
    console.error('Error al actualizar usuario:', error);

    // Manejo de error de email duplicado o errores lanzados por el service
    if (error.message.includes('email_unique') || error.message.includes('ya existe')) {
      return res.status(400).json({
        message: 'El correo electrónico ya está en uso por otro usuario',
      });
    }

    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
};

export const changeUserStatus = async (req: Request, res: Response, status: user_status) => {
  const id = getParam(req.params.userId);

  try {
    const updatedUser = await actualizarUser(id, { status });

    res.status(200).json({
      data: updatedUser,
      message: 'Estado del usuario actualizado correctamente',
    });
  } catch (error) {
    console.error('Error al cambiar estado del usuario:', error);
    res.status(500).json({ message: 'Error al cambiar estado del usuario' });
  }
};

/**
 * Actualizar perfil propio (cualquier usuario, incluyendo admins)
 * Se registra en audit_user_actions
 */
export const updateMyProfile = async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.user_uuid;

  if (!currentUserId) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  const {
    full_name,
    apodo,
    age,
    password,
    passwordActual,
    phone,
    address,
    reference,
    profile_photo,
  } = req.body;

  try {
    const currentUser = await prisma.users.findUnique({
      where: { id: currentUserId },
      select: { profile_photo: true, password_hash: true },
    });
    const passwordWasProvided = password !== undefined;
    const isPasswordValidForUpdate = typeof password === 'string' && password.length > 0;

    if (!currentUser) {
      if (req.file?.filename) {
        await removeAvatarFile(req.file.filename);
      }
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (passwordWasProvided && !isPasswordValidForUpdate) {
      if (req.file?.filename) {
        await removeAvatarFile(req.file.filename);
      }
      return res.status(400).json({
        message: 'La nueva contraseña no puede estar vacía',
      });
    }

    if (passwordWasProvided) {
      const hasCurrentPassword = typeof passwordActual === 'string' && passwordActual.length > 0;

      if (!hasCurrentPassword) {
        if (req.file?.filename) {
          await removeAvatarFile(req.file.filename);
        }
        return res.status(400).json({
          message: 'Debes enviar la contraseña actual para cambiarla',
        });
      }

      if (currentUser?.password_hash) {
        const isCurrentPasswordValid = await bcrypt.compare(
          passwordActual,
          currentUser.password_hash
        );
        if (!isCurrentPasswordValid) {
          if (req.file?.filename) {
            await removeAvatarFile(req.file.filename);
          }
          return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
        }
      }
    }

    const dataToUpdate: any = {};
    const uploadedAvatarFileName = req.file?.filename;

    if (full_name !== undefined) dataToUpdate.full_name = full_name;
    if (apodo !== undefined) dataToUpdate.apodo = apodo;
    if (age !== undefined) {
      const normalizedAge = typeof age === 'string' ? age.trim() : age;

      if (normalizedAge === '') {
        if (req.file?.filename) {
          await removeAvatarFile(req.file.filename);
        }
        return res.status(400).json({ message: 'La edad debe ser un número válido' });
      }

      const ageNumber = Number(normalizedAge);
      if (!Number.isFinite(ageNumber)) {
        if (req.file?.filename) {
          await removeAvatarFile(req.file.filename);
        }
        return res.status(400).json({ message: 'La edad debe ser un número válido' });
      }

      dataToUpdate.age = ageNumber;
    }
    if (passwordWasProvided) dataToUpdate.password = password;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (address !== undefined) dataToUpdate.address = address;
    if (reference !== undefined) dataToUpdate.reference = reference;
    if (uploadedAvatarFileName) {
      dataToUpdate.profile_photo = uploadedAvatarFileName;
    } else if (profile_photo !== undefined) {
      dataToUpdate.profile_photo = profile_photo;
    }

    // Los usuarios NO pueden cambiar su propio status por esta ruta
    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ message: 'No hay datos para actualizar' });
    }

    const updatedUser = await actualizarUser(currentUserId, dataToUpdate);

    if (uploadedAvatarFileName) {
      await removeAvatarFile(currentUser?.profile_photo);
    }

    res.status(200).json({
      data: updatedUser,
      message: 'Perfil actualizado exitosamente',
    });
  } catch (error) {
    if (req.file?.filename) {
      await removeAvatarFile(req.file.filename);
    }

    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ message: 'Error al actualizar perfil' });
  }
};
