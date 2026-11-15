import { randomUUID } from 'crypto';
import type { Channel } from './config';
import type { SendResult } from './telegram';

interface QueueItem {
  id: string;
  channel: Channel;
  text: string;
  attempts: number;
  notBefore: number;
}

export interface QueueOptions {
  maxSize: number;
  maxAttempts: number;
  retryBaseMs: number;
  sendIntervalMs: number;
}

export type SendFn = (channel: Channel, text: string) => Promise<SendResult>;

const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Cola en memoria con un único worker.
 *
 * - Un solo envío a la vez y separados por `sendIntervalMs`, para respetar el
 *   límite de Telegram (~1 mensaje/s por chat).
 * - Reintenta con backoff exponencial los fallos transitorios (red, 5xx, 429
 *   respetando `retry_after`). Los errores permanentes (4xx) se descartan.
 * - Limitación conocida: al ser en memoria, lo pendiente se pierde si el
 *   contenedor se reinicia (se intenta vaciar la cola en el apagado ordenado).
 */
export class NotificationQueue {
  private items: QueueItem[] = [];
  private timer: NodeJS.Timeout | null = null;
  private processing = false;
  private accepting = true;
  private pausedUntil = 0;
  private lastSentAt = 0;

  readonly stats = { accepted: 0, sent: 0, retried: 0, failed: 0, rejected: 0 };

  constructor(
    private readonly send: SendFn,
    private readonly options: QueueOptions
  ) {}

  get size(): number {
    return this.items.length;
  }

  get isIdle(): boolean {
    return this.items.length === 0 && !this.processing;
  }

  /** Devuelve el id del mensaje encolado, o null si no se aceptó. */
  enqueue(channel: Channel, text: string): string | null {
    if (!this.accepting || this.items.length >= this.options.maxSize) {
      this.stats.rejected++;
      return null;
    }

    const id = randomUUID();
    this.items.push({ id, channel, text, attempts: 0, notBefore: 0 });
    this.stats.accepted++;
    this.scheduleNext();
    return id;
  }

  /** Deja de aceptar mensajes y espera a vaciar lo pendiente (hasta timeoutMs). */
  async drain(timeoutMs: number): Promise<number> {
    this.accepting = false;
    const deadline = Date.now() + timeoutMs;

    while (!this.isIdle && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const lost = this.items.length;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    return lost;
  }

  private readyAt(item: QueueItem): number {
    return Math.max(item.notBefore, this.pausedUntil);
  }

  private scheduleNext(): void {
    if (this.processing || this.items.length === 0) return;

    const now = Date.now();
    const earliestReady = Math.min(...this.items.map((item) => this.readyAt(item)));
    const delay = Math.max(
      earliestReady - now,
      this.lastSentAt + this.options.sendIntervalMs - now,
      0
    );

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), delay);
  }

  private async tick(): Promise<void> {
    this.timer = null;
    if (this.processing) return;
    this.processing = true;

    try {
      const now = Date.now();
      const index = this.items.findIndex((item) => this.readyAt(item) <= now);
      if (index === -1) return;

      const [item] = this.items.splice(index, 1);
      item.attempts++;
      this.lastSentAt = Date.now();

      const result = await this.send(item.channel, item.text);

      if (result.ok) {
        this.stats.sent++;
        return;
      }

      if (result.retryable && item.attempts < this.options.maxAttempts) {
        const backoff = Math.min(
          this.options.retryBaseMs * 2 ** (item.attempts - 1) + Math.floor(Math.random() * 500),
          MAX_BACKOFF_MS
        );
        item.notBefore = Date.now() + (result.retryAfterMs ?? backoff);
        if (result.retryAfterMs) {
          this.pausedUntil = Math.max(this.pausedUntil, item.notBefore);
        }
        this.items.push(item);
        this.stats.retried++;
        console.warn(
          `[notifier] ${item.channel} ${item.id}: ${result.reason}; reintento ${item.attempts}/${this.options.maxAttempts}`
        );
        return;
      }

      this.stats.failed++;
      console.error(
        `[notifier] ${item.channel} ${item.id}: descartado tras ${item.attempts} intento(s): ${result.reason}`
      );
    } finally {
      this.processing = false;
      this.scheduleNext();
    }
  }
}
