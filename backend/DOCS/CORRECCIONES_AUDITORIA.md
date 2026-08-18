# Resumen de Correcciones de Auditoría

## Issues Corregidos (9/9)

### ✅ 1. Validación de Admin ID en userRoles.controller.ts

**Issue**: Usa `req.user?.user_uuid || ''` que puede fallar si req.user no existe
**Fix**: Removida la duplicación de auditoría. El servicio (`userRoles.service.ts`) ahora es responsable de la auditoría dentro de una transacción.

### ✅ 2. Extracción segura de IP en auditLogger.ts

**Issue**: `getClientIp()` prioriza `x-forwarded-for` directamente (spoofeable)
**Fix**: Cambiado a usar `req.ip` que respeta la configuración `trust proxy` de Express:

```typescript
export const getClientIp = (req: Request): string => {
  return req.ip || req.socket?.remoteAddress || 'unknown';
};
```

### ✅ 3. Duplicación de PrismaClient

**Issue**: Múltiples archivos crean `new PrismaClient()` innecesariamente
**Fix**: Implementado patrón singleton global en:

- `src/utils/auditLogger.ts` - Global `auditLoggerPrisma`
- `src/Modules/password-recovery/password.controller.ts` - Función `getPrisma()`

### ✅ 4. Validación de admin_id en logAdminAudit

**Issue**: Acepta strings vacíos que generan FK violations
**Fix**: Validación de admin_id no vacío antes de intentar auditoría:

```typescript
if (!admin_id || admin_id.trim() === '') {
  console.warn('Intento de auditoría sin admin_id válido');
  return;
}
```

### ✅ 5. Tipo de JSON sin validación en auditLogger.ts

**Issue**: Campos `old_value`, `new_value` tipados como `any`
**Fix**: Implementada función `validateJsonValue()` que serializa JSON antes de pasar a Prisma

### ✅ 6. Logs de DEBUG exponiendo PII en adminAudit.ts

**Issue**: `console.log()` de objetos auditados en producción
**Fix**: Todos los logs envueltos en validación de NODE_ENV:

```typescript
if (process.env.NODE_ENV !== 'production') {
  console.log('...');
}
```

### ✅ 7. Endpoint /postnotification sin autenticación

**Issue**: Permite a usuarios no autenticados forjar auditorías
**Fix**: Agregado middleware en `notifications.routes.ts`:

```typescript
router.post(
  '/postnotification',
  verifyToken,
  authorizeRoles(['Admin', 'SuperAdmin']),
  notificationsController.postNotification
);
```

### ✅ 8. Semántica incorrecta en notifications.controller.ts

**Issue**: Fallback audita como `NOTIFICATION_RECEIVED` cuando es un `SEND_NOTIFICATION`
**Fix**: Removido fallback a `logUserAudit`, solo se audita como admin:

```typescript
// Solo auditar si hay admin autenticado (asegurado por routes)
const adminId = req.user?.user_uuid;
if (adminId) {
  await logAdminAudit(adminId, 'SEND_NOTIFICATION', req, {...});
}
```

### ✅ 9. Migración de enums faltante en schema.prisma

**Issue**: Nuevos valores (SEND_NOTIFICATION, PASSWORD_CHANGED, etc.) no migrables en PostgreSQL
**Fix**:

- Creado archivo `ALTER_ENUMS.sql` con las ALTER TYPE correspondientes
- Script debe ejecutarse manualmente en DB antes de usar nuevos valores:

```sql
ALTER TYPE "admin_action_type" ADD VALUE 'SEND_NOTIFICATION';
ALTER TYPE "admin_action_type" ADD VALUE 'PASSWORD_RESET_REQUEST';
ALTER TYPE "user_action_type" ADD VALUE 'PASSWORD_CHANGED';
ALTER TYPE "user_action_type" ADD VALUE 'NOTIFICATION_RECEIVED';
```

## Archivos Modificados

1. **src/utils/auditLogger.ts** - Singleton Prisma, IP validation, JSON validation, ID validation
2. **src/Modules/notifications/notifications.controller.ts** - Removido fallback, solo admin audit
3. **src/Modules/notifications/notifications.routes.ts** - Agregado verifyToken + authorizeRoles
4. **src/Modules/user_roles/userRoles.controller.ts** - Removida auditoría duplicada
5. **src/Modules/password-recovery/password.controller.ts** - Singleton Prisma con getPrisma()
6. **src/middlewares/auditoria/adminAudit.ts** - Logs condicionados a NODE_ENV
7. **prisma/schema.prisma** - IP address columns, extended enums
8. **ALTER_ENUMS.sql** - (Nuevo) Migraciones manuales para enums

## Próximos Pasos

1. **Ejecutar migraciones de enums en PostgreSQL**:

   ```bash
   psql -U usuario -d base_datos -f ALTER_ENUMS.sql
   ```

2. **Regenerar cliente Prisma**:

   ```bash
   npx prisma generate
   ```

3. **Build y test**:

   ```bash
   npm run build
   npm run lint
   npm test  # Si hay tests
   ```

4. **Verificar funcionalidad**:
   - Asignar roles → verificar auditoría admin
   - Enviar notificaciones → verificar auditoría admin con IP
   - Reset contraseña → verificar auditoría user
   - Verificar IPs capturadas correctamente en DB
