import { oauth2Service } from '../../services/oauth2.service';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';
import { CODE_EXPIRATION_MINUTES } from './password.constants';

const templateSource = fs.readFileSync(
  path.join(__dirname, 'templates', 'password-reset.html'),
  'utf8'
);

const template = Handlebars.compile(templateSource);

export const sendPasswordResetEmail = async (email: string, code: string) => {
  const transporter = await oauth2Service.getTransporter();

  await transporter.sendMail({
    from: `"VinApp" <${config.GMAIL}>`,
    to: email,
    subject: 'Recuperación de contraseña',
    html: template({
      code,
      minutes: CODE_EXPIRATION_MINUTES,
      appName: 'VinApp',
      currentYear: new Date().getFullYear(),
    }),
  });
};
