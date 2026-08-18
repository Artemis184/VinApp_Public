import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import crypto from 'crypto';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import loginRoutes from './Modules/login/login.routes';
import Access from './Modules/Access/Access.route';
import usersRoutes from './Modules/users/users.routes';
import rolesRoutes from './Modules/roles/roles.routes';
import userRolesRoutes from './Modules/user_roles/userRoles.routes';
import nodesRoutes from './Modules/nodes/nodes.routes';
import UserNodesRoutes from './Modules/user_nodes/user_nodes.routes';
import AuditUserActionesRoutes from './Modules/audit_user_actions/audit_user_actions.routes';
import AuditAdminActionsRoutes from './Modules/audit_admin_actions/audit_admin_actions.routes';
import NotificationsRoutes from './Modules/notifications/notifications.routes';
import passwordRecoveryRoutes from './Modules/password-recovery/password.routes';
import MenusRoutes from './Modules/Menus/Menus.routes';
import { swaggerDocsGuard } from './middlewares/swaggerDocsGuard';
import { globalRateLimiter } from './middlewares/globalRateLimit';
import { validateStateChangingOriginForSessionCookies } from './middlewares/originValidation';
import { config } from './config';

// Importar el archivo generado por swagger-autogen
const swaggerFile = require('../swagger-output.json');

const app = express();

// Required so req.ip reflects the real client IP behind a reverse proxy/load balancer.
app.set('trust proxy', 1);

app.use((req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const requestId = (Array.isArray(incoming) ? incoming[0] : incoming) || crypto.randomUUID();

  (req as express.Request & { requestId?: string }).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

app.use((req, res, next) => {
  const isSwaggerDocs = req.path.startsWith('/api-docs');
  const baseCspDirectives = [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ];

  const cspDirectives = isSwaggerDocs
    ? [
        ...baseCspDirectives,
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
      ]
    : [
        ...baseCspDirectives,
        "script-src 'self'",
        "form-action 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
      ];

  const cspValue = cspDirectives.join('; ');

  res.setHeader('Content-Security-Policy', cspValue);
  next();
});

/* =========================
   🔓 CORS (OBLIGATORIO)
========================= */
app.use(
  cors({
    origin: config.CORS_ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', config.CSRF_HEADER_NAME, 'X-Request-Id'],
    credentials: true,
  })
);

app.use(express.json({ limit: config.BODY_JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: config.BODY_URLENCODED_LIMIT }));
app.use(cookieParser());
app.use(validateStateChangingOriginForSessionCookies);
app.use(globalRateLimiter);

app.use('/uploads', express.static(path.join(process.cwd(), 'src', 'uploads')));

// Ruta de documentación Swagger
app.get('/api-docs/v1/openapi.json', swaggerDocsGuard, (req, res) => {
  res.json(swaggerFile);
});
app.use('/api-docs', swaggerDocsGuard, swaggerUi.serve, swaggerUi.setup(swaggerFile));

// ⚠️ RUTAS PÚBLICAS (sin JWT)
app.use('/api', loginRoutes);
app.use('/api', passwordRecoveryRoutes);
app.use('/api', MenusRoutes); // 🔓 Menus sin protección (los permisos se validan en frontend/BD)
app.use('/api/nodes', nodesRoutes); // 🔓 Permite /api/nodes/failure sin JWT (usa API Key interno)

// Rutas protegidas (cada ruta maneja su propio verifyToken)
app.use('/api', Access);
app.use('/api', usersRoutes);
app.use('/api', rolesRoutes);
app.use('/api', userRolesRoutes);
app.use('/api', UserNodesRoutes);
app.use('/api', AuditUserActionesRoutes);
app.use('/api', AuditAdminActionsRoutes);
app.use('/api', NotificationsRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: 'Endpoint not found',
  });
});

export default app;
