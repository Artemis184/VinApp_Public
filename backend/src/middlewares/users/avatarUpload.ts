import multer from 'multer';
import { UPLOAD_CONFIG } from '../../constants/constants';

// Middleware de subida de avatar para usuarios autenticados.
// Se encarga de:
// - Definir destino de guardado en uploads/avatars
// - Generar nombre único de archivo
// - Validar tipos MIME permitidos (JPG/PNG/WEBP)
// - Aplicar límites de tamaño y cantidad de archivos

const allowedMimetypes: ReadonlySet<string> = new Set(UPLOAD_CONFIG.ALLOWED_AVATAR_MIME_TYPES);

const fileFilter: multer.Options['fileFilter'] = (_, file, cb) => {
  if (!allowedMimetypes.has(file.mimetype)) {
    cb(new Error('Formato de imagen no permitido. Usa JPG, PNG o WEBP'));
    return;
  }

  cb(null, true);
};

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: UPLOAD_CONFIG.MAX_AVATAR_FILE_SIZE_BYTES,
    files: UPLOAD_CONFIG.MAX_FILES_PER_REQUEST,
  },
});
