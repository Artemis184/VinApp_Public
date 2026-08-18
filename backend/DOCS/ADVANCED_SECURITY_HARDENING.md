# Advanced Security Hardening - VinApp Auth

## 🔐 Nivel 3: Triple Defensa de Seguridad

### 1️⃣ **Device Metadata Binding** (Previene Token Reuse)

**Problema:** Un atacante roba el refresh token y lo usa desde otro dispositivo/IP.

**Solución:**

- Cada sesión guarda: `deviceId`, `IP`, `userAgent`, `failedRefreshAttempts`, `anomalyFlags`
- En `/refresh`, validamos que la solicitud venga del mismo dispositivo

**Ubicación en código:**

- Implementado en: `backend/src/services/session.service.ts`
- Flujo principal: `verifyAndRefreshSession()`

**Cómo funciona:**

```typescript
// En cada refresh, extraemos metadatos actuales
const deviceMetadata = {
  ip: req.ip, // 123.45.67.89
  userAgent: req.headers['user-agent'],
};

// Validamos contra almacenado
const validation = validateDeviceConsistency(
  currentMetadata, // Del request actual
  storedDeviceInfo // De la BD
);

// Detectamos anomalías
if (validation.anomalies.includes('ip_changed')) {
  console.warn(`⚠️ IP cambió de ${oldIp} a ${newIp}`);
  // Se registra pero NO bloquea (permite cambios legítimos)
}
```

**Respuesta del servidor:**

```json
{
  "device_info": {
    "deviceId": "abc123...",
    "ip": "123.45.67.89",
    "userAgent": "Mozilla/5.0...",
    "failedRefreshAttempts": 0,
    "ipChangeHistory": [{ "ip": "123.45.67.89", "timestamp": "2026-03-27T..." }],
    "anomalyFlags": ["ip_changed"] // Se acumulan últimas 10
  }
}
```

---

### 2️⃣ **CSRF Token Binding a Sesión** (Previene Falsificación)

**Problema:** CSRF tokens sin vinculación → pueden transferirse entre sesiones.

**Solución:**

- CSRF token es un JWT firmado: `base64(payload).signature`
- Payload contiene: `sessionId`, `deviceId`, `timestamp`, `nonce`
- Validación verifica firma + vinculación

**Ubicación en código:**

- Servicio: `backend/src/services/csrfBinding.service.ts`
- Integración: `backend/src/utils/authCookies.ts`, `backend/src/middlewares/verifyToken.ts`

**Cómo funciona:**

```typescript
// En login/refresh, generamos CSRF firmado
const { token } = CsrfBindingManager.generateSignedCsrfToken(
  sessionId: 'sess_12345',
  deviceId: 'device_abc'
);
// Retorna: 'base64_payload.hex_signature'

// En middleware, validamos:
const validation = CsrfBindingManager.validateSignedCsrfToken(
  csrfFromHeader,          // Del header X-CSRF-Token
  String(decoded.session_id),  // Del JWT
  decoded.device_id
);

if (!validation.valid) {
  // ❌ CSRF_TOKEN_INVALID (firma falsa o expirado)
  //    O sessionId/deviceId no coinciden
}
```

**Características:**

- Firma HMAC-SHA256 usando `HMAC_SECRET`
- TTL: 180 días (matching refresh token)
- Se regenera en cada refresh (rotación)

---

### 3️⃣ **Anomaly Detection** (Detección de Ataques)

**Problemas detectados:**

- ❌ Múltiples refresh fallidos → sesión revocada
- ⚠️ Cambios bruscos de IP
- ⚠️ Refresh demasiado rápido (< 2 seg)

**Ubicación en código:**

- Implementado actualmente en: `backend/src/services/session.service.ts`
- Se ejecuta automáticamente durante `verifyAndRefreshSession()` y `registerFailedRefreshAttempt()`

**Thresholds:**

| Anomalía                    | Threshold            | Acción                         |
| --------------------------- | -------------------- | ------------------------------ |
| **Failed Refresh Attempts** | ≥ 5 intentos         | 🔒 Revoke sesión (COMPROMISED) |
| **Rapid IP Changes**        | ≥ 3 cambios / 10 min | ⚠️ Log warning                 |
| **Refresh Too Rapid**       | < 2 segundos         | ⚠️ Flag (potencial bot)        |
| **Anomaly Flags**           | ≥ 5 flags acumulados | ⚠️ Considerar MFA              |

**Ejemplo de uso:**

```typescript
// En refresh fallido o inválido
const { sessionId, attempts, revoked } = await SessionService.registerFailedRefreshAttempt(
  deviceId,
  'INVALID_OR_EXPIRED_REFRESH_TOKEN',
  { ip: req.ip, userAgent: req.headers['user-agent'] || 'unknown' }
);

if (revoked) {
  console.warn(`[SECURITY] Session ${sessionId} revoked after ${attempts} failed refresh attempts`);
}
```

---

## 📋 Matriz de Validaciones

```
LOGIN (/login)
└─ Crear sesión con device_info (IP, userAgent)
└─ Generar CSRF token firmado
└─ Setear cookies HttpOnly (access + refresh) y cookie CSRF firmada
└─ Retornar JSON sin tokens crudos (solo metadata de sesión/usuario)

REFRESH (/refresh)
├─ Validar device_info:
│  ├─ ✅ deviceId exacto (ERROR si no coincide)
│  ├─ ⚠️ IP cambió (WARNING, registrar)
│  ├─ ⚠️ userAgent cambió (WARNING)
│  ├─ ❌ > 5 intentos fallidos (REVOKE sesión)
│  └─ ❌ > 3 cambios IP / 10 min (BLOCK)
├─ Validar CSRF firmado:
│  ├─ Verificar firma HMAC-SHA256
│  ├─ Validar vinculación a sessionId
│  └─ Validar vinculación a deviceId
├─ Generar nuevo refresh_token
├─ Regenerar CSRF token
└─ Setear cookies HttpOnly nuevas (access + refresh) y CSRF regenerado
└─ Retornar JSON sin tokens crudos (solo metadata de sesión/usuario)

PROTECTED REQUESTS (verifyToken)
├─ Extraer JWT del header/cookie
├─ Validar CSRF token (si cookie-based + POST/PUT/DELETE):
│  ├─ Firmar validación
│  ├─ Verificar sessionId binding
│  └─ Verificar deviceId binding
├─ Validar sesión activa:
│  ├─ No revocada
│  ├─ No expirada
│  └─ Sin password_changed_at posterior a iat
└─ ✅ Permitir request
```

---

## 🚀 Implementación paso a paso

### A. Device Metadata Binding

1. **Crear sesión:**

```typescript
// login.controller → login.service → SessionService.createPersistentSession()
const session = await SessionService.createPersistentSession(userId, deviceId, {
  // buildDeviceInfo() genera:
  version: '1.0',
  deviceId: 'mobile_xyz',
  userAgent: 'Mozilla/5.0...',
  ip: '123.45.67.89',
  userAgentHash: 'hash...',
  failedRefreshAttempts: 0,
  lastRefreshAt: '2026-03-27T...',
  anomalyFlags: [],
  firstSeenAt: '2026-03-27T...',
});
```

2. **En refresh:**

```typescript
// login.routes → login.service → SessionService.verifyAndRefreshSession()
const tokens = await refreshAccessToken(
  refreshToken,
  deviceId,
  { ip: req.ip, userAgent: req.headers['user-agent'] } // ← NUEVO
);
```

### B. CSRF Token Binding

1. **En login/refresh, generar CSRF firmado:**

```typescript
// authCookies.setCsrfCookie()
const { token } = CsrfBindingManager.generateSignedCsrfToken(
  String(sessionId), // ← Del JWT
  deviceId // ← Del body/JWT
);
// Guardar como cookie (httpOnly=false, lee el cliente)
```

2. **En middleware, validar:**

```typescript
// verifyToken.ts
const csrfValidation = CsrfBindingManager.validateSignedCsrfToken(
  csrfHeader, // X-CSRF-Token header
  String(decoded.session_id), // ← Del JWT decodificado
  decoded.device_id
);

if (!csrfValidation.valid) {
  return res.status(403).json({ reason: csrfValidation.reason });
}
```

### C. Anomaly Detection

1. **Tracking automático en device_info:**

```typescript
// session.service → verifyAndRefreshSession()
// Actualiza tras cada refresh exitoso:
{
  failedRefreshAttempts: 0,  // Reset en éxito
  lastRefreshAt: newDate,
  anomalyFlags: [...prevFlags, ...newAnomalies]
}
```

2. **En refresh fallido:**

```typescript
// Llamada automática en catch block
const { revoked } = await SessionService.registerFailedRefreshAttempt(
  deviceId,
  'invalid_device_id'
);
// Si revoked=true, sesión ya está revocada
```

---

## 🔍 Variables de Configuración

```env
# Para CSRF binding (ya existente)
HMAC_SECRET=tu_hmac_secret_aleatorio

# No requiere nuevas variables
# Los thresholds se aplican en session.service.ts
# Cambiar si es necesario:
# - MAX_FAILED_REFRESH_ATTEMPTS = 5
# - RAPID_IP_CHANGES_WINDOW_MINUTES = 10
# - MIN_SECONDS_BETWEEN_REFRESH = 2
```

---

## ✅ Validación en Requests

### Login exitoso:

```bash
POST /api/login
{
  "email": "user@example.com",
  "password": "secure123",
  "deviceId": "mobile_ios_abc123"
}

Response 200:
{
  "Login": true,
  "access_token_expires_at": 1711529400000,
  "user_uuid": "uuid...",
  "User_data": {...}
}

Cookies set:
- vin_access_token (HttpOnly, secure, sameSite configurable por entorno)
- vin_refresh_token (HttpOnly, secure, sameSite configurable por entorno)
- vin_csrf_token (HttpOnly=false, contiene payload firmado)

Headers in response:
- X-Request-Id: uuid
```

### Refresh exitoso:

```bash
POST /api/refresh
Body: { "deviceId": "mobile_ios_abc123" }
Cookies: vin_refresh_token (HttpOnly)

Response 200:
{
  "Login": true,
  "access_token_expires_at": 1711529450000,
  "user_uuid": "uuid...",
  "User_data": {...}
}

✅ Nuevo CSRF token regenerado en cookie
✅ Device metadata actualizado en BD
```

### Anomaly: Demasiados intentos fallidos:

```bash
POST /api/refresh (con deviceId incorrecto, 5+ intentos)

Response 401:
{
  "message": "Refresh token inválido o expirado"
}

BD:
- sessions.is_revoked = true
- sessions.revoke_reason = 'COMPROMISED'
- sessions.revoked_at = now()
```

### CSRF Validation en POST protegido:

```bash
POST /api/me/update
Headers:
- Authorization: Bearer eyJ...
- X-CSRF-Token: base64payload.signature

✅ Si token firmado, sessionId, deviceId coinciden → 200
❌ Si firma inválida → 403 CSRF_TOKEN_INVALID
❌ Si sessionId no coincide → 403 CSRF token inválido
```

---

## 🛡️ Resumen de Protecciones

| Amenaza                                | Mitigación                                   | Nivel  |
| -------------------------------------- | -------------------------------------------- | ------ |
| Token theft (transfer to other device) | Device metadata binding + refresh validation | 🔐🔐🔐 |
| CSRF attack (form forgery)             | Signed CSRF + sessionId/deviceId binding     | 🔐🔐🔐 |
| Brute force refresh                    | Failed attempt tracking + auto-revoke at 5   | 🔐🔐🔐 |
| IP jumping (proxy rotation)            | IP change history + rapid change detection   | 🔐🔐   |
| Token stuffing                         | Device validation + anomaly flags            | 🔐🔐   |
| Session reuse post-password-change     | Password_changed_at check + global revoke    | 🔐🔐🔐 |

---

## 📝 Testing Manual

### Test 1: Device metadata binding

```bash
# 1. Login desde IP 192.168.1.100
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123","deviceId":"phone123"}'

# 2. Extraer refresh_token de cookies
# 3. Simular request desde IP 192.168.1.101 (IP cambió)
curl -X POST http://localhost:3001/api/refresh \
  -H "X-Forwarded-For: 192.168.1.101" \
  -d '{"deviceId":"phone123"}'

# ✅ Debe permitir pero loguear: "[SECURITY] Device IP changed"
```

### Test 2: CSRF binding validation

```bash
# 1. Login normal
# 2. Extraer CSRF token de cookie

# 3. Intentar modificar usuario sin header CSRF
curl -X PUT http://localhost:3001/api/users/profile \
  -H "Content-Type: application/json" \
  -d '{"name":"newname"}'

# ❌ Debe retornar 403 CSRF_TOKEN_INVALID

# 4. Con header CSRF correcto
curl -X PUT http://localhost:3001/api/users/profile \
  -H "X-CSRF-Token: (token_de_cookie)" \
  -H "Content-Type: application/json" \
  -d '{"name":"newname"}'

# ✅ Debe permitir 200
```

### Test 3: Anomaly detection (brute force)

```bash
# 1. Login normal
# 2. Intentar refresh 6 veces con deviceId incorrecto
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/refresh \
    -d '{"deviceId":"wrongdevice"}'
done

# 5to intento: 401 "Refresh token inválido o expirado"
# 6to intento: TAMBIÉN 401 (sesión ya revocada)
# BD: sessions.is_revoked = true, revoke_reason = 'COMPROMISED'
```

---

## 🚨 Security Logs

### Log en anomaly:

```
[SECURITY] Device IP changed: old=192.168.1.100 new=192.168.1.101
[SECURITY] Device userAgent changed: old=Mozilla... new=Chrome...
[SECURITY] Rapid IP changes detected. sessionId=12345 changes=3
[SECURITY] Session 12345 revoked after 5 failed attempts
```

### Log en CSRF success/fail:

```
[SECURITY] CSRF validation failed: Invalid CSRF signature
[SECURITY] CSRF validation failed: CSRF sessionId mismatch
[SECURITY] CSRF validation failed: CSRF deviceId mismatch
```

---

## 🌐 Hardening Complementario (Avatares Externos)

**Riesgo:** SSRF y consumo excesivo de memoria al descargar imágenes externas.

**Mitigaciones implementadas en** `backend/src/Modules/users/users.service.ts`:

- Validación estricta de allowlist + HTTPS en URL inicial.
- Redirect handling manual (`redirect: 'manual'`) con validación de **cada salto** y tope de redirects.
- Corte temprano por `Content-Length` cuando excede `MAX_EXTERNAL_AVATAR_BYTES`.
- Lectura en streaming con límite duro de bytes y aborto de descarga si supera el máximo.

**Impacto:** evita seguir open-redirects a hosts no confiables y reduce riesgo de DoS por payloads grandes.

---

## 📦 Archivos Modificados

**Nuevos:**

- `backend/src/services/csrfBinding.service.ts` ← Signed CSRF tokens

**Modificados:**

- `backend/src/services/session.service.ts` → `verifyAndRefreshSession()` con device validation
- `backend/src/utils/authCookies.ts` → `setAuthCookies()` ahora incluye sessionId, deviceId
- `backend/src/middlewares/verifyToken.ts` → validación CSRF con binding
- `backend/src/Modules/login/login.routes.ts` → pase de metadata en refresh
- `backend/src/Modules/login/login.service.ts` → `refreshAccessToken()` con device metadata
- `backend/src/Modules/users/users.controller.ts` → login Google setea cookies con `sessionId` + `deviceId` para CSRF binding consistente
- `backend/src/Modules/users/users.service.ts` → descarga de avatar externo con redirects manuales, allowlist por salto y límite de tamaño en streaming

---

**Implementado (base):** `2026-03-27`  
**Última actualización:** `2026-04-18`  
**Estado:** ✅ Production-ready
