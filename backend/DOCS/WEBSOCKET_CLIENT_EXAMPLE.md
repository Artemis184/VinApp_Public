/\*\*

- EJEMPLO DE USO DEL WEBSOCKET PARA CONTROL DE ALARMAS
-
- Este archivo es un ejemplo para mostrar cómo el frontend
- debe conectarse y enviar comandos de control de alarmas
- a través de WebSocket.
  \*/

// ============================================
// 1️⃣ CONEXIÓN INICIAL
// ============================================

import io from 'socket.io-client';
import React from 'react';

// Obtener token JWT del localStorage o sessionStorage
const token = localStorage.getItem('jwtToken'); // Donde guardaste tu token de login

// Conectar al servidor WebSocket
const socket = io('http://localhost:3000', {
reconnection: true,
reconnectionDelay: 1000,
reconnectionDelayMax: 5000,
reconnectionAttempts: 5,
auth: {
token: token, // Enviar token en la autenticación
},
});

// ============================================
// 2️⃣ EVENTOS DE CONEXIÓN
// ============================================

// Cuando se conecta exitosamente
socket.on('connect', () => {
console.log('✅ WebSocket conectado');
});

// Si falla la autenticación
socket.on('connect_error', (error: any) => {
console.error('❌ Error de conexión:', error.message);
// Mostrar al usuario que debe re-autenticar
});

// Cuando se desconecta
socket.on('disconnect', () => {
console.log('🔌 WebSocket desconectado');
});

// ============================================
// 3️⃣ ENVIAR COMANDO DE ALARMA
// ============================================

/\*\*

- Cambiar estado ON/OFF de un nodo
- @param nodeId - ID del nodo (1-5)
- @param state - 'on' o 'off'
  \*/
  function setNodeAlarm(nodeId: number, state: 'on' | 'off') {
  socket.emit('node:alarm:set', {
  nodeId,
  state,
  });
  }

// Ejemplos de uso:
// setNodeAlarm(1, 'on'); // Encender nodo 1
// setNodeAlarm(2, 'off'); // Apagar nodo 2

// ============================================
// 4️⃣ ESCUCHAR CAMBIOS DE ESTADO
// ============================================

/\*\*

- Evento broadcasted cuando cualquier nodo cambia de estado
- Se recibe desde todos los clientes conectados
  \*/
  socket.on('node:alarm:state', (data: any) => {
  console.log('🔔 Estado de alarma actualizado:', data);
  // {
  // nodeId: 1,
  // nodeCode: "NODE1",
  // state: "on",
  // timestamp: "2025-12-30T10:30:45.123Z",
  // changedBy: "user-uuid-here"
  // }

// Aquí actualizar tu UI (cambiar color del switch, etc.)
updateAlarmUI(data.nodeId, data.state);
});

// ============================================
// 5️⃣ ESCUCHAR ERRORES
// ============================================

/\*\*

- Evento cuando ocurre un error en el servidor
  \*/
  socket.on('node:error', (data: any) => {
  console.error('❌ Error del servidor:', data.message);
  // {
  // nodeId: 1,
  // message: "Nodo desconectado",
  // error: "..." (solo en desarrollo)
  // }

// Mostrar error al usuario
showErrorNotification(data.message);
});

// ============================================
// 6️⃣ SUSCRIBIRSE A NODO ESPECÍFICO (OPCIONAL)
// ============================================

/\*\*

- Suscribirse a actualizaciones de un nodo específico
- (Útil para optimizar tráfico si hay muchos nodos)
  \*/
  function subscribeToNode(nodeId: number) {
  socket.emit('node:alarm:state:subscribe', { nodeId });
  }

// Desuscribirse
function unsubscribeFromNode(nodeId: number) {
socket.emit('node:alarm:state:unsubscribe', { nodeId });
}

// ============================================
// 7️⃣ EJEMPLO COMPLETO: SWITCH DE ALARMA
// ============================================

/\*\*

- Componente React de ejemplo para un switch de alarma
  \*/
  function AlarmSwitch({ nodeId }: { nodeId: number }) {
  const [isOn, setIsOn] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

// Escuchar cambios de este nodo
React.useEffect(() => {
subscribeToNode(nodeId);

    const handleAlarmChange = (data: any) => {
      if (data.nodeId === nodeId) {
        setIsOn(data.state === 'on');
        setLoading(false);
      }
    };

    const handleError = (data: any) => {
      if (data.nodeId === nodeId) {
        setError(data.message);
        setLoading(false);
      }
    };

    socket.on('node:alarm:state', handleAlarmChange);
    socket.on('node:error', handleError);

    return () => {
      socket.off('node:alarm:state', handleAlarmChange);
      socket.off('node:error', handleError);
      unsubscribeFromNode(nodeId);
    };

}, [nodeId]);

const handleToggle = async (newState: boolean) => {
setLoading(true);
setError(null);

    try {
      setNodeAlarm(nodeId, newState ? 'on' : 'off');
      // El estado se actualiza cuando recibimos el broadcast
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }

};

return (

<div className="alarm-switch">
<label>Nodo {nodeId}</label>
<input
type="checkbox"
checked={isOn}
onChange={(e) => handleToggle(e.target.checked)}
disabled={loading}
/>
{loading && <span>Cargando...</span>}
{error && <span className="error">{error}</span>}
</div>
);
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function updateAlarmUI(nodeId: number, state: string) {
// Encontrar el elemento del nodo y actualizar su estado
const element = document.getElementById(`node-${nodeId}`);
if (element) {
element.classList.toggle('active', state === 'on');
}
}

function showErrorNotification(message: string) {
// Mostrar notificación de error (usa tu librería de UI)
console.error('❌ Notificación:', message);
}

// ============================================
// NOTAS IMPORTANTES
// ============================================

/\*\*

- ✅ SEGURIDAD:
- - El token JWT se valida en el servidor
- - Solo usuarios autenticados pueden controlar alarmas
- - Cada acción se audita en la BD
-
- ✅ FLOW REAL:
- 1.  Usuario hace click en switch
- 2.  Frontend emite 'node:alarm:set'
- 3.  Backend valida usuario, nodo, estado
- 4.  Backend envía HTTP al maestro ESP8266 (192.168.4.30)
- 5.  Maestro controla RF24 y enciende/apaga nodo
- 6.  Backend registra en auditoría
- 7.  Backend hace broadcast 'node:alarm:state' a TODOS los clientes
- 8.  Todos ven el cambio en tiempo real
- 9.  Base de datos queda con registro de auditoría
-
- ✅ REINTENTO Y RECUPERACIÓN:
- - Socket.IO reconecta automáticamente si se cae
- - No pierdes mensajes si hay desconexión temporal
-
- ✅ PARA ESCALAR:
- - Puedes usar rooms (socket.join('node:1')) para filtrar broadcasts
- - Ver el código del handler para cómo se usa
    \*/
