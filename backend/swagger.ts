import swaggerAutogen from 'swagger-autogen';

const doc = {
  info: {
    title: 'API Vinculación',
    version: '1.0.0',
    description: 'Documentación automática de todos los endpoints del sistema de vinculación',
  },
  host: 'localhost:3005',
  schemes: ['http'],
  consumes: ['application/json'],
  produces: ['application/json'],
  tags: [
    {
      name: 'Login',
      description: 'Endpoints de autenticación',
    },
    {
      name: 'Access',
      description: 'Endpoints de accesos',
    },
    {
      name: 'Users',
      description: 'Endpoints de usuarios',
    },
    {
      name: 'Roles',
      description: 'Endpoints de roles',
    },
    {
      name: 'User Roles',
      description: 'Endpoints de roles de usuario',
    },
    {
      name: 'Nodes',
      description: 'Endpoints de nodos',
    },
    {
      name: 'User Nodes',
      description: 'Endpoints de nodos de usuario',
    },
    {
      name: 'Audit User Actions',
      description: 'Endpoints de auditoría de acciones de usuarios',
    },
    {
      name: 'Audit Admin Actions',
      description: 'Endpoints de auditoría de acciones de administradores',
    },
    {
      name: 'Notifications',
      description: 'Endpoints de notificaciones',
    },
  ],
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
      description: 'Token JWT en formato: Bearer {token}',
    },
  },
  definitions: {
    User: {
      id: 1,
      nombre: 'Juan Pérez',
      email: 'juan@example.com',
      isActive: true,
    },
    Role: {
      id: 1,
      nombre: 'Administrador',
      descripcion: 'Rol con todos los permisos',
    },
    Node: {
      id: 1,
      nombre: 'Nodo Principal',
      descripcion: 'Descripción del nodo',
    },
    Notification: {
      id: 1,
      mensaje: 'Nueva notificación',
      leido: false,
      fecha: '2025-12-28T00:00:00.000Z',
    },
  },
};

const outputFile = './swagger-output.json';
const routes = ['./src/app.ts'];

swaggerAutogen()(outputFile, routes, doc).then(() => {
  console.log('✅ Documentación Swagger generada exitosamente en swagger-output.json');
});
