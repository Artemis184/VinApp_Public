import { createHash, timingSafeEqual } from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config, type Channel } from './config';
import { NotificationQueue } from './queue';
import { sendTelegramMessage } from './telegram';

const TELEGRAM_MAX_TEXT_LENGTH = 4096;
const CHANNELS: readonly Channel[] = ['public', 'admin'];

const queue = new NotificationQueue(sendTelegramMessage, {
  maxSize: config.QUEUE_MAX_SIZE,
  maxAttempts: config.MAX_ATTEMPTS,
  retryBaseMs: config.RETRY_BASE_MS,
  sendIntervalMs: config.SEND_INTERVAL_MS,
});

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();

// Se comparan los hashes para que timingSafeEqual reciba siempre buffers del
// mismo largo y no se filtre información por el tiempo de respuesta.
const requireApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const provided = req.header('x-api-key') ?? '';

  if (!timingSafeEqual(sha256(provided), sha256(config.NOTIFIER_API_KEY))) {
    res.status(401).json({ success: false, message: 'API key inválida' });
    return;
  }

  next();
};

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

// Sin autenticación: lo usa el healthcheck de Dokploy/Docker. Solo expone contadores.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', queueSize: queue.size, stats: queue.stats });
});

app.post('/v1/notifications', requireApiKey, (req, res) => {
  const { channel, text } = (req.body ?? {}) as { channel?: unknown; text?: unknown };

  if (typeof channel !== 'string' || !CHANNELS.includes(channel as Channel)) {
    res.status(400).json({ success: false, message: 'channel debe ser "public" o "admin"' });
    return;
  }

  if (typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ success: false, message: 'text es requerido' });
    return;
  }

  if (text.length > TELEGRAM_MAX_TEXT_LENGTH) {
    res.status(413).json({
      success: false,
      message: `text no puede superar ${TELEGRAM_MAX_TEXT_LENGTH} caracteres`,
    });
    return;
  }

  const id = queue.enqueue(channel as Channel, text);

  if (!id) {
    res.status(503).json({ success: false, message: 'Cola llena o servicio apagándose' });
    return;
  }

  // 202: aceptado, el envío real ocurre en segundo plano.
  res.status(202).json({ success: true, id });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'No encontrado' });
});

const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`📨 Notifier escuchando en el puerto ${config.PORT}`);

  for (const channel of CHANNELS) {
    const { botToken, chatId } = config.channels[channel];
    if (!botToken || !chatId) {
      console.warn(
        `[notifier] Canal "${channel}" sin bot token o chat ID: se descartarán sus mensajes`
      );
    }
  }
});

let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[notifier] ${signal} recibido: vaciando cola (máx. ${config.SHUTDOWN_DRAIN_MS} ms)`);
  server.close();

  const lost = await queue.drain(config.SHUTDOWN_DRAIN_MS);
  if (lost > 0) {
    console.warn(`[notifier] ${lost} mensaje(s) sin enviar al apagarse`);
  }

  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
