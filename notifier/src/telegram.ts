import axios from 'axios';
import { config, type Channel } from './config';

export type SendResult =
  { ok: true } | { ok: false; retryable: boolean; retryAfterMs?: number; reason: string };

const DEFAULT_RATE_LIMIT_WAIT_S = 5;

/**
 * Envía un mensaje de texto por el bot del canal indicado.
 *
 * Nunca lanza: devuelve un resultado que indica si conviene reintentar.
 * Tampoco registra la URL ni el token (la URL de la API de Telegram lleva el
 * token del bot), solo el código HTTP o el código de error de red.
 */
export async function sendTelegramMessage(channel: Channel, text: string): Promise<SendResult> {
  const destination = config.channels[channel];

  if (!destination.botToken || !destination.chatId) {
    return {
      ok: false,
      retryable: false,
      reason: `canal "${channel}" sin bot token o chat ID configurados`,
    };
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${destination.botToken}/sendMessage`,
      { chat_id: destination.chatId, text },
      { timeout: config.TELEGRAM_TIMEOUT_MS }
    );
    return { ok: true };
  } catch (error) {
    if (!axios.isAxiosError(error)) {
      return { ok: false, retryable: false, reason: 'error inesperado al enviar' };
    }

    const status = error.response?.status;

    if (status === 429) {
      const retryAfter = Number(error.response?.data?.parameters?.retry_after);
      const waitSeconds =
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : DEFAULT_RATE_LIMIT_WAIT_S;
      return {
        ok: false,
        retryable: true,
        retryAfterMs: waitSeconds * 1000,
        reason: 'HTTP 429 (límite de Telegram)',
      };
    }

    // Sin respuesta (timeout, DNS, conexión caída) o error del lado de Telegram:
    // vale la pena reintentar. Un 4xx (token inválido, chat inexistente) no.
    if (status === undefined || status >= 500) {
      return {
        ok: false,
        retryable: true,
        reason: status === undefined ? `sin respuesta (${error.code ?? 'red'})` : `HTTP ${status}`,
      };
    }

    return { ok: false, retryable: false, reason: `HTTP ${status}` };
  }
}
