import { PrismaClient, user_status } from '@prisma/client';
import { STATUS_EMAIL_CONFIG } from './status-email.config';
import { oauth2Service } from '../../services/oauth2.service';
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
    console.log(`✔ Correo enviado → ${user.email} [${newStatus}]`);
    return true;
  } catch (error) {
    console.error(`✖ Error enviando correo de estado [${newStatus}] al usuario ${userId}:`, error);
    throw error; // Relanzar el error para que el llamador lo sepa
  }
};
