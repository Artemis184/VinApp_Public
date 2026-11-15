import dotenv from 'dotenv';
dotenv.config();

export type Channel = 'public' | 'admin';

export interface ChannelDestination {
  botToken: string;
  chatId: string;
}

const str = (value: string | undefined): string => (value ?? '').trim();

const positiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  PORT: positiveNumber(process.env.PORT, 4000),
  NOTIFIER_API_KEY: str(process.env.NOTIFIER_API_KEY),

  QUEUE_MAX_SIZE: positiveNumber(process.env.QUEUE_MAX_SIZE, 500),
  MAX_ATTEMPTS: positiveNumber(process.env.MAX_ATTEMPTS, 5),
  RETRY_BASE_MS: positiveNumber(process.env.RETRY_BASE_MS, 2000),
  SEND_INTERVAL_MS: positiveNumber(process.env.SEND_INTERVAL_MS, 1100),
  TELEGRAM_TIMEOUT_MS: positiveNumber(process.env.TELEGRAM_TIMEOUT_MS, 5000),
  SHUTDOWN_DRAIN_MS: positiveNumber(process.env.SHUTDOWN_DRAIN_MS, 8000),

  channels: {
    public: {
      botToken: str(process.env.TELEGRAM_PUBLIC_BOT_TOKEN),
      chatId: str(process.env.TELEGRAM_PUBLIC_CHAT_ID),
    },
    admin: {
      botToken: str(process.env.TELEGRAM_ADMIN_BOT_TOKEN),
      chatId: str(process.env.TELEGRAM_ADMIN_CHAT_ID),
    },
  } satisfies Record<Channel, ChannelDestination>,
};

// Fail-closed: sin API key cualquiera con acceso a la red interna podría
// disparar mensajes al grupo, así que preferimos no arrancar.
if (!config.NOTIFIER_API_KEY) {
  throw new Error(
    '[config] NOTIFIER_API_KEY es requerida. Define una clave larga y aleatoria antes de arrancar el notifier.'
  );
}
