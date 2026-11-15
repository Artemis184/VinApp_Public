import { PrismaClient, user_status } from '@prisma/client';
import { STATUS_EMAIL_CONFIG } from './status-email.config';
import { oauth2Service } from '../../services/oauth2.service';
import { REGISTRATION_ADMIN_EMAIL_CONFIG } from './registration-admin-email.config';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

const prisma = new PrismaClient();

// Template
const templateSource = fs.readFileSync(
  path.join(__dirname, 'templates', 'status-notification.html'),
  'utf8'
);
const emailTemplate = Handlebars.compile(templateSource);

// Datos usuario
const getUserData = async (userId: string) => {
  const user = await prisma.users.findUnique({
    where: { id: userId },
  });
  if (!user) throw new Error('Usuario no encontrado');
  return user;
};

// Envío principal
export const sendStatusEmail = async (userId: string, newStatus: user_status) => {
  try {
    const emailConfig = STATUS_EMAIL_CONFIG[newStatus];

    if (!emailConfig?.sendEmail) {
      console.log(`ℹ Email no configurado para enviar en estado: ${newStatus}`);
      return;
    }

    const user = await getUserData(userId);

    const templateData = {
      title: emailConfig.title,
      greeting: emailConfig.greeting,
      mainMessage: emailConfig.mainMessage,
      showContactInfo: emailConfig.showContactInfo,
      accentColor: emailConfig.accentColor,
      appName: 'VinApp',
      currentYear: new Date().getFullYear(),
      userFullName: user.full_name,
      supportEmail: config.CORREO_ADMINISTRACION,
    };

    console.log('Template data:', JSON.stringify(templateData, null, 2));

    const transporter = await oauth2Service.getTransporter();

    await transporter.sendMail({
      from: `"VinApp" <${config.GMAIL}>`,
      to: user.email,
      subject: emailConfig.title,
      html: emailTemplate(templateData),
      cc: config.CORREO_ADMINISTRACION,
    });
    console.log(`✔ Correo de estado enviado [${newStatus}]`);
    return true;
  } catch (error) {
    console.error(`✖ Error enviando correo de estado [${newStatus}]`);
    throw error; // Relanzar el error para que el llamador lo sepa
  }
};

export const sendRegistrationAdminEmail = async (userId: string) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const administrators = await prisma.users.findMany({
      where: {
        OR: [
          {
            user_roles: {
              some: {
                roles: {
                  name: 'ADMIN',
                },
              },
            },
          },
          {
            is_master: true,
          },
        ],
      },
      select: {
        email: true,
      },
    });

    const adminEmails = [
      ...new Set(
        administrators
          .map((admin) => admin.email)
          .filter((email): email is string => Boolean(email))
      ),
    ];

    if (adminEmails.length === 0) {
      console.warn('No se encontraron administradores para notificar el nuevo registro');
      return false;
    }

    const adminTemplateSource = await fs.promises.readFile(
      path.join(__dirname, 'templates', 'registration-admin-notification.html'),
      'utf8'
    );

    const adminEmailTemplate = Handlebars.compile(adminTemplateSource);

    const templateData = {
      title: REGISTRATION_ADMIN_EMAIL_CONFIG.title,
      greeting: REGISTRATION_ADMIN_EMAIL_CONFIG.greeting,
      mainMessage: REGISTRATION_ADMIN_EMAIL_CONFIG.mainMessage,
      accentColor: REGISTRATION_ADMIN_EMAIL_CONFIG.accentColor,
      appName: REGISTRATION_ADMIN_EMAIL_CONFIG.appName,
      currentYear: new Date().getFullYear(),
      userFullName: user.full_name || 'No especificado',
      userEmail: user.email,
      registrationDate: user.created_at,
    };

    const transporter = await oauth2Service.getTransporter();

    await transporter.sendMail({
      from: `"VinApp" <${config.GMAIL}>`,
      to: adminEmails,
      subject: REGISTRATION_ADMIN_EMAIL_CONFIG.title,
      html: adminEmailTemplate(templateData),
    });

    console.log(`✔ Correo de nuevo registro enviado a ${adminEmails.length} administrador(es)`);

    return true;
  } catch (error) {
    console.error('✖ Error enviando correo de nuevo registro');

    throw error;
  }
};
