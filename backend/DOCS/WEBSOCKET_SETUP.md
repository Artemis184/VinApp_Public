# 🔔 Integración WebSocket para Control de Alarmas

## 📋 Resumen

Se ha reemplazado el endpoint REST `PATCH /nodes/:id/alarm/:state` con un sistema **WebSocket en tiempo real** que mantiene toda la arquitectura existente:

✅ **Auditoria de usuario** (audit_user_actions)  
✅ **Comunicación con maestro ESP8266** (192.168.4.30)  
✅ **Broadcast en tiempo real** a todos los clientes  
✅ **Validación de usuario y nodo**  
✅ **Sin romper REST administrativo existente**

---

## 🎯 Flujo Técnico Completo

```
Frontend (Cliente WebSocket)
    ↓ emit('node:alarm:set', {nodeId, state})
    ↓
Backend (Node.js + Socket.IO)
    ├─ 1️⃣ Verifica JWT del usuario
    ├─ 2️⃣ Valida que nodo exista y esté habilitado
    ├─ 3️⃣ Envía HTTP al maestro ESP8266 (192.168.4.30)
    │   └─ GET http://192.168.4.30/on?n=1  (o /off)
    ├─ 4️⃣ Registra en BD: audit_user_actions
    │   └─ action_type: ALARM_ON | ALARM_OFF
    │   └─ metadata: {action, source: 'websocket'}
    ├─ 5️⃣ Hace broadcast a TODOS los clientes
    │   └─ io.emit('node:alarm:state', {...})
    └─ 6️⃣ Responde al cliente con confirmación
        ↓
Maestro ESP8266 (192.168.4.30)
    └─ RF24 controla ON/OFF de nodos (1-5)
```

---

## 📂 Archivos Nuevos/Modificados

### Nuevos:

- **src/services/maestro.service.ts** - Comunicación HTTP con ESP8266
- **WEBSOCKET_CLIENT_EXAMPLE.ts** - Guía para el frontend

### Modificados:

- **src/middlewares/auditoria/userAudit.helper.ts** - Helper reutilizable para auditoría
- **src/Modules/nodes/nodeAlarm.service.ts** - Servicio de control de alarmas
- **src/sockets/nodeAlarm.socket.ts** - Handlers WebSocket
- **src/middlewares/verifyToken.ts** - Añadida función `verifyTokenSocket`
- **src/index.ts** - Inicialización de Socket.IO

---

## 🔧 Configuración

### Variables de Entorno

Añade a tu `.env` (opcional, con defaults):

```env
# Maestro ESP8266
MAESTRO_IP=192.168.4.30
MAESTRO_PORT=80
```

Si no los defines, usa los valores por defecto del código.

### Socket.IO - CORS

En `src/index.ts` está configurado para aceptar de cualquier origen:

```typescript
const io = new Server(httpServer, {
  cors: {
    origin: '*', // ⚠️ Cambiar según tu frontend en producción
    methods: ['GET', 'POST'],
  },
});
```

**Para producción**, especifica el origen del frontend:

```typescript
origin: 'https://tu-frontend.com';
```

---

## 📡 Eventos WebSocket

### Cliente → Servidor

#### `node:alarm:set`

```javascript
socket.emit('node:alarm:set', {
  nodeId: 1, // number (1-5)
  state: 'on', // 'on' | 'off'
  method: 'wifi', // opcional: 'rf' | 'wifi'
  wifiEndpoint: 'http://192.168.18.2/cmd', // opcional (solo wifi)
});
```

**Respuesta esperada:**

- ✅ Éxito: Se recibe evento `node:alarm:state` con el nuevo estado
- ❌ Error: Se recibe evento `node:error` con descripción

#### `node:alarm:state:subscribe` (opcional)

```javascript
socket.emit('node:alarm:state:subscribe', { nodeId: 1 });
```

Suscribirse a cambios de un nodo específico (optimiza tráfico).

#### `node:alarm:state:unsubscribe` (opcional)

```javascript
socket.emit('node:alarm:state:unsubscribe', { nodeId: 1 });
```

---

### Servidor → Cliente (Broadcast)

#### `node:alarm:state`

Se emite a **TODOS los clientes** cuando cambia una alarma:

```javascript
socket.on('node:alarm:state', (data) => {
  // {
  //   nodeId: 1,
  //   nodeCode: "NODE1",
  //   state: "on",
  //   timestamp: "2025-12-30T10:30:45.123Z",
  //   changedBy: "user-uuid-aqui"
  // }
});
```

#### `node:error`

Se emite cuando hay error:

```javascript
socket.on('node:error', (data) => {
  // {
  //   nodeId: 1,
  //   message: "Nodo desconectado",
  //   error: "..." (solo en desarrollo)
  // }
});
```

---

## 🔐 Autenticación

### Con el Backend

**Opción 1: Via auth en handshake**

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: localStorage.getItem('jwtToken'),
  },
});
```

**Opción 2: Via query params**

```javascript
const socket = io('http://localhost:3000', {
  query: {
    token: localStorage.getItem('jwtToken'),
  },
});
```

El servidor valida el JWT antes de permitir la conexión.

### Con el Maestro ESP8266

⚠️ **Actualmente sin autenticación** - El maestro es local en la red.

Si requieres proteger el maestro:

- Implementar autenticación en ESP8266
- Pasar credenciales en `maestro.service.ts`

---

## 📊 Auditoría

Cada acción queda registrada en `audit_user_actions`:

```sql
SELECT * FROM audit_user_actions
WHERE action_type IN ('ALARM_ON', 'ALARM_OFF')
ORDER BY action_timestamp DESC;
```

Columnas importantes:

- `user_id` - UUID del usuario
- `node_id` - ID del nodo (1-5)
- `action_type` - ALARM_ON | ALARM_OFF
- `action_timestamp` - Cuándo ocurrió
- `metadata` - JSON: `{action: "on|off", source: "websocket"}`

---

## 🧪 Prueba Rápida

### 1. Inicia el backend

```bash
npm run dev
```

Deberías ver:

```
🚀 Server is running on port 3000
📡 WebSocket disponible en ws://localhost:3000
```

### 2. Conectate desde el navegador (DevTools Console)

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'TU_JWT_AQUI' },
});

socket.on('connect', () => console.log('✅ Conectado'));
socket.on('node:alarm:state', (data) => console.log('🔔', data));
socket.on('node:error', (data) => console.log('❌', data));

// Enviar comando
socket.emit('node:alarm:set', { nodeId: 1, state: 'on' });
```

### 3. Verifica en el backend

```
✅ WebSocket conectado: [socket-id] - Usuario: [user-uuid]
📡 WebSocket [node:alarm:set] - Usuario: ..., Nodo: 1, Estado: on
✅ Alarma actualizada y broadcasted - Nodo: 1
📝 Auditoría registrada: Usuario ... - Nodo 1 - ON (websocket)
```

---

## ⚠️ Notas Importantes

### El maestro ESP8266

Código que espera:

```cpp
// GET http://192.168.4.30/on?n=1  → Enciende nodo 1
// GET http://192.168.4.30/off?n=1 → Apaga nodo 1
```

Si el servidor no responde en 5 segundos, se retorna error.

### Reconexión Automática

Socket.IO reintentalógicamente:

- Cada 1 segundo inicial
- Máximo cada 5 segundos
- Hasta 5 intentos (configurable)

Puedes cambiar en el cliente:

```javascript
const socket = io('http://localhost:3000', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});
```

### Sincronización de Estado

Todos los clientes conectados ven el cambio **instantáneamente**:

```
Cliente A → Envía 'node:alarm:set' (nodo 1, on)
    ↓
Backend → Procesa y hace broadcast
    ↓
Cliente A, B, C, D, ... → Reciben 'node:alarm:state'
```

No hay necesidad de recargar o polling.

---

## 🚀 Próximos Pasos

### Para el Frontend

1. **Instalar socket.io-client:**

```bash
npm install socket.io-client
```

2. **Crear hook React:**

```typescript
useAlarmSocket(token: string) → {
  nodeStates: Record<number, 'on' | 'off'>,
  setAlarm: (nodeId, state) => void,
  loading: boolean,
  error: string | null
}
```

3. **Ejemplo de uso:**

```typescript
function AlarmPanel() {
  const { nodeStates, setAlarm } = useAlarmSocket(jwtToken);

  return (
    <div>
      {[1,2,3,4,5].map(id => (
        <Switch
          key={id}
          checked={nodeStates[id] === 'on'}
          onChange={(val) => setAlarm(id, val ? 'on' : 'off')}
        />
      ))}
    </div>
  );
}
```

### Para el Backend

1. **Escalar con Redis (opcional):**

```typescript
const adapter = createAdapter(pubClient, subClient);
io.adapter(adapter);
```

Permite múltiples servidores compartir socket.io.

2. **Persistencia de estado (opcional):**

```typescript
// Guardar último estado conocido
await redis.set(`node:${nodeId}:state`, state);
```

3. **Logging avanzado (opcional):**

```typescript
// Implementar logger estructurado (Winston, Pino)
```

---

## 📖 Referencias

- [Socket.IO Docs](https://socket.io/docs/)
- [Socket.IO Client](https://socket.io/docs/v4/client-api/)
- [Prisma Docs](https://www.prisma.io/docs/)

---

**✅ Integración completada. ¡Tu sistema está listo para tiempo real!**
