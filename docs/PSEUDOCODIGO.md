# VinApp: pseudocódigo de los flujos principales

Este documento describe la arquitectura de VinApp con pseudocódigo, para que
puedas replicarla sin copiar el código tal cual. Los nombres de funciones y
módulos corresponden al código real del repositorio. Los valores sensibles se
leen siempre desde variables de entorno (ver `backend/.env.example`).

Componentes:

- **Frontend:** Angular + Ionic (web y Android con Capacitor).
- **Backend:** Express + TypeScript + Prisma (PostgreSQL) + Socket.IO.
- **Maestro:** dispositivo (Arduino) que se comunica con los nodos por RF24 o WiFi.
- **Notifier:** servicio independiente que envía los mensajes a Telegram.

---

## 1. Inicio de sesión con correo y contraseña

```
FUNCIÓN loginConCorreo(email, password, deviceId, deviceInfo):
    email  <- normalizar(email)              // quitar espacios, minúsculas
    usuario <- buscar usuario por email (sin distinguir mayúsculas)

    SI usuario no existe O no tiene hash de contraseña:
        LANZAR "Credenciales inválidas"
    SI usuario.estado != APROBADO:
        LANZAR "Usuario no aprobado"
    SI no compara(password, usuario.hashContraseña):   // bcrypt
        LANZAR "Credenciales inválidas"

    sesion <- crearSesionPersistente(usuario.id, deviceId, deviceInfo)
    accessToken <- firmarJWT({
        user_uuid, email, role, is_master,
        session_id: sesion.id, device_id: deviceId
    }, JWT_SECRET, expiración corta)

    actualizar usuario.ultimo_login = ahora
    DEVOLVER { accessToken, refreshToken: sesion.refreshToken, sesion, usuario }
```

## 2. Inicio de sesión con Google

```
FUNCIÓN loginConGoogle(idToken, deviceId, deviceInfo):
    datosGoogle <- verificarIdToken(idToken)     // valida firma y audiencia del Client ID
    email <- normalizar(datosGoogle.email)

    usuario <- buscar por email
    SI usuario no existe:
        crear usuario con estado PENDIENTE y rol CLIENTE
        marcar como recién creado
    SINO:
        completar google_id, nombre y foto solo si faltan

    SI usuario.estado == SUSPENDIDO:  LANZAR "cuenta suspendida" (403)
    SI usuario.estado != APROBADO:
        SI estaba PENDIENTE o acaba de crearse: enviar correo de estado (sin esperar)
        SI faltan datos personales: LANZAR "Completa tus datos personales"
        LANZAR "Cuenta pendiente de aprobación"

    DEVOLVER la misma respuesta que loginConCorreo (tokens + usuario)
```

## 3. Sesiones persistentes y rotación del refresh token

Principios: el refresh token nunca se guarda en texto plano, cada sesión está
atada a un dispositivo y cada uso lo rota.

```
FUNCIÓN crearSesionPersistente(usuarioId, deviceId, deviceInfo):
    SI deviceId es inválido (vacío o demasiado corto): LANZAR "deviceId inválido"

    refresh <- bytesAleatorios(32) en hexadecimal
    hash    <- HMAC_SHA256(refresh, HMAC_SECRET)   // HMAC_SECRET viene del entorno

    revocar sesiones activas previas de (usuarioId, deviceId)
    crear sesión { usuarioId, deviceId, deviceInfo, hash, expira = ahora + 180 días }
    DEVOLVER { refreshToken: refresh, sessionId }

FUNCIÓN verificarYRotarSesion(refreshRecibido, deviceId, metadatos):
    hash <- HMAC_SHA256(refreshRecibido, HMAC_SECRET)
    sesion <- buscar (hash, deviceId, no revocada, no expirada)
    SI no existe: DEVOLVER nulo

    SI metadatos existen:
        validar IP / user-agent contra deviceInfo guardado
        SI la validación falla: DEVOLVER nulo
        SI hay anomalías leves: registrar advertencia y actualizar deviceInfo

    nuevoRefresh <- bytesAleatorios(32)
    actualizar sesión: hash <- HMAC_SHA256(nuevoRefresh), último_uso <- ahora
    DEVOLVER { nuevoRefresh, sessionId, usuario }

FUNCIÓN registrarIntentoFallidoDeRefresh(deviceId, motivo, metadatos):
    incrementar contador de fallos de la última sesión del dispositivo
    SI el contador supera el límite: revocar la sesión (razón COMPROMETIDA)
```

## 4. Autenticación de cada petición (middleware `verifyToken`)

```
FUNCIÓN verifyToken(req, res, siguiente):
    token <- cookie de acceso
    SI no hay cookie:
        token <- cabecera "Authorization: Bearer ..."
        SI la petición viene de un navegador (cabecera Origin)
           Y el Bearer no está permitido en la configuración:
            token <- nulo

    SI token es nulo: RESPONDER 401 "Token requerido"

    payload <- verificarFirmaJWT(token, JWT_SECRET)
    SI expiró: RESPONDER 401 TOKEN_EXPIRED
    SI firma inválida: RESPONDER 401 INVALID_TOKEN

    SI la autenticación vino de cookie Y el método NO es GET/HEAD/OPTIONS:
        validar CSRF por doble envío (cookie CSRF == cabecera X-CSRF-Token)
        validar firma del token CSRF ligada a (session_id, device_id)
        SI falla cualquiera: RESPONDER 403

    sesión <- buscar sesión (session_id, usuario, no revocada, no expirada)
    SI no existe: RESPONDER 401
    usuario <- buscar usuario y su rol
    SI el usuario fue cambiado de contraseña después de emitir el token: RESPONDER 401

    req.user <- { user_uuid, email, role, is_master, ... }
    siguiente()

FUNCIÓN autorizarRoles(roles...):
    SI req.user.role no está en roles: RESPONDER 403
    siguiente()
```

## 5. Control de alarmas en tiempo real (Socket.IO)

```
AL CONECTAR un socket:
    token <- token del handshake
    usuario <- verificarJWT(token)   // mismas reglas que verifyToken
    socket.data.user <- usuario

EVENTO "node:alarm:set" (nodeId, estado, método?, endpointWifi?):
    SI no hay usuario: RESPONDER "No autenticado"
    SI estado no es "on" ni "off": RESPONDER "Estado inválido"

    privilegiado <- usuario es ADMIN o master
    SI NO privilegiado:
        verificar que el nodo esté asignado al usuario (user_nodes, no revocado)
        SI no está asignado: RESPONDER error

    resultado <- cambiarAlarma(nodeId, estado, método, endpointWifi)
    emitir a todos "node:alarm:updated" (nodeId, estado, método)
    responder al emisor "node:alarm:success"

EVENTO "node:states:request":
    nodos <- nodos habilitados
    SI NO privilegiado: filtrar a los nodos asignados al usuario
    responder con { nodeId, código, estado, en_línea }
```

## 6. Envío de comandos a los nodos

```
FUNCIÓN enviarComandoANodo(nodo, encender, opciones):
    método <- resolverMétodo(nodo, opciones.método)
    //   1. método pedido explícitamente
    //   2. método configurado en el nodo (rf | wifi)
    //   3. NODE_COMM_MODE del entorno (si es "auto", se decide por IP)

    SI método == "wifi":
        endpoint <- opciones.endpoint o nodo.ip o NODE_WIFI_ENDPOINT
        SI no hay endpoint: LANZAR error
        enviar POST /cmd { nodo, código, comando: 1|0, token: NODE_WIFI_SHARED_TOKEN }
        éxito <- respuesta HTTP 2xx Y (sin campo status O status == 1)
        DEVOLVER { éxito, método }

    SI método == "rf":
        DEVOLVER enviarAlMaestro(nodo.id, nodo.código, encender)
        // el maestro reenvía el paquete por RF24 con su token compartido

    ANTE CUALQUIER ERROR: DEVOLVER { éxito: falso, mensaje }
```

El token compartido del nodo nunca va en el código: se configura en
`NODE_WIFI_SHARED_TOKEN` (acepta decimal o hexadecimal).

## 7. Heartbeat (monitoreo de conectividad)

```
AL ARRANCAR el servidor:
    después de 10 s: ejecutar heartbeat
    cada HEARTBEAT_INTERVAL_MS: ejecutar heartbeat

FUNCIÓN heartbeat():
    nodos <- nodos habilitados
    PARA CADA nodo:
        enLinea <- pingNodo(nodo)          // RF o WiFi según el método del nodo
        SI enLinea != nodo.en_linea_anterior:
            actualizar nodo.en_linea y, si cayó, marcar última falla
            emitir "node:status:change" (motivo: HEARTBEAT_RECOVERY | HEARTBEAT_FAILURE)
            notificarCambioDeEstado(nodo)     // ver sección 8
        esperar 500 ms                        // evita saturar el maestro
```

## 8. Notificaciones (backend → notifier → Telegram)

El backend nunca debe conocer los tokens de Telegram cuando existe el notifier.

```
FUNCIÓN notificar(canal, texto):      // canal: "public" o "admin"
    SI NOTIFIER_URL está definido:
        POST {NOTIFIER_URL}/v1/notifications { canal, texto }
            con cabecera x-api-key: NOTIFIER_API_KEY
            tiempo máximo NOTIFIER_TIMEOUT_MS
        // si el notifier no responde, el error se registra y no bloquea la operación
    SINO (modo legado):
        enviar directo a la API de Telegram con los bots configurados

NOTIFIER (servicio independiente):
    POST /v1/notifications:
        1. validar x-api-key en tiempo constante (compara hashes SHA-256)
        2. validar canal (public | admin) y longitud máxima del texto
        3. encolar en memoria (si la cola está llena: responder 503)

    PROCESADOR de la cola (un mensaje a la vez):
        esperar SEND_INTERVAL_MS entre envíos (límite de Telegram)
        intentar enviar hasta MAX_ATTEMPTS veces
        entre reintentos: espera exponencial desde RETRY_BASE_MS, con tope de 5 minutos
        si Telegram responde 429: esperar retry_after
        si el error es permanente (token o chat inválido): descartar

    AL RECIBIR SIGTERM:
        dejar de aceptar mensajes
        vaciar la cola durante como máximo SHUTDOWN_DRAIN_MS
```

## 9. Variables de entorno (solo nombres)

| Área | Variables |
|---|---|
| Servidor y base de datos | `PORT`, `NODE_ENV`, `DATABASE_URL` |
| Seguridad | `JWT_SECRET`, `HMAC_SECRET`, `ARDUINO_API_KEY` |
| Sesiones y cookies | `ACCESS_TOKEN_COOKIE_NAME`, `REFRESH_TOKEN_COOKIE_NAME`, `CSRF_COOKIE_NAME`, `CSRF_HEADER_NAME`, `AUTH_COOKIE_*` |
| Maestro y nodos | `MAESTRO_IP`, `MAESTRO_PORT`, `NODE_COMM_MODE`, `NODE_WIFI_ENDPOINT`, `NODE_WIFI_SHARED_TOKEN` |
| Heartbeat | `ENABLE_HEARTBEAT`, `HEARTBEAT_INTERVAL_MS` |
| Google y correo | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_*`, `CORREO_ADMINISTRACION` |
| Notificaciones | `NOTIFIER_URL`, `NOTIFIER_API_KEY`, `NOTIFIER_TIMEOUT_MS` |
| Almacenamiento de imágenes (S3) | `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| Seed inicial | `SEED_MASTER_PASSWORD`, `SEED_ADMIN_PASSWORD`, `SEED_CLIENT_PASSWORD` |
