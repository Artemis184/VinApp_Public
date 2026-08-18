export interface GoogleConfig {
  clientId: string;
}

export interface Environment {
  production: boolean;
  apiUrl: string;
  urlLogo: string;
  apiTimeout: number;
  google: GoogleConfig;
}

export const environment: Environment;
