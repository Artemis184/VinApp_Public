export interface DatosUsuarioForm {
  full_name?: string;
  apodo?: string;
  phone?: string;
  address?: string;
  reference?: string;
  passwordActual?: string;
  password?: string;
  avatar?: File | null;
}

export interface MenuGeneralUserInput {
  foto?: string | null;
}

export interface MyProfileResponse {
  data: {
    id: string;
    email: string;
    full_name: string | null;
    apodo: string | null;
    phone: string | null;
    address: string | null;
    reference: string | null;
    profile_photo: string | null;
    avatar_base64: string | null;
    avatar_mime_type: string | null;
  };
  message: string;
}

export interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}
