export type EstadoUsuario = 'APPROVED' | 'SUSPENDED' | 'PENDING' | 'REJECTED';

export interface UsuarioNodeAlarm {
  id: number | string;
  is_enabled: boolean;
  name?: string | null;
}

export interface UsuarioNode {
  nodes: UsuarioNodeAlarm;
}

export interface Usuario {
  id: string;
  email: string;
  full_name: string | null;
  apodo: string | null;
  age: number | null;
  phone: string | null;
  address: string | null;
  reference: string | null;
  profile_photo: string | null;
  status: EstadoUsuario;
  created_at: string;
  updated_at: string | null;
  user_roles?: {
    roles: {
      name: string;
      id: number;
    };
  }[];
  user_nodes?: UsuarioNode[];
}
