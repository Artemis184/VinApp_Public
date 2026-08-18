import { user_status } from '@prisma/client';

export type StatusEmailConfig = {
  title: string;
  greeting: string;
  mainMessage: string;
  sendEmail: boolean;
  showContactInfo?: boolean;
  accentColor: string;
};

export const STATUS_EMAIL_CONFIG: Record<user_status, StatusEmailConfig> = {
  PENDING: {
    title: 'Registro Recibido - Revisión en Proceso',
    greeting: 'Estimado/a',
    mainMessage:
      'Hemos recibido su solicitud de registro exitosamente. Su cuenta se encuentra actualmente en proceso de revisión por nuestro equipo. Le notificaremos por correo electrónico una vez que se complete el proceso de validación.',
    sendEmail: true,
    showContactInfo: true,
    accentColor: '#9ca3af',
  },

  APPROVED: {
    title: 'Cuenta Aprobada - Bienvenido/a',
    greeting: 'Estimado/a',
    mainMessage:
      'Nos complace informarle que su cuenta ha sido aprobada exitosamente. Ya tiene acceso completo a nuestra plataforma y puede comenzar a utilizar todos los servicios disponibles iniciando sesión con su cuenta de registro',
    sendEmail: true,
    showContactInfo: true,
    accentColor: '#16a34a',
  },

  REJECTED: {
    title: 'Solicitud No Aprobada',
    greeting: 'Estimado/a',
    mainMessage:
      'Lamentamos informarle que su solicitud de registro no ha podido ser aprobada en esta ocasión. Si considera que esto es un error o desea obtener más información sobre los motivos, por favor contacte a nuestro equipo de soporte.',
    sendEmail: true,
    showContactInfo: true,
    accentColor: '#dc2626',
  },

  SUSPENDED: {
    title: 'Cuenta Suspendida Temporalmente',
    greeting: 'Estimado/a',
    mainMessage:
      'Le informamos que su cuenta ha sido suspendida temporalmente. Durante este período no podrá acceder a los servicios de la plataforma. Para obtener más información o solicitar la reactivación de su cuenta, por favor contacte a nuestro equipo de soporte.',
    sendEmail: true,
    showContactInfo: true,
    accentColor: '#dc2626',
  },
};
