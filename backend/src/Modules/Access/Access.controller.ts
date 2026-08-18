import { Request, Response } from 'express';
import { ObtenerMenusConAcceso } from '../Menus/Menus.service';

export const GetMenus = async (req: Request, res: Response) => {
  try {
    const menus = await ObtenerMenusConAcceso(Number(req.params.id_rol));
    res.status(200).json({
      aprobado: true,
      cantidad: menus.length,
      menus: menus,
    });
  } catch (error) {
    console.error('Error al obtener los menus: ', error);
    res.status(500).json({
      aprobado: false,
      mensaje: 'Error al obtener los menus',
    });
  }
};
