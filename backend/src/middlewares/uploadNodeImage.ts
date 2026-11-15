import multer from 'multer';
import { UPLOAD_CONFIG } from '../constants/constants';

// Allowlist estricta: antes se aceptaba cualquier `image/*`, lo que incluía
// `image/svg+xml` (un SVG puede ejecutar JS → XSS almacenado al servirlo inline).
const allowedMimetypes: ReadonlySet<string> = new Set(UPLOAD_CONFIG.ALLOWED_AVATAR_MIME_TYPES);

export const uploadNodeImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimetypes.has(file.mimetype)) {
      return cb(new Error('Formato de imagen no permitido. Usa JPG, PNG o WEBP'));
    }
    cb(null, true);
  },
});
