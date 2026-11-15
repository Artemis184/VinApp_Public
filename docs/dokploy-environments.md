# VinApp — Entornos (producción / testing) en Dokploy

Guía para correr **dos entornos aislados** del monorepo sobre el mismo servidor
(tras CGNAT + Cloudflare Tunnel).

| | Producción | Testing |
|---|---|---|
| Front | `vinapp.artemisnet.cloud` | `testvinapp.artemisnet.cloud` |
| Back | `vinback.artemisnet.cloud` | `testvinback.artemisnet.cloud` |
| Rama | `main` | `testing` (o `develop`) |
| Base de datos | `VinApp` | `VinApp_test` (separada) |

Regla de oro: **nada se comparte** entre entornos salvo el servidor físico —
bases de datos, secretos (`JWT_SECRET`, `HMAC_SECRET`, `ARDUINO_API_KEY`) y apps
de Dokploy son independientes.

---

## 1. Estructura en Dokploy: 4 aplicaciones

Crea 4 aplicaciones (Dockerfile build) desde el mismo repo de GitHub:

| App Dokploy | Rama | Build context | Dockerfile | Puerto interno | Dominio |
|---|---|---|---|---|---|
| `vinapp-back-prod` | `main` | `backend` | `backend/Dockerfile` | 3000 | vinback.artemisnet.cloud |
| `vinapp-front-prod` | `main` | `frontend` | `frontend/Dockerfile` | 80 | vinapp.artemisnet.cloud |
| `vinapp-back-test` | `testing` | `backend` | `backend/Dockerfile` | 3000 | testvinback.artemisnet.cloud |
| `vinapp-front-test` | `testing` | `frontend` | `frontend/Dockerfile.test` | 80 | testvinapp.artemisnet.cloud |

> El backend usa **el mismo Dockerfile** en ambos entornos; lo que cambia son las
> variables de entorno. El frontend usa `Dockerfile` (build `production`) en prod
> y `Dockerfile.test` (build `test`, que aplica `environment.test.ts` →
> `testvinback`) en testing.

Para cada app: Source = este repo, selecciona la **rama** correspondiente, marca
el **build context** (subcarpeta) y el Dockerfile indicados arriba. Activa
*Auto Deploy* para que cada push a la rama redepliegue.

---

## 2. Variables de entorno

Pega las variables en cada app (Dokploy → app → *Environment*). Usa como
plantilla:

- Backend prod → `backend/.env.production.example`
- Backend testing → `backend/.env.test.example`

Diferencias que **sí o sí** cambian entre entornos:

- `DATABASE_URL` → base distinta por entorno.
- `JWT_SECRET`, `HMAC_SECRET`, `ARDUINO_API_KEY` → secretos distintos.
- `CORS_ALLOWED_ORIGINS` → `https://vinapp...` vs `https://testvinapp...`.
- `RUN_SEED` → `false` en prod (tras el primer deploy), `true` en testing.

Cookies (clave para la sesión persistente en Android), iguales en ambos:
```
AUTH_COOKIE_DOMAIN=.artemisnet.cloud
AUTH_COOKIE_SAMESITE=none
AUTH_COOKIE_SECURE=true
```
`Domain=.artemisnet.cloud` hace que la cookie valga para `vinapp`/`vinback` (y
`testvinapp`/`testvinback`). `SameSite=None; Secure` permite que el WebView de
Capacitor (origen `https://localhost`) las envíe a la API.

> El frontend no necesita variables en Dokploy si usas los `environment.*.ts`
> commiteados. Si prefieres inyectarlas en build, el script `generate-env.js`
> lee `API_URL`, `API_URL_TEST`, `WEB_URL*`, `GOOGLE_CLIENT_ID`, etc.

---

## 3. Base de datos

Crea **dos** bases Postgres (o dos servicios Postgres en Dokploy): una para prod
y otra para testing, y apunta cada `DATABASE_URL` a la suya.

Migraciones y seed los ejecuta el contenedor del backend al arrancar:
`prisma migrate deploy` (siempre) y `npm run seed:prod` (solo si `RUN_SEED != false`).

- **Prod**: primer deploy con `RUN_SEED=true` para sembrar roles/menús base;
  luego cambia a `RUN_SEED=false` y redepliega, para no re-sembrar en cada deploy.
- **Testing**: puedes dejar `RUN_SEED=true`.

---

## 4. Cloudflare Tunnel

En el tunnel, añade los 4 hostnames apuntando a cada servicio de Dokploy (al
puerto interno que expone el contenedor):

| Hostname | Service (Dokploy) |
|---|---|
| vinapp.artemisnet.cloud | http://vinapp-front-prod:80 |
| vinback.artemisnet.cloud | http://vinapp-back-prod:3000 |
| testvinapp.artemisnet.cloud | http://vinapp-front-test:80 |
| testvinback.artemisnet.cloud | http://vinapp-back-test:3000 |

(El nombre/puerto exacto depende de cómo Dokploy exponga cada app; usa el
dominio/puerto que te muestre Dokploy para cada una.)

---

## 5. Google OAuth

En Google Cloud Console, en el cliente OAuth:
- **Authorized JavaScript origins**: añade `https://testvinapp.artemisnet.cloud`
  (además del de prod).
- **Authorized redirect URIs**: añade los de testing si usas flujo redirect.

El `serverClientId` del build Android es el mismo; para la app nativa de testing
puedes usar el mismo client o uno dedicado.

---

## 6. Flujo de trabajo

1. Crea la rama `testing` desde `main`.
2. Trabajas/validas en `testing` → se despliega solo en los `*-test`.
3. Cuando está probado, merge `testing` → `main` (vía PR) → despliega prod.

---

## 7. Servicio de notificaciones (notifier)

Las alertas de Telegram las envía un servicio aparte (`notifier/`) para que una
caída de Telegram no afecte al backend. Es **una app más por entorno**
(`vinapp-notifier-prod` / `vinapp-notifier-test`, build context `notifier`,
Dockerfile `notifier/Dockerfile`, puerto 4000), **sin dominio público**: el
backend la alcanza por la red interna con `NOTIFIER_URL`.

Los tokens de Telegram van en las variables del notifier, no del backend. Detalle
completo en `notifier/README.md`.

---

## 8. Checklist de primer despliegue

- [ ] 2 bases Postgres creadas (prod/test).
- [ ] 4 apps en Dokploy con rama + Dockerfile + context correctos.
- [ ] Variables pegadas (desde los `.env.*.example`), con secretos distintos.
- [ ] `ARDUINO_API_KEY` definida en ambos backends (si falta, el maestro da 503).
- [ ] Cookies `SameSite=None; Secure; Domain=.artemisnet.cloud` en ambos backends.
- [ ] 4 hostnames en Cloudflare Tunnel.
- [ ] Orígenes de testing añadidos en Google OAuth.
- [ ] Notifier desplegado por entorno y `NOTIFIER_URL` / `NOTIFIER_API_KEY` en cada backend.
- [ ] Prod: primer deploy con `RUN_SEED=true`, luego `RUN_SEED=false`.
