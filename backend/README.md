# 🛡️ Backend – VinApp Project

Backend of the system developed for the **VinApp project**, focused on node control, user management, roles, auditing, and notifications.
Built with **Node.js, Express, Prisma, and TypeScript**.

---

## 🚀 Technologies Used

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

## 📂 Project Structure

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

## ⚙️ Prerequisites

- Node.js v18 or higher
- PostgreSQL v13 or higher
- npm v9 or higher

---

## 🔐 Environment Variables

Create a `.env` file in the project root with the following content:

```env
PORT=3000
DATABASE_URL="postgresql://usuario:password@localhost:5432/VinApp?schema=public"
JWT_SECRET="change_me_jwt_secret"

# 🔑 HMAC Secret - Key used to hash refresh tokens
# Generate a secure random value in production
HMAC_SECRET="change_me_hmac_secret_random_value"

MAESTRO_IP=192.168.4.X
MAESTRO_PORT=80

# Method for communication with child nodes
# rf   -> uses the RF24 master (current behavior)
# wifi -> direct POST to child nodes via /cmd
# auto -> if rf_address looks like IP/URL use wifi; otherwise rf
NODE_COMM_MODE=rf

# Default WiFi endpoint for nodes (optional)
# If not defined, rf_address of the node is used as the host/url
NODE_WIFI_ENDPOINT=

# You can also store each node IP in the DB (field nodes.ip_address)
# Example: 192.168.18.2 or http://192.168.18.2

# Shared token for WiFi commands to child nodes
# Accepts decimal or hexadecimal (example: 0xA13F92C7)
NODE_WIFI_SHARED_TOKEN=0xCHANGE_ME

# 🔐 API Key for Arduino Maestro authentication
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

# Auth cookies (local development)
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

For production deployment, use explicit values for domain and cookie security:

```env
NODE_ENV=production
ACCESS_TOKEN_COOKIE_NAME=vin_access_token
REFRESH_TOKEN_COOKIE_NAME=vin_refresh_token
CSRF_COOKIE_NAME=vin_csrf_token
CSRF_HEADER_NAME=x-csrf-token
AUTH_COOKIE_DOMAIN=.your-domain.com

# If frontend and backend are on different domains, use none + secure=true
AUTH_COOKIE_SAMESITE=none
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_PRIORITY=high

# Rate limit for authentication endpoints
AUTH_RATE_LIMIT_WINDOW_MS=60000
AUTH_LOGIN_RATE_LIMIT_MAX=8
AUTH_REFRESH_RATE_LIMIT_MAX=10
```

---

## 🔐 Session and Token Management

### 📋 Overview

The system implements a **persistent session model** based on refresh tokens hashed with HMAC-SHA256. Sessions are bound to specific devices, which allows:

- Multiple simultaneous sessions per user (one per device)
- Granular revocation of specific sessions
- Mass revocation of all sessions for a user
- Automatic cleanup of expired and revoked sessions

### 🔐 HMAC Secret (`HMAC_SECRET`)

**Purpose:**
The `HMAC_SECRET` is a cryptographic key used to hash **refresh tokens** before storing them in the database. This adds another security layer:

1. **The token is never stored in plain text** – only the hash is saved
2. **If the DB is compromised**, tokens cannot be used directly
3. **Secure validation** – the server regenerates the hash and compares it

**HMAC flow:**

```
Refresh Token (generated)
        ↓
HMAC-SHA256(token, HMAC_SECRET)
        ↓
Hash (stored in DB)
        ↓
[Validation] Regenerate hash and compare
```

**Configuration:**

- **Development:** A default value is used (not secure)
- **Production:** Must be a random and secure value (minimum 32 characters)

**Generate a secure value:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 🔄 Session Revocation

The system provides two types of revocation:

#### 1. **Individual Revocation (Logout from one device)**

```typescript
// Revoke the session for a specific device
await SessionService.revokeDeviceSession(userId, deviceId);
```

**Behavior:**

- The session is marked as `is_revoked = true`
- The reason is recorded: `LOGOUT`
- The user WebSocket receives the event:

```javascript
{
  event: "session_revoked",
  reason: "SESSION_REVOKED",
  sessionId: <sessionId>
}
```

#### 2. **Mass Revocation (Close all sessions)**

```typescript
// Revoke all sessions for a user
await SessionService.revokeAllUserSessions(userId);
```

**Examples of use:**

- User changed password → Force reauthentication on all devices
- Account suspension → Disconnect immediately
- Suspicious activity → Close active sessions

**Behavior:**

- All non-expired sessions for the user are revoked
- WebSockets receive the event:

```javascript
{
  event: "session_revoked",
  reason: "ALL_SESSIONS_REVOKED"
}
```

### 📡 WebSocket Events

The event constants are defined in [src/constants/constants.ts](src/constants/constants.ts):

| Event             | Reason                 | Description                                     |
| ----------------- | ---------------------- | ----------------------------------------------- |
| `session_revoked` | `SESSION_REVOKED`      | A specific session was revoked                  |
| `session_revoked` | `ALL_SESSIONS_REVOKED` | All sessions for the user were revoked          |

**Client Integration:**
The client must listen for these events and:

1. Disconnect from the socket
2. Clear tokens from local storage
3. Redirect the user to the login page

### 🧹 Automatic Cleanup

The `SessionCleanupService` runs every **60 minutes** and:

1. Marks expired sessions as revoked
2. Permanently deletes revoked sessions older than 30 days

**Configuration:** [src/constants/constants.ts](src/constants/constants.ts)

```typescript
SESSION_CLEANUP_CONFIG = {
  REVOKED_SESSION_RETENTION_DAYS: 30,
};
```

---

## 📦 Project Installation

Install all dependencies:

```bash
npm install
```

---

## 📊 Prisma Initialization

### 1️⃣ Generate the Prisma client

```bash
npx prisma generate
```

### 2️⃣ Run migrations

```bash
npx prisma migrate dev
```

### 3️⃣ Run the seeds

```bash
npx prisma db seed
```

---

## 🏃 Running the Project

### 🔧 Development Mode

```bash
npm run dev
```

### 🏗️ Production Build

```bash
npm run build
```

### ▶️ Production Mode

```bash
npm run start
```

---

## 🧪 Available Scripts

| Script             | Description                                    |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Runs the server in development mode            |
| `npm run build`    | Compiles the project to JavaScript             |
| `npm run start`    | Runs the backend in production mode            |
| `npm run docs`     | Generates the Swagger API documentation        |
| `npm run lint`     | Analyzes code with ESLint                      |
| `npm run lint:fix` | Fixes lint issues automatically                |
| `npm run format`   | Formats the code with Prettier                 |

---

## 📚 API Documentation

The project includes automatic documentation generated with **Swagger**.

### Generate documentation

```bash
npm run docs
```

### View interactive documentation

Start the server and visit:

```
http://localhost:3005/api-docs
```

The documentation is generated automatically when running `npm run dev` or `npm run build`.

### Production: Swagger/OpenAPI restriction

In `NODE_ENV=production`, the docs route is protected to avoid **endpoint enumeration**:

- UI: `/api-docs`
- JSON: `/api-docs/v1/openapi.json`

Set these environment variables in production:

```env
# Protected by default in production (true). Disable only if absolutely necessary:
SWAGGER_DOCS_PROTECT=true

# Required Basic Auth credentials when SWAGGER_DOCS_PROTECT=true
SWAGGER_DOCS_BASIC_USER=admin_docs
SWAGGER_DOCS_BASIC_PASS=CHANGE_IN_PRODUCTION

# Optional: restrict to a specific IP address or CIDR range
SWAGGER_DOCS_ALLOWED_IPS=127.0.0.1,10.0.0.0/8
```

---

## 📊 Database

The system uses a PostgreSQL database managed with Prisma ORM.

**Main models:**

- `users`
- `roles`
- `nodes`
- `notifications`
- `audit_admin_actions`
- `audit_user_actions`
- `user_nodes`
- `user_roles`

It includes full auditing of user and administrator actions.

---

## 🔒 Security

- Password hashing with bcrypt
- Authentication with JWT
- Role and permission control
- System audit logging

---

## 📬 Email Delivery

Integration with Nodemailer for:

- System notifications
- User activation
- Credential recovery (in development)

---

## 🧹 Code Quality

This project uses:

- **ESLint v9** for code validation
- **Prettier** for automatic formatting
- Configuration compatible with TypeScript and Prisma

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
