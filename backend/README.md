# 🛡️ Backend – Proyecto de Vinculación

Backend del sistema desarrollado para el **Proyecto de Vinculación**, orientado al control de nodos, gestión de usuarios, roles, auditorías y notificaciones.  
Construido con **Node.js, Express, Prisma y TypeScript**.

---

## 🚀 Tecnologías Utilizadas

- Node.js
- TypeScript
- Express
- Prisma ORM
- PostgreSQL
- JSON Web Token (JWT)
- Bcrypt
- Multer
- Nodemailer
- ESLint v9
- Prettier

---

## 📂 Estructura del Proyecto

```txt
src/
├── app.ts
├── index.ts
└── config.ts
prisma/
├── schema.prisma
├── seed.ts
└── seeds/
    └── initial.seed.ts
dist/
eslint.config.cjs
tsconfig.json
package.json
README.md
```

---

## ⚙️ Requisitos Previos

- Node.js v18 o superior
- PostgreSQL v13 o superior
- npm v9 o superior

---

## 🔐 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
PORT=3000
DATABASE_URL="postgresql://usuario:password@localhost:5432/VinApp?schema=public"
JWT_SECRET="change_me_jwt_secret"

# 🔑 HMAC Secret - Clave para hashear refresh tokens
# Genera un valor aleatorio seguro en producción
HMAC_SECRET="change_me_hmac_secret_random_value"

MAESTRO_IP=192.168.4.X
MAESTRO_PORT=80

# Método de comunicación con nodos hijos
# rf   -> usa maestro RF24 (comportamiento actual)
# wifi -> POST directo a nodos hijos vía /cmd
# auto -> si rf_address parece IP/URL usa wifi; caso contrario rf
NODE_COMM_MODE=rf

# Endpoint WiFi por defecto para nodos (opcional)
# Si no se define, se usa rf_address del nodo como host/url
NODE_WIFI_ENDPOINT=

# Para cada nodo también puedes guardar su IP en BD (campo nodes.ip_address)
# Ejemplo: 192.168.18.2 o http://192.168.18.2

# Token compartido para comandos WiFi a nodos hijos
# Acepta decimal o hexadecimal (ej: 0xA13F92C7)
NODE_WIFI_SHARED_TOKEN=0xCHANGE_ME

# 🔐 API Key para autenticación del Arduino Maestro
ARDUINO_API_KEY=change_me_arduino_api_key
ENABLE_HEARTBEAT=false
HEARTBEAT_INTERVAL_MS=60000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

GOOGLE_CLIENT_ID_EMAIL=
GOOGLE_CLIENT_SECRET_EMAIL=
GOOGLE_REDIRECT_URI_EMAIL=https://developers.google.com/oauthplayground

GMAIL_REFRESH_TOKEN=
GMAIL_ACCESS_TOKEN=

# Auth cookies (desarrollo local)
ACCESS_TOKEN_COOKIE_NAME=vin_access_token
REFRESH_TOKEN_COOKIE_NAME=vin_refresh_token
CSRF_COOKIE_NAME=vin_csrf_token
CSRF_HEADER_NAME=x-csrf-token
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_PRIORITY=high
AUTH_RATE_LIMIT_WINDOW_MS=60000
AUTH_LOGIN_RATE_LIMIT_MAX=8
AUTH_REFRESH_RATE_LIMIT_MAX=10
```

Para despliegue en producción, usa valores explícitos para dominio y seguridad de cookies:

```env
NODE_ENV=production
ACCESS_TOKEN_COOKIE_NAME=vin_access_token
REFRESH_TOKEN_COOKIE_NAME=vin_refresh_token
CSRF_COOKIE_NAME=vin_csrf_token
CSRF_HEADER_NAME=x-csrf-token
AUTH_COOKIE_DOMAIN=.tu-dominio.com

# Si frontend y backend están en dominios distintos, usa none + secure=true
AUTH_COOKIE_SAMESITE=none
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_PRIORITY=high

# Rate limit de endpoints de autenticación
AUTH_RATE_LIMIT_WINDOW_MS=60000
AUTH_LOGIN_RATE_LIMIT_MAX=8
AUTH_REFRESH_RATE_LIMIT_MAX=10
```

---

## 🔐 Gestión de Sesiones y Tokens

### 📋 Descripción General

El sistema implementa un **modelo de sesiones persistentes** basado en refresh tokens hasheados con HMAC-SHA256. Las sesiones están vinculadas a dispositivos específicos, lo que permite:

- Múltiples sesiones simultáneas por usuario (una por dispositivo)
- Revocación granular de sesiones específicas
- Revocación masiva de todas las sesiones de un usuario
- Limpieza automática de sesiones expiradas y revocadas

### 🔐 HMAC Secret (`HMAC_SECRET`)

**Propósito:**
El `HMAC_SECRET` es una clave criptográfica utilizada para hashear los **refresh tokens** antes de almacenarlos en la base de datos. Esto proporciona una capa adicional de seguridad:

1. **Nunca se almacena el token en texto plano** – Se guarda solo el hash
2. **Si la BD es comprometida**, los tokens no pueden ser utilizados directamente
3. **Validación segura** – El servidor regenera el hash y lo compara

**Flujo HMAC:**

```
Refresh Token (generado)
        ↓
HMAC-SHA256(token, HMAC_SECRET)
        ↓
Hash (se almacena en BD)
        ↓
[Validación] Regenerar hash y comparar
```

**Configuración:**

- **Desarrollo:** Se usa un valor por defecto (no seguro)
- **Producción:** Debe ser un valor aleatorio y seguro (mínimo 32 caracteres)

**Generar un valor seguro:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 🔄 Revocación de Sesiones

El sistema proporciona dos tipos de revocación:

#### 1. **Revocación Individual (Logout de un dispositivo)**

```typescript
// Revocar sesión de un dispositivo específico
await SessionService.revokeDeviceSession(userId, deviceId);
```

**Comportamiento:**

- Se marca la sesión como `is_revoked = true`
- Se registra la razón: `LOGOUT`
- El socket WebSocket del usuario recibe el evento:

```javascript
{
  event: "session_revoked",
  reason: "SESSION_REVOKED",
  sessionId: <sessionId>
}
```

#### 2. **Revocación Masiva (Cerrar todas las sesiones)**

```typescript
// Revocar todas las sesiones de un usuario
await SessionService.revokeAllUserSessions(userId);
```

**Ejemplos de uso:**

- Usuario cambió contraseña → Forzar re-autenticación en todos los dispositivos
- Suspensión de cuenta → Desconectar inmediatamente
- Actividad sospechosa → Cerrar sesiones activas

**Comportamiento:**

- Se revocan TODAS las sesiones no vencidas del usuario
- Los sockets WebSocket reciben el evento:

```javascript
{
  event: "session_revoked",
  reason: "ALL_SESSIONS_REVOKED"
}
```

### 📡 Eventos WebSocket

Las constantes de eventos se encuentran en [src/constants/constants.ts](src/constants/constants.ts):

| Evento            | Razón                  | Descripción                                     |
| ----------------- | ---------------------- | ----------------------------------------------- |
| `session_revoked` | `SESSION_REVOKED`      | Una sesión específica fue revocada              |
| `session_revoked` | `ALL_SESSIONS_REVOKED` | Todas las sesiones del usuario fueron revocadas |

**Integración Cliente:**
El cliente debe escuchar estos eventos y:

1. Desconectarse del socket
2. Limpiar tokens de almacenamiento local
3. Redirigir al usuario a la página de login

### 🧹 Limpieza Automática

El servicio `SessionCleanupService` ejecuta cada **60 minutos** y:

1. Marca sesiones expiradas como revocadas
2. Elimina permanentemente sesiones revocadas con más de 30 días

**Configuración:** [src/constants/constants.ts](src/constants/constants.ts)

```typescript
SESSION_CLEANUP_CONFIG = {
  REVOKED_SESSION_RETENTION_DAYS: 30,
};
```

---

## 📦 Instalación del Proyecto

Instala todas las dependencias:

```bash
npm install
```

---

## 📊 Inicialización de Prisma

### 1️⃣ Generar el cliente de Prisma

```bash
npx prisma generate
```

### 2️⃣ Ejecutar migraciones

```bash
npx prisma migrate dev
```

### 3️⃣ Ejecutar los seeds

```bash
npx prisma db seed
```

---

## 🏃 Ejecución del Proyecto

### 🔧 Modo Desarrollo

```bash
npm run dev
```

### 🏗️ Compilación a Producción

```bash
npm run build
```

### ▶️ Modo Producción

```bash
npm run start
```

---

## 🧪 Scripts Disponibles

| Script             | Descripción                               |
| ------------------ | ----------------------------------------- |
| `npm run dev`      | Ejecuta el servidor en modo desarrollo    |
| `npm run build`    | Compila el proyecto a JavaScript          |
| `npm run start`    | Ejecuta el backend en producción          |
| `npm run docs`     | Genera la documentación Swagger de la API |
| `npm run lint`     | Analiza errores con ESLint                |
| `npm run lint:fix` | Corrige errores automáticamente           |
| `npm run format`   | Formatea el código con Prettier           |

---

## � Documentación de la API

El proyecto incluye documentación automática generada con **Swagger**.

### Generar documentación

```bash
npm run docs
```

### Ver documentación interactiva

Inicia el servidor y visita:

```
http://localhost:3005/api-docs
```

La documentación se genera automáticamente al ejecutar `npm run dev` o `npm run build`.

### Producción: restricción de Swagger/OpenAPI

En `NODE_ENV=production` la ruta de docs se protege para evitar la **enumeración de endpoints**:

- UI: `/api-docs`
- JSON: `/api-docs/v1/openapi.json`

Configurar estas variables de entorno en producción:

```env
# Por defecto se protege en producción (true). Para desactivar (no recomendado):
SWAGGER_DOCS_PROTECT=true

# Credenciales Basic Auth obligatorias cuando SWAGGER_DOCS_PROTECT=true
SWAGGER_DOCS_BASIC_USER=admin_docs
SWAGGER_DOCS_BASIC_PASS=CAMBIAR_EN_PRODUCCION

# Opcional para una IP en especifico: lista separada por comas (IPs exactas o CIDR IPv4)
SWAGGER_DOCS_ALLOWED_IPS=127.0.0.1,10.0.0.0/8
```

---

## �📊 Base de Datos

El sistema utiliza una base de datos PostgreSQL administrada con Prisma ORM.

**Modelos principales:**

- `users`
- `roles`
- `nodes`
- `notifications`
- `audit_admin_actions`
- `audit_user_actions`
- `user_nodes`
- `user_roles`

Incluye auditoría completa de las acciones de usuarios y administradores.

---

## 🔒 Seguridad

- Encriptación de contraseñas con bcrypt
- Autenticación con JWT
- Control de roles y permisos
- Registro de auditorías del sistema

---

## 📬 Envío de Correos

Integración mediante Nodemailer para:

- Notificaciones del sistema
- Activación de usuarios
- Recuperación de credenciales (en desarrollo)

---

## 🧹 Calidad de Código

Este proyecto utiliza:

- **ESLint v9** para validación de código
- **Prettier** para formateo automático
- Configuración compatible con TypeScript y Prisma

**Flujo recomendado:**

```bash
npm run format
npm run lint:fix
npm run dev
```

---

## 👨‍💻 Autor

**ArtemisNet**  
Proyecto desarrollado para el sistema de seguridad y gestión de nodos del Proyecto de Vinculación UPSE - 2026.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **ISC**.
