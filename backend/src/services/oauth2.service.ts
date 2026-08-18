import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';
import { config } from '../config';

export class OAuth2Service {
  private static instance: OAuth2Service;
  private oauth2Client: OAuth2Client;

  private constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.GMAIL_CLIENT_ID,
      config.GMAIL_CLIENT_SECRET,
      config.GMAIL_REDIRECT_URI
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.GMAIL_REFRESH_TOKEN,
    });
  }

  public static getInstance(): OAuth2Service {
    if (!OAuth2Service.instance) {
      OAuth2Service.instance = new OAuth2Service();
    }
    return OAuth2Service.instance;
  }

  async getTransporter() {
    try {
      const accessToken = await this.oauth2Client.getAccessToken();

      if (!accessToken?.token) {
        throw new Error('No se pudo obtener access token');
      }
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: config.GMAIL,
          clientId: config.GMAIL_CLIENT_ID,
          clientSecret: config.GMAIL_CLIENT_SECRET,
          refreshToken: config.GMAIL_REFRESH_TOKEN,
          accessToken: accessToken.token,
        },
      });

      return transporter;
    } catch (error) {
      console.error('Error obteniendo transporter OAuth2:', error);
      throw new Error('Error al configurar OAuth2 para correos', { cause: error });
    }
  }

  async verifyConnection() {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      console.log('✅ Conexión OAuth2 con Gmail verificada');
      return true;
    } catch (error) {
      console.error('❌ Error verificando conexión OAuth2:', error);
      return false;
    }
  }
}

export const oauth2Service = OAuth2Service.getInstance();
