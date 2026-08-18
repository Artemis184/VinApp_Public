export interface AdminFiltro {
  id: string;
  nombre: string;
  correo: string;
}

export interface AlarmaFiltro {
  id: number;
  nombre: string;
}

export interface AuditoriaAdmin {
  id: number;
  accion: string;
  accionTraducida?: string;
  adminId: string;
  alarmaId?: number;
  alarmaNombre?: string;
  alarmaCodigo?: string;
  alarmaUbicacion?: string;
  adminNombre: string;
  adminCorreo: string;
  fechaISO: string;
  metadata: any;
  fechaTexto?: string;
  metadataList?: { key: string; value: any }[];
  resumenDinamico?: string;
  detalleVisualRapido?: string;
}
