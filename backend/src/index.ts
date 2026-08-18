import app from './app';
import { config } from './config';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyTokenSocket } from './middlewares/verifyToken';
import { startHeartbeatService } from './services/nodeHeartbeat.service';
import { oauth2Service } from './services/oauth2.service';
import { SessionCleanupService } from './services/session-cleanup.service';
import { WEBSOCKET_EVENTS, SESSION_REVOCATION_REASONS } from './constants/constants';
import { registerNodeAlarmSocket } from './sockets/nodeAlarm.socket';
import { ensureUploadDirectories } from './utils/uploads';
import { ACCESS_TOKEN_COOKIE_NAME, getCookieValueFromHeader } from './utils/authCookies';

import fs from 'fs';
import path from 'path';

const con = config;
ensureUploadDirectories();

// Crear servidor HTTP
const httpServer = createServer(app);

// Inicializar Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: config.CORS_ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Mapa de sockets activos por usuario (para session revocation)
const activeSockets = new Map<string, Map<string, Socket>>();

// Función para forzar desconexión de sockets al revocar sesión
export function forceDisconnect(userId: string, sessionId?: bigint) {
  const userSockets = activeSockets.get(userId);
  if (!userSockets) return;

  if (sessionId) {
    const socket = userSockets.get(String(sessionId));
    if (socket) {
      socket.emit(WEBSOCKET_EVENTS.SESSION_REVOKED, {
        reason: SESSION_REVOCATION_REASONS.SESSION_REVOKED,
        sessionId,
      });
      socket.disconnect(true);
      userSockets.delete(String(sessionId));

      // Si no hay más sockets para este usuario, eliminar el mapa
      if (userSockets.size === 0) {
        activeSockets.delete(userId);
      }
    }
  } else {
    // Revocar todas las sesiones del usuario
    for (const [, socket] of userSockets.entries()) {
      socket.emit(WEBSOCKET_EVENTS.SESSION_REVOKED, {
        reason: SESSION_REVOCATION_REASONS.SESSION_REVOKED,
      });
      socket.disconnect(true);
    }
    activeSockets.delete(userId);
  }
}

// Middleware de autenticación para WebSocket
io.use(async (socket, next) => {
  try {
    const tokenFromAuth = socket.handshake.auth?.token;
    const tokenFromCookie = getCookieValueFromHeader(
      socket.handshake.headers.cookie,
      ACCESS_TOKEN_COOKIE_NAME
    );
    const token = tokenFromAuth || tokenFromCookie;

    if (!token) {
      return next(new Error('Token no proporcionado'));
    }

    // Verificar token usando el mismo middleware de Express
    const user = await verifyTokenSocket(token);

    if (!user) {
      return next(new Error('Token inválido'));
    }

    // Almacenar usuario en socket.data
    socket.data.user = user;
    next();
  } catch (error: any) {
    console.error('❌ [Socket.IO Auth Error]:', error.message);
    next(new Error('Autenticación fallida'));
  }
});

// En la conexión del socket
io.on('connection', (socket) => {
  const userId = socket.data.user?.user_uuid;
  const sessionId = socket.data.user?.session_id;

  if (userId && sessionId) {
    const sessionIdStr = String(sessionId);

    if (!activeSockets.has(userId)) {
      activeSockets.set(userId, new Map());
    }

    const userSockets = activeSockets.get(userId)!;

    // Si ya existe un socket para esta sesión, desconectarlo
    if (userSockets.has(sessionIdStr)) {
      const oldSocket = userSockets.get(sessionIdStr);
      oldSocket?.disconnect(true);
    }

    userSockets.set(sessionIdStr, socket);

    // Registrar handlers de alarmas de nodos
    registerNodeAlarmSocket(io, socket);
  }

  socket.on('disconnect', () => {
    const userId = socket.data.user?.user_uuid;
    const sessionId = socket.data.user?.session_id;

    if (userId && sessionId) {
      const userSockets = activeSockets.get(userId);
      if (userSockets) {
        userSockets.delete(String(sessionId));
        if (userSockets.size === 0) {
          activeSockets.delete(userId);
        }
      }
    }
  });
});

//Crear carpetas de uploads si no existen
const createUploadFolders = () => {
  const basePath = path.join(process.cwd(), 'src/uploads');

  const folders = [basePath, path.join(basePath, 'nodes_images'), path.join(basePath, 'avatars')];

  folders.forEach((folder) => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      console.log('📂 Carpeta creada:', folder);
    }
  });
};

// Ejecutar creación antes de iniciar servidor
createUploadFolders();

// Iniciar servidor
httpServer.listen(con.PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server is running on port ${con.PORT}`);
  console.log(`📡 WebSocket disponible en ws://localhost:${con.PORT}`);

  // Verificar conexión OAuth2 Gmail
  try {
    const ok = await oauth2Service.verifyConnection();
    if (!ok) {
      console.error(
        '❌ Gmail OAuth2 NO está funcionando. Las notificaciones por correo electrónico no estarán disponibles.'
      );
    }
  } catch (error) {
    console.error(
      '❌ Error verificando OAuth2 Gmail. Las notificaciones por correo electrónico no estarán disponibles:',
      error
    );
  }
  // 💓 Iniciar servicio de heartbeat para monitoreo de nodos (si está habilitado)
  if (con.ENABLE_HEARTBEAT) {
    startHeartbeatService();
    console.log('💓 Servicio de heartbeat iniciado');
  } else {
    console.log('⚠️  Heartbeat deshabilitado (ENABLE_HEARTBEAT=false en .env)');
  }
  // Iniciar limpieza automática de sesiones (SIEMPRE)
  SessionCleanupService.start(60); // Cada 60 minutos
  console.log('🧹 Limpieza automática de sesiones iniciada');
});

// Exportar io para uso en otros módulos
export const getIO = () => io;
export { io };
