import fs from 'fs';
import path from 'path';
import { UPLOAD_CONFIG } from '../constants/constants';

// 1. Centraliza las rutas de uploads del backend
// 2. Garantiza que exista la carpeta de uploads (./uploads/avatars) al iniciar la aplicación.

const uploadsBaseDir = path.resolve(process.cwd(), UPLOAD_CONFIG.BASE_DIR_NAME);

export const getAvatarUploadDir = () => path.join(uploadsBaseDir, UPLOAD_CONFIG.AVATARS_DIR_NAME);

export const ensureUploadDirectories = () => {
  const directories = [getAvatarUploadDir()];

  for (const directory of directories) {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }
};
