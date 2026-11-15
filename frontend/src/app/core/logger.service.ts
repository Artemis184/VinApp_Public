import { environment } from 'src/environments/environment';

function writeLog(method: 'log' | 'warn' | 'error', message: string): void {
  if (!environment.production) {
    console[method](message);
  }
}

export const appLogger = {
  log(message: string): void {
    writeLog('log', message);
  },
  warn(message: string): void {
    writeLog('warn', message);
  },
  error(message: string): void {
    writeLog('error', message);
  },
};
