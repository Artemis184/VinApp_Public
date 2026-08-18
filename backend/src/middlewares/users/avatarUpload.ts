import multer from 'multer';
import { getAvatarUploadDir } from '../../utils/uploads';
import { UPLOAD_CONFIG } from '../../constants/constants';

// Middleware de subida de avatar para usuarios autenticados.
// Se encarga de:
// - Definir destino de guardado en uploads/avatars
// - Generar nombre único de archivo
// - Validar tipos MIME permitidos (JPG/PNG/WEBP)
// - Aplicar límites de tamaño y cantidad de archivos

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, getAvatarUploadDir());
  },
  filename: (_, file, cb) => {
    const mimeToExtension: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const extension = mimeToExtension[file.mimetype] || UPLOAD_CONFIG.DEFAULT_AVATAR_EXTENSION;
    const fileName = `${UPLOAD_CONFIG.AVATAR_FILE_PREFIX}-${Date.now()}-${Math.round(
      Math.random() * UPLOAD_CONFIG.AVATAR_FILE_RANDOM_MAX
    )}${extension}`;

    cb(null, fileName);
  },
});

const allowedMimetypes: ReadonlySet<string> = new Set(UPLOAD_CONFIG.ALLOWED_AVATAR_MIME_TYPES);

const fileFilter: multer.Options['fileFilter'] = (_, file, cb) => {
  if (!allowedMimetypes.has(file.mimetype)) {
    cb(new Error('Formato de imagen no permitido. Usa JPG, PNG o WEBP'));
    return;
  }

  cb(null, true);
};

export const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: UPLOAD_CONFIG.MAX_AVATAR_FILE_SIZE_BYTES,
    files: UPLOAD_CONFIG.MAX_FILES_PER_REQUEST,
  },
});
