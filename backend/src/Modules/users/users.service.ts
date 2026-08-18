import { PrismaClient, revoke_reason } from '@prisma/client';
import bcrypt from 'bcrypt';
import { asignarRolaUser } from '../user_roles/userRoles.service';
import { user_status } from '@prisma/client';
import { sendStatusEmail } from '../email/email.service';
import { IMAGE_MIME_BY_EXTENSION, ROLE_NAMES } from '../../constants/constants';
import fs from 'fs';
import path from 'path';
import { getAvatarUploadDir } from '../../utils/uploads';
import { SessionService } from '../../services/session.service';
import { validationUtils } from '../../middlewares/validationMiddleware';
const prisma = new PrismaClient();
const avatarUploadDir = getAvatarUploadDir();
const EXTERNAL_AVATAR_TIMEOUT_MS = 5000;
const MAX_EXTERNAL_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_EXTERNAL_AVATAR_REDIRECTS = 5;

const notifyPendingStatusEmail = (userId: string, emailOrIdForLogs: string) => {
  sendStatusEmail(userId, user_status.PENDING).catch((error) => {
    console.error(`⚠ Error al enviar email de estado PENDING a ${emailOrIdForLogs}:`, error);
  });
};

const isManagedAvatar = (profilePhoto?: string | null): boolean => {
  if (!profilePhoto) return false;
  return !profilePhoto.startsWith('http://') && !profilePhoto.startsWith('https://');
};

const isAllowedExternalAvatarUrl = (profilePhoto?: string | null): boolean => {
  if (!profilePhoto) return false;

  try {
    const parsed = new URL(profilePhoto);
    if (parsed.protocol !== 'https:') return false;

    const host = parsed.hostname.toLowerCase();
    return (
      host === 'googleusercontent.com' ||
      host.endsWith('.googleusercontent.com') ||
      host === 'ggpht.com' ||
      host.endsWith('.ggpht.com')
    );
  } catch {
    return false;
  }
};

const fetchExternalAvatarBase64 = async (
  profilePhotoUrl: string
): Promise<{ avatar_base64: string; avatar_mime_type: string } | null> => {
  if (!isAllowedExternalAvatarUrl(profilePhotoUrl)) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_AVATAR_TIMEOUT_MS);
  let currentUrl = profilePhotoUrl;
  let redirectCount = 0;

  try {
    let response: Response;

    while (true) {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
      });

      const isRedirect = response.status >= 300 && response.status < 400;

      if (!isRedirect) {
        break;
      }

      if (redirectCount >= MAX_EXTERNAL_AVATAR_REDIRECTS) {
        return null;
      }

      const location = response.headers.get('location');
      if (!location) {
        return null;
      }

      const nextUrl = new URL(location, currentUrl).toString();
      if (!isAllowedExternalAvatarUrl(nextUrl)) {
        return null;
      }

      currentUrl = nextUrl;
      redirectCount += 1;
    }

    if (!response.ok) {
      return null;
    }

    if (!isAllowedExternalAvatarUrl(response.url || currentUrl)) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const normalizedMimeType = contentType.split(';')[0].trim().toLowerCase();

    if (!normalizedMimeType.startsWith('image/')) {
      return null;
    }

    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isNaN(contentLength) && contentLength > MAX_EXTERNAL_AVATAR_BYTES) {
        return null;
      }
    }

    const body = response.body as ReadableStream<Uint8Array> | null;

    if (!body || typeof body.getReader !== 'function') {
      const arrayBuffer = await response.arrayBuffer();

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return null;
      }

      if (arrayBuffer.byteLength > MAX_EXTERNAL_AVATAR_BYTES) {
        return null;
      }

      return {
        avatar_base64: Buffer.from(arrayBuffer).toString('base64'),
        avatar_mime_type: normalizedMimeType,
      };
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value || value.byteLength === 0) {
        continue;
      }

      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_EXTERNAL_AVATAR_BYTES) {
        await reader.cancel('Avatar exceeds size limit');
        controller.abort();
        return null;
      }

      chunks.push(value);
    }

    if (receivedBytes === 0) {
      return null;
    }

    const concatenated = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      concatenated.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return {
      avatar_base64: Buffer.from(
        concatenated.buffer,
        concatenated.byteOffset,
        concatenated.byteLength
      ).toString('base64'),
      avatar_mime_type: normalizedMimeType,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getMimeTypeFromFileName = (fileName: string): string => {
  const extension = path.extname(fileName).toLowerCase();
  return IMAGE_MIME_BY_EXTENSION[extension] || IMAGE_MIME_BY_EXTENSION['.jpg'];
};

const userInclude = {
  user_roles: {
    include: {
      roles: {
        select: { name: true, id: true },
      },
    },
  },
};

const adminVisibilityBaseFilter = {
  AND: [
    {
      user_roles: {
        none: {
          roles: {
            name: {
              in: [ROLE_NAMES.ADMIN, ROLE_NAMES.MASTER],
            },
          },
        },
      },
    },
    {
      is_master: false,
    },
  ],
};

const buildAdminVisibleUsersWhere = (extraFilter?: Record<string, unknown>) => {
  const baseFilters: Record<string, unknown>[] = [adminVisibilityBaseFilter];

  if (extraFilter) {
    return {
      AND: [extraFilter, ...baseFilters],
    };
  }

  return {
    AND: baseFilters,
  };
};

const getRequesterPermissions = async (requesterUserId: string, requesterRole: string) => {
  const requesterUser = await prisma.users.findUnique({
    where: { id: requesterUserId },
    select: {
      is_master: true,
      user_roles: {
        select: {
          roles: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!requesterUser) {
    throw new Error('Usuario solicitante no encontrado');
  }

  const isMaster = requesterUser.is_master === true;
  const requesterRoles = requesterUser.user_roles.map((userRole) => userRole.roles.name);
  const normalizedTokenRole = requesterRole?.toUpperCase();
  const isAdminByDbRole = requesterRoles.includes(ROLE_NAMES.ADMIN);
  const isAdminByTokenRole = normalizedTokenRole === ROLE_NAMES.ADMIN;

  return {
    canViewAllUsers: isMaster,
    isAdmin: isAdminByDbRole || isAdminByTokenRole,
  };
};

export const obtenerTodoUsers = async (requesterUserId: string, requesterRole: string) => {
  try {
    const { canViewAllUsers, isAdmin } = await getRequesterPermissions(
      requesterUserId,
      requesterRole
    );

    // Si tiene is_master=true, retorna TODOS los usuarios (incluyendo ADMINs)
    if (canViewAllUsers) {
      const allUsers = await prisma.users.findMany({
        include: userInclude,
        orderBy: {
          created_at: 'desc',
        },
      });
      return allUsers;
    }

    // Si es ADMIN (pero no master), retorna SOLO usuarios CLIENT
    if (isAdmin) {
      const clientUsers = await prisma.users.findMany({
        where: buildAdminVisibleUsersWhere(),
        include: userInclude,
        orderBy: {
          created_at: 'desc',
        },
      });
      return clientUsers;
    }

    // Si no es ADMIN ni tiene is_master=true, retornar array vacío
    return [];
  } catch (error) {
    console.error('Error al obtener los usuarios:', error);
    throw new Error('Error al obtener usuarios', { cause: error });
  }
};

export const obtenerUsuariosPendientes = async () => {
  try {
    const usuariosPendientes = await prisma.users.findMany({
      where: {
        status: user_status.PENDING,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        address: true,
        reference: true,
        created_at: true,
        age: true,
        profile_photo: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    return usuariosPendientes;
  } catch (error) {
    console.error('Error al obtener usuarios pendientes:', error);
    throw new Error('Error al obtener usuarios pendientes', { cause: error });
  }
};

export const obtenerUserporId = async (id: string) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: id },
      include: {
        ...userInclude,
        // Prisma añade un prefijo extra cuando hay ambigüedad.
        // El nombre correcto en el 'include' es este:
        _count: {
          select: {
            user_nodes_user_nodes_user_idTousers: {
              where: { is_revoked: false },
            },
          },
        },
      },
    });

    if (user) {
      // Usamos el casting 'as any' solo para la extracción del conteo
      // y así evitar que TS se bloquee con esos nombres autogenerados.
      const rawCount = (user as any)._count?.user_nodes_user_nodes_user_idTousers || 0;

      return {
        ...user,
        alarmas_count: rawCount,
      };
    }
    return null;
  } catch (error) {
    console.error('Error al obtener el usuario por ID:', error);
    throw new Error('Error al obtener el usuario por ID', { cause: error });
  }
};

export const obtenerPerfilPropio = async (userId: string) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        apodo: true,
        phone: true,
        address: true,
        reference: true,
        profile_photo: true,
      },
    });

    if (!user) {
      return null;
    }

    let avatar_base64: string | null = null;
    let avatar_mime_type: string | null = null;

    if (isManagedAvatar(user.profile_photo)) {
      const safeFileName = path.basename(user.profile_photo as string);
      const avatarPath = path.join(avatarUploadDir, safeFileName);

      if (fs.existsSync(avatarPath)) {
        const fileBuffer = await fs.promises.readFile(avatarPath);
        avatar_base64 = fileBuffer.toString('base64');
        avatar_mime_type = getMimeTypeFromFileName(safeFileName);
      }
    } else if (isAllowedExternalAvatarUrl(user.profile_photo)) {
      const externalAvatar = await fetchExternalAvatarBase64(user.profile_photo as string);
      if (externalAvatar) {
        avatar_base64 = externalAvatar.avatar_base64;
        avatar_mime_type = externalAvatar.avatar_mime_type;
      }
    }

    return {
      ...user,
      avatar_base64,
      avatar_mime_type,
    };
  } catch (error) {
    console.error('Error al obtener perfil propio:', error);
    throw new Error('Error al obtener perfil propio', { cause: error });
  }
};

export const buscarUserporNombre = async (
  name: string,
  requesterUserId: string,
  requesterRole: string
) => {
  try {
    const { canViewAllUsers, isAdmin } = await getRequesterPermissions(
      requesterUserId,
      requesterRole
    );

    const nameFilter = {
      OR: [
        {
          full_name: {
            contains: name,
            mode: 'insensitive' as const,
          },
        },
        {
          apodo: {
            contains: name,
            mode: 'insensitive' as const,
          },
        },
      ],
    };

    if (canViewAllUsers) {
      return await prisma.users.findMany({
        where: nameFilter,
        include: userInclude,
        orderBy: {
          created_at: 'desc',
        },
      });
    }

    if (isAdmin) {
      return await prisma.users.findMany({
        where: buildAdminVisibleUsersWhere(nameFilter),
        include: userInclude,
        orderBy: {
          created_at: 'desc',
        },
      });
    }

    return [];
  } catch (error) {
    console.error('Error al buscar el usuario por nombre:', error);
    throw new Error('Error al buscar el usuario por nombre', { cause: error });
  }
};

export const crearUserconEmail = async (email: string, password: string) => {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    const exists = await prisma.users.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    });

    if (exists) throw new Error('El correo ya está registrado');

    const password_hash = await bcrypt.hash(password, 10);

    const user = await prisma.users.create({
      data: {
        email: normalizedEmail,
        password_hash,
        status: user_status.PENDING,
      },
    });

    const rolUser = await prisma.roles.findUnique({
      where: { name: ROLE_NAMES.CLIENT },
    });

    if (!rolUser) {
      throw new Error(`Rol ${ROLE_NAMES.CLIENT} no existe`);
    }

    await asignarRolaUser(user.id, rolUser.id);

    // Enviar correo sin bloquear el flujo principal
    notifyPendingStatusEmail(user.id, normalizedEmail);

    return user;
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    throw error;
  }
};

/*
 Completa el registro del usuario con sus datos personales.
Solo permitido para usuarios en estado PENDING.
*/
export const completarRegistroUsuario = async (
  id: string,
  data: {
    full_name: string;
    phone: string;
    address: string;
    reference: string;
  }
) => {
  try {
    // Buscar usuario
    const user = await prisma.users.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Usuarios en PENDING pueden completar registro
    if (user.status !== user_status.PENDING) {
      throw new Error('El registro solo puede completarse si el usuario está en estado PENDING');
    }

    if (!data.full_name || !data.phone || !data.address) {
      throw new Error('Faltan datos obligatorios para completar el registro');
    }

    const updatedUser = await prisma.users.update({
      where: { id },
      data: {
        full_name: data.full_name,
        phone: data.phone,
        address: data.address,
        reference: data.reference,
      },
    });

    // Confirmar por correo que la cuenta quedó en revisión
    notifyPendingStatusEmail(id, id);

    return updatedUser;
  } catch (error) {
    console.error('❌ Prisma error:', error);
    throw error;
  }
};

export const crearUserGoogle = async (
  email: string,
  google_id: string,
  full_name?: string,
  profile_photo?: string
) => {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    console.log(`Iniciando creación de usuario: ${normalizedEmail}`);
    const exists = await prisma.users.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    });

    if (exists) {
      console.log(`Usuario ${normalizedEmail} ya existe en BD`);
      // Si el usuario ya existe, actualizar con datos de Google si no los tiene
      if (!exists.google_id) {
        console.log(`Usuario existe sin google_id. Vinculando Google...`);
        const updatedUser = await prisma.users.update({
          where: { id: exists.id },
          data: {
            google_id,
            full_name: full_name ?? exists.full_name,
            profile_photo: profile_photo ?? exists.profile_photo,
          },
        });
        console.log(`Google ID vinculado al usuario ${normalizedEmail}`);
        return updatedUser;
      }
      console.log(`Usuario ya tiene google_id, retornando usuario existente`);
      return exists;
    }

    console.log(`Creando nuevo usuario Google: ${normalizedEmail}`);
    const user = await prisma.users.create({
      data: {
        email: normalizedEmail,
        google_id,
        full_name: full_name ?? '',
        profile_photo: profile_photo ?? null,
        status: user_status.PENDING,
      },
    });

    console.log(`Usuario Google creado: ${normalizedEmail} (ID: ${user.id})`);

    const rolUser = await prisma.roles.findUnique({
      where: { name: ROLE_NAMES.CLIENT },
    });

    if (!rolUser) {
      throw new Error(`Rol ${ROLE_NAMES.CLIENT} no existe`);
    }

    await asignarRolaUser(user.id, rolUser.id);
    console.log(`Rol ${ROLE_NAMES.CLIENT} asignado a ${normalizedEmail}`);

    // Enviar correo sin bloquear el flujo principal
    console.log(`Iniciando envío de email a ${normalizedEmail}...`);
    notifyPendingStatusEmail(user.id, normalizedEmail);

    return user;
  } catch (error) {
    console.error('[crearUserGoogle] Error al registrar usuario Google:', error);
    throw error;
  }
};

export const actualizarUser = async (
  id: string,
  data: {
    full_name?: string;
    email?: string;
    apodo?: string;
    age?: number | null; // Soportamos null para limpiar el campo
    password?: string;
    phone?: string;
    address?: string;
    reference?: string;
    profile_photo?: string;
    status?: user_status;
  }
) => {
  try {
    // 1. Obtenemos los campos estrictamente validados y saneados
    // (full_name, email, apodo, address, reference)
    const cleanData = validationUtils.userUpdate(data);
    const currentUser = await prisma.users.findUnique({
      where: { id },
    });

    if (!currentUser) throw new Error('Usuario no encontrado');

    let hashedPassword: string | undefined = undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.users.update({
        where: { id },
        data: {
          // 2. Volcamos las propiedades saneadas de forma plana.
          // Esto inyecta dinámicamente solo lo que pasó por el validador.
          ...cleanData,
          // 3. Asignamos el resto de propiedades que NO pasaron por validationUtils
          password_hash: hashedPassword,
          password_changed_at: hashedPassword ? new Date() : undefined,
          phone: data.phone,
          profile_photo: data.profile_photo,
          age: data.age,
          status: data.status,
        },
      });
      return user;
    });

    if (data.status && currentUser.status !== data.status) {
      await sendStatusEmail(id, data.status).catch((err) =>
        console.error('Error al enviar email de estado:', err)
      );
    }

    if (hashedPassword) {
      await SessionService.revokeAllUserSessions(id, revoke_reason.PASSWORD_CHANGED);
    }

    return updatedUser;
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    // 🛡️ Preservamos la causa original para cumplir con ESLint
    throw new Error('Error al actualizar usuario', { cause: error });
  }
};

export const aprobarUser = async (id: string) => {
  try {
    const user = await prisma.users.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
    await sendStatusEmail(user.id, user_status.APPROVED);
    return user;
  } catch (error) {
    console.error('Error al aprobar usuario:', error);
    throw new Error('Error al aprobar usuario', { cause: error });
  }
};
