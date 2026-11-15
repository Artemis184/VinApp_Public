import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cloud.artemisnet.vinapp',
  appName: 'VinApp',
  webDir: 'www',
  server: {
    // Origen https://localhost en Android: requisito para que el WebView acepte
    // cookies Secure; SameSite=None del backend permite enviarlas a vinback.
    androidScheme: 'https',
  },
  plugins: {
    // Persiste el jar de cookies del WebView (incluye refresh HttpOnly) entre
    // reinicios de la app -> sesión persistente estilo WhatsApp/FB.
    // El backend debe emitir las cookies con SameSite=None; Secure y
    // Domain=.artemisnet.cloud (ver docs/dokploy-environments.md).
    CapacitorCookies: {
      enabled: true,
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // Quema el ID de Cliente Web aquí. No uses la importación de Angular.
      serverClientId: 'TU_CLIENT_ID.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;