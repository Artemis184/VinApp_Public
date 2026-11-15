import axios from 'axios';
import { config } from '../config';

const LEGACY_TELEGRAM_API_TIMEOUT_MS = 5000;

type NotificationChannel = 'public' | 'admin';

interface TelegramDestination {
  botToken: string;
  chatId: string;
  name: string;
}

interface NodeState {
  id: number;
  name: string;
  code: string;
  is_online: boolean;
  is_alarm_on: boolean;
  is_enabled: boolean;
}

/**
 * Envío directo a Telegram desde el propio backend.
 *
 * MODO LEGADO: solo se usa si NOTIFIER_URL está vacío. La vía recomendada es el
 * servicio independiente `notifier/`, que mantiene los tokens de los bots y se
 * encarga de la cola y los reintentos sin afectar a este proceso.
 */
export async function notifyTelegram(
  message: string,
  destination: TelegramDestination
): Promise<boolean> {
  if (!destination.botToken || !destination.chatId) {
    console.warn(
      `[telegram] Notificación omitida para ${destination.name}: bot token y chat ID deben estar configurados.`
    );
    return false;
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${destination.botToken}/sendMessage`,
      {
        chat_id: destination.chatId,
        text: message,
      },
      { timeout: LEGACY_TELEGRAM_API_TIMEOUT_MS }
    );

    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `[telegram] Error enviando notificación (${error.response?.status ?? 'sin respuesta'}):`,
        error.message
      );
    } else {
      console.error('[telegram] Error enviando notificación:', error);
    }

    return false;
  }
}

/** Encola el mensaje en el servicio notifier. Nunca lanza. */
async function sendViaNotifier(channel: NotificationChannel, message: string): Promise<boolean> {
  if (!config.NOTIFIER_API_KEY) {
    console.warn('[notifier] NOTIFIER_URL está definido pero falta NOTIFIER_API_KEY: omitido.');
    return false;
  }

  try {
    await axios.post(
      `${config.NOTIFIER_URL}/v1/notifications`,
      { channel, text: message },
      {
        timeout: config.NOTIFIER_TIMEOUT_MS,
        headers: { 'x-api-key': config.NOTIFIER_API_KEY },
      }
    );

    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `[notifier] No se pudo encolar la notificación (${error.response?.status ?? error.code ?? 'sin respuesta'}):`,
        error.message
      );
    } else {
      console.error('[notifier] No se pudo encolar la notificación:', error);
    }

    return false;
  }
}

const LEGACY_DESTINATIONS: Record<NotificationChannel, () => TelegramDestination> = {
  public: () => ({
    botToken: config.TELEGRAM_PUBLIC_BOT_TOKEN,
    chatId: config.TELEGRAM_PUBLIC_CHAT_ID,
    name: 'público',
  }),
  admin: () => ({
    botToken: config.TELEGRAM_ADMIN_BOT_TOKEN,
    chatId: config.TELEGRAM_ADMIN_CHAT_ID,
    name: 'administración',
  }),
};

/**
 * Despacha una notificación sin bloquear a quien la pide: el envío corre en
 * segundo plano y cualquier fallo queda solo en el log. Así una caída de
 * Telegram o del notifier no frena el heartbeat ni las peticiones del backend.
 */
function dispatch(channel: NotificationChannel, message: string): void {
  const task = config.NOTIFIER_URL
    ? sendViaNotifier(channel, message)
    : notifyTelegram(message, LEGACY_DESTINATIONS[channel]());

  void task.catch((error) => {
    console.error('[notificaciones] Error inesperado al despachar:', error);
  });
}

export async function notifyNodeStateChange(
  node: NodeState,
  changed: { online?: boolean; alarm?: boolean; enabled?: boolean }
): Promise<void> {
  const stateLines = [
    `ALARMA ${node.id}`,
    `Conectividad: ${node.is_online ? 'CONECTADA' : 'DESCONECTADA'}`,
    `Alarma: ${node.is_alarm_on ? 'ENCENDIDA' : 'APAGADA'}`,
  ];

  const publicChanged = changed.online || changed.alarm;
  if (publicChanged) {
    dispatch('public', ['🔔 Cambio de estado de alarma', ...stateLines].join('\n'));
  }

  if (publicChanged || changed.enabled) {
    dispatch(
      'admin',
      [
        '🔐 Cambio de estado de administración',
        ...stateLines,
        `Habilitada: ${node.is_enabled ? 'SÍ' : 'NO'}`,
      ].join('\n')
    );
  }
}
