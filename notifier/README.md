# VinApp Notifier

Servicio independiente que envía las notificaciones de Telegram de VinApp. Vive
aparte del backend para que una caída o lentitud de Telegram **no afecte** al
heartbeat ni a las peticiones de la API.

```
Backend ──POST /v1/notifications──▶ Notifier ──▶ cola en memoria ──▶ API de Telegram
 (202 en ms, sin esperar a Telegram)             (1 envío cada ~1,1 s, reintentos)
```

- Los **tokens y chat IDs** de los bots viven solo aquí. El backend solo conoce
  `NOTIFIER_URL` y `NOTIFIER_API_KEY`.
- Cola en memoria con un worker: respeta el límite de Telegram (~1 msg/s por
  chat), reintenta con backoff exponencial los fallos transitorios (red, 5xx,
  429 con `retry_after`) y descarta los permanentes (token inválido, chat
  inexistente).
- **Limitación conocida:** la cola es en memoria. Si el contenedor se reinicia
  en seco, lo pendiente se pierde (en un apagado ordenado intenta vaciarla
  durante `SHUTDOWN_DRAIN_MS`). Para alertas de estado de nodos es aceptable; si
  luego hace falta garantía de entrega, se cambia la cola por Redis/Postgres sin
  tocar el contrato HTTP.

## API

`POST /v1/notifications` — header `x-api-key: <NOTIFIER_API_KEY>`

```json
{ "channel": "public", "text": "🔔 Cambio de estado de alarma\nALARMA 3 ..." }
```

| Código | Significado                                              |
| ------ | -------------------------------------------------------- |
| 202    | Aceptado y encolado (`{ "success": true, "id": "..." }`) |
| 400    | `channel` no es `public`/`admin`, o `text` vacío         |
| 401    | API key inválida                                         |
| 413    | `text` supera 4096 caracteres                            |
| 503    | Cola llena o servicio apagándose                         |

`GET /health` — sin autenticación (para el healthcheck): `{ status, queueSize, stats }`.

## Variables de entorno

Ver `.env.example`. Obligatoria: `NOTIFIER_API_KEY` (sin ella el servicio no
arranca). Genera una distinta por entorno: `openssl rand -hex 32`.

## Desarrollo local

```bash
cd notifier
cp .env.example .env      # completa NOTIFIER_API_KEY y los datos del bot
npm install
npm run dev               # http://localhost:4000

curl -i -X POST http://localhost:4000/v1/notifications \
  -H "x-api-key: $NOTIFIER_API_KEY" -H "Content-Type: application/json" \
  -d '{"channel":"admin","text":"prueba del notifier"}'
```

En el backend, define `NOTIFIER_URL=http://localhost:4000` y la misma
`NOTIFIER_API_KEY`.

## Despliegue en Dokploy

Una aplicación más por entorno, igual que el backend (ver
`docs/dokploy-environments.md`):

| App Dokploy            | Rama      | Build context | Dockerfile            | Puerto |
| ---------------------- | --------- | ------------- | --------------------- | ------ |
| `vinapp-notifier-prod` | `main`    | `notifier`    | `notifier/Dockerfile` | 4000   |
| `vinapp-notifier-test` | `testing` | `notifier`    | `notifier/Dockerfile` | 4000   |

1. Crea la app (Source = este repo, rama, build context `notifier`, Dockerfile `notifier/Dockerfile`).
2. En _Environment_ pega las variables de `notifier/.env.example` con los tokens
   reales de los bots y una `NOTIFIER_API_KEY` propia del entorno.
3. **No le asignes dominio público**: solo lo usa el backend por la red interna
   de Dokploy. Así no hace falta exponerlo en el Cloudflare Tunnel.
4. En el backend de ese entorno define `NOTIFIER_URL=http://<nombre-de-la-app>:4000`
   (por ejemplo `http://vinapp-notifier-prod:4000`; usa el nombre interno que
   te muestre Dokploy) y la misma `NOTIFIER_API_KEY`.
5. Una vez verificado que llegan los mensajes, **borra las variables
   `TELEGRAM_*` del backend**: ya no las usa y así los tokens quedan en un solo
   lugar.

> Rollback: vaciar `NOTIFIER_URL` en el backend devuelve el envío directo a
> Telegram (modo legado, requiere las variables `TELEGRAM_*`).
