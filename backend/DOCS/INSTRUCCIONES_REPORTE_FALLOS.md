# 📡 INSTRUCCIONES: Reporte de Fallos RF24 → Backend

## ✅ Implementación Completada

### Backend (Ya implementado)

1. **Endpoint** [`/api/nodes/failure`](src/Modules/nodes/nodes.controller.ts)
   - ✅ Recibe reportes de fallos desde el Maestro Arduino
   - ✅ Actualiza `is_online = false` en la base de datos
   - ✅ Guarda `last_failure_at` con timestamp
   - ✅ Emite evento WebSocket `node:status:change`

2. **WebSocket** [`nodeAlarm.socket.ts`](src/sockets/nodeAlarm.socket.ts)
   - ✅ Escucha eventos de cambio de estado
   - ✅ Broadcast a todos los clientes conectados
   - ✅ Incluye detalles: nodeId, code, isOnline, reason

3. **Base de Datos**
   - ✅ Campo `is_online` (Boolean, default: true)
   - ✅ Campo `last_failure_at` (DateTime, nullable)

---

## 🔧 Pasos para Configurar el Arduino Maestro

### 1. Abrir el archivo [`ARDUINO_MAESTRO_CON_REPORTES.ino`](ARDUINO_MAESTRO_CON_REPORTES.ino)

### 2. Configurar las siguientes variables:

```cpp
// Línea 18-19: WiFi
const char* ssid = "TU_WIFI_SSID";
const char* password = "TU_WIFI_PASSWORD";

// Línea 24-26: Backend y API Key
const char* BACKEND_IP = "192.168.1.XXX";  // ⬅️ IP de tu PC donde corre el backend
const int BACKEND_PORT = 3005;
const char* API_KEY = "maestro-rf24-secret-key"; // 🔑 Debe coincidir con .env
```

### 3. Configurar el Backend (.env)

Asegúrate de que tu archivo `.env` contenga:

```env
ARDUINO_API_KEY=maestro-rf24-secret-key
```

⚠️ **IMPORTANTE**: El valor de `API_KEY` en Arduino debe ser **EXACTAMENTE** el mismo que `ARDUINO_API_KEY` en `.env`

### 4. Obtener la IP de tu PC:

**Windows PowerShell:**

```powershell
ipconfig | findstr IPv4
```

**Busca algo como:**

```
IPv4 Address. . . . . . . . . . : 192.168.1.100
```

⚠️ **IMPORTANTE**: Usa esa IP en `BACKEND_IP`

### 5. Subir el código al Arduino

1. Conecta el ESP8266 a tu PC
2. Abre Arduino IDE
3. Selecciona la placa: **NodeMCU 1.0 (ESP-12E Module)**
4. Selecciona el puerto COM correcto
5. Click en **Upload** (→)

### 6. Verificar en el Serial Monitor (115200 baud)

Deberías ver:

```
🔧 SETUP MAESTRO RF24 v2.0
================================
📶 Conectando WiFi... ✅
🔗 IP Local: 192.168.1.30
🔗 Backend: http://192.168.1.100:3005
🔑 API Key: maestro-rf24-secret-key
📡 Inicializando NRF24... ✅

🌐 Web Server iniciando...

✅ MAESTRO LISTO
================================
```

---

## 🧪 Prueba de Funcionamiento

### Escenario 1: Nodo Funcionando Correctamente

**Frontend → Backend → Maestro → Nodo Hijo**

```
# Backend Log:
🔔 SOCKET: node:alarm:set
   ↳ Nodo ID: 3
   ↳ Estado: on

📤 MAESTRO: Enviando comando
   ↳ URL: http://192.168.4.30:80/on?n=3
✅ MAESTRO: Respuesta 200
✅ Alarma actualizada: ALM-JC-0003-L4 → ON

# Arduino Log:
📤 ENVÍO - Nodo: 3, Comando: ON
  ↳ Intento 1/3...
  ✅ ACK recibido - Nodo respondió
```

---

### Escenario 2: Nodo Caído (SIN ACK)

**Frontend → Backend → Maestro → ❌ Nodo NO responde**

```
# Arduino Log:
📤 ENVÍO - Nodo: 3, Comando: ON
  ↳ Intento 1/3...
  ↳ Intento 2/3...
  ↳ Intento 3/3...
  ❌ Falló tras 3 intentos - Nodo no responde
  📡 Reportando fallo al backend...
     URL: http://192.168.1.100:3005/api/nodes/failure
     Payload: {"nodeId":3,"comando":"ON","intentos":3}
     ✅ Fallo reportado exitosamente

# Backend Log:
⚠️ NODO CAÍDO REPORTADO
   ↳ Nodo ID: 3
   ↳ Comando fallido: ON
   ↳ Intentos: 3
✅ Estado actualizado: ALM-JC-0003-L4 → OFFLINE

# Frontend (Console):
⚠️ Cambio de estado: {
  nodeId: 3,
  code: "ALM-JC-0003-L4",
  isOnline: false,
  timestamp: "2025-12-30T...",
  reason: "RF24_NO_ACK"
}
```

---

### Escenario 3: Nodo Recuperado (Vuelve a responder)

**Frontend → Backend → Maestro → ✅ Nodo RESPONDE**

```
# Arduino Log:
📤 ENVÍO - Nodo: 3, Comando: OFF
  ↳ Intento 1/3...
  ✅ ACK recibido - Nodo respondió
  📡 Reportando recuperación al backend...
     URL: http://192.168.1.100:3005/api/nodes/recovery
     Payload: {"nodeId":3,"comando":"OFF"}
     ✅ Recuperación reportada exitosamente

# Backend Log:
✅ NODO RECUPERADO
   ↳ Nodo ID: 3
   ↳ Comando exitoso: OFF
✅ Estado actualizado: ALM-JC-0003-L4 → ONLINE

# Frontend (Console):
✅ Cambio de estado: {
  nodeId: 3,
  code: "ALM-JC-0003-L4",
  isOnline: true,
  timestamp: "2025-12-30T...",
  reason: "RF24_ACK_RECEIVED"
}
```

---

### Escenario 4: Heartbeat Detecta Recuperación Automática

**Backend → Maestro → ✅ Nodo vuelve online sin interacción del usuario**

```
# Backend Log (cada 5 minutos):
💓 HEARTBEAT: Verificando estado de nodos...
   ↳ Nodos a verificar: 5
   ✅ ALM-JC-0003-L4: OFFLINE → ONLINE
✅ Heartbeat completado: 5 nodos verificados, 1 cambios detectados

# Arduino Log:
🏓 PING - Nodo: 3
  ✅ Nodo responde

# Frontend (Console):
✅ Cambio de estado: {
  nodeId: 3,
  code: "ALM-JC-0003-L4",
  isOnline: true,
  timestamp: "2025-12-30T...",
  reason: "HEARTBEAT_RECOVERED"
}
```

---

## 🔍 Debugging

### Problema: Arduino no reporta fallos

**Verificar:**

1. ✅ WiFi conectado (ver Serial Monitor)
2. ✅ IP del backend correcta
3. ✅ Backend corriendo en el puerto 3005
4. ✅ Firewall de Windows permite conexiones entrantes

**Comando para deshabilitar firewall temporalmente (PowerShell Admin):**

```powershell
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
```

⚠️ **Recuerda volver a habilitarlo después:**

```powershell
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

### Problema: Arduino recibe 401 Unauthorized

**Causa:** El API Key no coincide entre Arduino y Backend

**Solución:**

1. Verifica que `.env` contenga:

   ```env
   ARDUINO_API_KEY=maestro-rf24-secret-key
   ```

2. Verifica que el Arduino tenga:

   ```cpp
   const char* API_KEY = "maestro-rf24-secret-key";
   ```

3. Reinicia el backend:

   ```powershell
   # Ctrl + C para detener
   npm run dev
   ```

4. Reinicia el Arduino (botón reset)

### Problema: Backend no recibe el POST

**Verificar en Postman:**

```http
POST http://localhost:3005/api/nodes/failure
Content-Type: application/json
x-api-key: maestro-rf24-secret-key

{
  "nodeId": 3,
  "comando": "ON",
  "intentos": 3
}
```

**Respuesta esperada (200 OK):**

```json
{
  "success": true,
  "message": "Fallo registrado y notificado",
  "nodeId": 3,
  "code": "ALM-JC-0003-L4"
}
```

**Si recibes 401:**

```json
{
  "success": false,
  "error": "API Key inválida o faltante",
  "message": "Se requiere header x-api-key válido"
}
```

→ Revisa que el header `x-api-key` coincida con `ARDUINO_API_KEY` en `.env`

---

## 🎯 Resultado Final

Con esta implementación:

1. ✅ **Maestro detecta** cuando un nodo no responde (sin ACK después de 3 intentos)
2. ✅ **Reporta FALLO al backend** vía HTTP POST `/api/nodes/failure`
3. ✅ **Backend actualiza** estado `is_online = false` en BD
4. ✅ **WebSocket notifica** a todos los clientes conectados → Nodo OFFLINE
5. ✅ **Maestro detecta** cuando un nodo VUELVE a responder (recibe ACK)
6. ✅ **Reporta RECUPERACIÓN al backend** vía HTTP POST `/api/nodes/recovery`
7. ✅ **Backend actualiza** estado `is_online = true` en BD
8. ✅ **WebSocket notifica** a todos los clientes conectados → Nodo ONLINE
9. ✅ **Heartbeat periódico** verifica estado de todos los nodos cada 5 minutos
10. ✅ **Detección proactiva** de recuperaciones sin necesidad de activar nodo manualmente
11. ✅ **Auditoría registra** todos los fallos y recuperaciones con timestamp

---

## 📊 Flujo Completo

```
┌─────────────┐
│  Frontend   │
│  (Ionic)    │
└─────┬───────┘
      │ WebSocket: node:alarm:set
      │ {nodeId: 3, state: "on"}
      v
┌─────────────┐
│  Backend    │
│  (Node.js)  │
└─────┬───────┘
      │ HTTP GET: http://192.168.4.30/on?n=3
      v
┌─────────────┐
│  Maestro    │
│  (ESP8266)  │
└─────┬───────┘
      │ RF24: write(&pkt, sizeof(pkt))
      v
┌─────────────┐
│  Nodo Hijo  │ ❌ NO RESPONDE (SIN ACK)
│  (ESP8266)  │
└─────────────┘

      ❌ Fallo detectado
      │
      │ HTTP POST: /api/nodes/failure
      │ {nodeId: 3, comando: "ON", intentos: 3}
      v
┌─────────────┐
│  Backend    │
│  (Node.js)  │ → Actualiza BD: is_online = false
└─────┬───────┘
      │ WebSocket Broadcast: node:status:change
      v
┌─────────────┐
│  Frontend   │ → Muestra alerta: "Nodo 3 desconectado"
│  (Ionic)    │
└─────────────┘
```

---

## 📝 Logs de Referencia

### Formato de logs del Backend

```
⚠️ NODO CAÍDO REPORTADO
   ↳ Nodo ID: 3
   ↳ Comando fallido: ON
   ↳ Intentos: 3
✅ Estado actualizado: ALM-JC-0003-L4 → OFFLINE
```

### Formato de logs del Arduino

```
📤 ENVÍO - Nodo: 3, Comando: ON
  ↳ Intento 1/3...
  ↳ Intento 2/3...
  ↳ Intento 3/3...
  ❌ Falló tras 3 intentos - Nodo no responde
  📡 Reportando fallo al backend...
     URL: http://192.168.1.100:3005/api/nodes/failure
     Payload: {"nodeId":3,"comando":"ON","intentos":3}
     ✅ Fallo reportado exitosamente
```

---

## 🚀 ¡Listo para Producción!

El sistema ahora detecta y reporta automáticamente cuando un nodo hijo no está accesible.
