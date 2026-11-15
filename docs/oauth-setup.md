# Configuracion OAuth de VinApp para Android y Web

## Estado auditado del repositorio

- No se encontro ningun `google-services.json` en el repositorio. Por tanto, no hay valores locales de `package_name`, `client_id` ni `certificate_hash` que reportar desde ese archivo.
- El applicationId configurado en `frontend/capacitor.config.ts` es `cloud.artemisnet.vinapp`.
- El client ID usado por Google Identity Services es:

  `TU_CLIENT_ID.apps.googleusercontent.com`

  Aparece en `frontend/src/environments/environment.ts` y `frontend/src/environments/environment.prod.ts`, y tambien en `frontend/.env`.
- `frontend/src/app/auth/login/login.page.ts` inicializa `google.accounts.id` con `client_id: environment.google.clientId`. La inicializacion de GIS web esta centralizada en `environment.google.clientId`; no hay otro client ID hardcodeado en `login.page.ts`, `capacitor.config.ts` ni `strings.xml`.
- Por su uso con Google Identity Services para el boton web, el client ID anterior es un **Web application OAuth client ID**. En la auditoria no aparecio un **Android OAuth client ID** ni un `google-services.json`.
- No se encontro una referencia fuente a `io.ionic.starter` en la configuracion actual de la app. Las coincidencias en directorios de build/IDE no sustituyen la configuracion fuente y deben regenerarse o limpiarse antes del release.

## 1. Crear el OAuth Client de Android en Google Cloud Console

Estas acciones deben ejecutarse manualmente en Google Cloud Console:

1. Abre `https://console.cloud.google.com/` y selecciona el proyecto que contiene el client ID web anterior.
2. Ve a **APIs y servicios > Pantalla de consentimiento de OAuth**. Confirma que la app este configurada y que el correo de soporte y los dominios autorizados sean los correctos.
3. Ve a **APIs y servicios > Credenciales**.
4. Pulsa **Crear credenciales > ID de cliente de OAuth**.
5. En **Tipo de aplicacion**, selecciona **Android**.
6. Introduce exactamente estos valores:
   - **Nombre**: `VinApp Android` (o un nombre equivalente identificable).
   - **Nombre del paquete**: `cloud.artemisnet.vinapp`.
   - **Huella digital del certificado SHA-1**: pega primero el SHA-1 del keystore de upload obtenido con el comando de la siguiente seccion.
7. Pulsa **Crear**.
8. Repite la creacion o edita/agrega la credencial para registrar tambien el SHA-1 del certificado de firma de Google Play App Signing, obtenido desde Play Console. El package name debe permanecer exactamente `cloud.artemisnet.vinapp`.
9. Conserva el Android Client ID generado. No lo confundas con el Web Client ID que ya usa `environment.google.clientId`.
10. Si Google Cloud Console muestra una credencial Android existente para `io.ionic.starter`, crea o actualiza una credencial para `cloud.artemisnet.vinapp`; cambiar el applicationId hace que la credencial anterior ya no corresponda.

> Google Cloud puede mostrar el SHA-1 como una sola cadena hexadecimal separada por dos puntos. Pegalo sin modificar, respetando todos los pares hexadecimales.

## 2. Extraer el SHA-1 del keystore de upload

Ejecuta este comando en PowerShell, sustituyendo los placeholders por la ruta real y el alias real del keystore de upload. No guardes la contrasena en el repositorio:

```powershell
keytool -list -v -keystore "C:\ruta\a\vinapp-upload.jks" -alias "ALIAS_DE_UPLOAD" | Select-String -Pattern "SHA1"
```

Si el keystore es PKCS12, añade `-storetype PKCS12`:

```powershell
keytool -list -v -storetype PKCS12 -keystore "C:\ruta\a\vinapp-upload.p12" -alias "ALIAS_DE_UPLOAD" | Select-String -Pattern "SHA1"
```

Cuando `keytool` solicite la contrasena, introducela directamente en la terminal. Registra ese resultado como **SHA-1 del certificado de upload**.

## 3. Obtener el SHA-1 de Play App Signing

Despues de crear la app en Play Console:

1. Abre **Play Console > selecciona VinApp > Probar y lanzar > Configuracion > Integridad de la app**. En algunas vistas aparece como **Release > Setup > App integrity**.
2. En **Certificado de clave de firma de la app**, localiza **Huella digital del certificado SHA-1**.
3. Copia esa huella y registrala en la credencial OAuth Android de Google Cloud con el mismo package name `cloud.artemisnet.vinapp`.
4. No uses para este campo el SHA-1 de **Certificado de clave de subida**: son certificados distintos.

Debes registrar ambos SHA-1 porque un APK/AAB instalado localmente y el APK que Google Play distribuye pueden estar firmados por certificados diferentes:

- El APK local firmado con tu keystore de upload usa el **SHA-1 de upload**.
- Google Play re-firma los APK entregados a usuarios con el **certificado de Play App Signing**, cuyo SHA-1 es el que aparece en Integridad de la app.

## 4. Por que puede funcionar localmente y fallar desde Play

Google valida la combinacion de package name y certificado de firma. Si solo registras el SHA-1 de upload, un APK local puede iniciar Google correctamente, pero el APK descargado desde Play llega firmado con el certificado de Play App Signing y no coincide con la credencial Android autorizada. El resultado habitual es un rechazo de OAuth o un error de configuracion de cliente. Registrar ambos SHA-1 evita que el cambio de certificado entre pruebas locales y distribucion de Play rompa el login.

El client ID web y el Android Client ID no se intercambian: el flujo web de GIS sigue usando el Web Client ID, mientras que la credencial Android debe coincidir con `cloud.artemisnet.vinapp` y sus certificados autorizados.

## Checklist manual de esta fase

- [ ] Confirmar el proyecto correcto en Google Cloud Console.
- [ ] Crear o verificar el OAuth Client Android con package name `cloud.artemisnet.vinapp`.
- [ ] Registrar el SHA-1 del keystore de upload.
- [ ] Crear la app en Play Console, si aun no existe.
- [ ] Copiar el SHA-1 de Play App Signing desde Integridad de la app.
- [ ] Registrar tambien ese SHA-1 en Google Cloud Console.
- [ ] Probar Google con un APK local firmado y, despues de publicar una prueba, con el APK instalado desde Play.
