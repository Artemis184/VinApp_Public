import { Router } from 'express';
import { GetAllMenus, GetMenusByRole } from './Menus.controller';
import { verifyToken } from '../../middlewares/verifyToken';

const router = Router();

/**
 * @route GET /api/menus
 * @description Obtiene todos los menús disponibles
 * @access Private (debe tener JWT válido para no exponer estructura de permisos)
 */
router.get('/menus', verifyToken, GetAllMenus);

/**
 * @route GET /api/menus/role/:roleId
 * @description Obtiene menús filtrados por rol
 * @access Private (debe tener JWT válido)
 * @param {number} roleId - ID del rol
 */
router.get('/menus/role/:roleId', verifyToken, GetMenusByRole);

export default router;
