import validator from 'validator';

// 1. Definimos una interfaz para asegurar que el ID siempre sea string
interface CleanNotification {
  user_id: string;
  type: string;
  message: string;
}

export const validationUtils = {
  notification: (data: any): CleanNotification => {
    const errors: string[] = [];

    // Ahora validamos correctamente como UUID
    if (data.user_id === undefined || !validator.isUUID(String(data.user_id))) {
      errors.push('El ID de usuario debe ser un UUID válido');
    }

    if (
      typeof data.type !== 'string' ||
      !validator.isLength(data.type.trim(), { min: 3, max: 50 })
    ) {
      errors.push('El tipo debe tener entre 3 y 50 caracteres');
    }

    if (
      typeof data.message !== 'string' ||
      !validator.isLength(data.message.trim(), { min: 1, max: 500 })
    ) {
      errors.push('El mensaje debe tener entre 1 y 500 caracteres');
    }

    if (errors.length > 0) throw new Error(errors.join(', '));

    return {
      // 2. Aquí devolvemos el string directamente, sin intentar convertirlo a Number
      user_id: String(data.user_id),
      type: validator.escape(data.type.trim()),
      message: validator.escape(data.message.trim()),
    };
  },

  // 👇 NUEVO VALIDADOR PARA PATCH PARCIAL DE NOTIFICACIONES
  notificationUpdate: (data: any) => {
    const clean: any = {};
    const errors: string[] = [];

    if (data.type !== undefined) {
      if (typeof data.type !== 'string') {
        errors.push('El campo type debe ser texto');
      } else if (!validator.isLength(data.type.trim(), { min: 3, max: 50 })) {
        errors.push('El tipo debe tener entre 3 y 50 caracteres');
      } else {
        clean.type = validator.escape(data.type.trim());
      }
    }

    if (data.message !== undefined) {
      if (typeof data.message !== 'string') {
        errors.push('El campo message debe ser texto');
      } else if (!validator.isLength(data.message.trim(), { min: 1, max: 500 })) {
        errors.push('El mensaje debe tener entre 1 y 500 caracteres');
      } else {
        clean.message = validator.escape(data.message.trim());
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    return clean;
  },

  audit: (data: any) => {
    const jsonString = JSON.stringify(data);
    if (jsonString.length > 2048) {
      throw new Error('El log de auditoría es demasiado grande');
    }
    return data;
  },

  userUpdate: (data: any) => {
    const clean: any = {};
    const errors: string[] = [];

    // Usamos !== undefined para permitir procesar strings vacíos si el cliente quiere borrar el campo
    if (data.full_name !== undefined) {
      if (typeof data.full_name !== 'string') errors.push('El campo full_name debe ser texto');
      else clean.full_name = validator.escape(data.full_name.trim().substring(0, 100));
    }

    if (data.apodo !== undefined) {
      if (typeof data.apodo !== 'string') errors.push('El campo apodo debe ser texto');
      else clean.apodo = validator.escape(data.apodo.trim().substring(0, 30));
    }

    if (data.address !== undefined) {
      if (typeof data.address !== 'string') errors.push('El campo address debe ser texto');
      else clean.address = validator.escape(data.address.trim().substring(0, 200));
    }

    if (data.reference !== undefined) {
      if (typeof data.reference !== 'string') errors.push('El campo reference debe ser texto');
      else clean.reference = validator.escape(data.reference.trim().substring(0, 200));
    }

    if (data.email !== undefined) {
      if (typeof data.email !== 'string') {
        errors.push('El campo email debe ser texto');
      } else if (!validator.isEmail(data.email)) {
        errors.push('Email inválido');
      } else {
        clean.email = data.email.toLowerCase().trim();
      }
    }

    // Si hubo tipos incorrectos, lanzamos un Error de validación consistente (400 Bad Request)
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    return clean;
  },
};
