import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'VinApp',
  webDir: 'www',
  // En desarrollo local preferimos no fijar `server.url` para que la app use
  // los assets empaquetados en `www`. Si quieres que la app cargue contenido
  // remoto, restaura esta sección con la URL correspondiente.
};

export default config;
