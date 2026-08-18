import { SessionService } from './session.service';

export class SessionCleanupService {
  private static intervalId?: NodeJS.Timeout;

  static async start(intervalMinutes: number = 60) {
    const cleanup = async () => {
      try {
        const cleaned = await SessionService.cleanupExpiredSessions();

        if (cleaned > 0) {
          console.log(`Sesiones expiradas eliminadas: ${cleaned}`);
        }
      } catch (error: any) {
        console.error('Error durante limpieza de sesiones', error.message);
      }
    };

    // Ejecutar limpieza inicial
    await cleanup();

    // Programar limpieza periódica
    this.intervalId = setInterval(cleanup, intervalMinutes * 60 * 1000);
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('Limpieza de sesiones detenida');
    }
  }
}
