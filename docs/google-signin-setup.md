# Configuración de Google Sign-In para VinApp

Esta guía configura los clientes OAuth de Google para el login nativo de
Capacitor y el login web con Google Identity Services.

## 1. Crear el cliente Android

En [Google Cloud Console](https://console.cloud.google.com/), selecciona el
proyecto usado por VinApp y abre **APIs y servicios > Credenciales**.

1. Selecciona **Crear credenciales > ID de cliente de OAuth**.
2. En **Tipo de aplicación**, selecciona **Android**.
3. Introduce estos valores:

   - **Nombre:** `VinApp Android`
   - **Nombre del paquete:** `cloud.artemisnet.vinapp`
   - **Huella digital del certificado SHA-1:**
     `3E:B0:DA:BE:56:AB:BD:BC:41:BA:D0:5F:CF:45:F5:56:0F:F2:03:75`

4. Selecciona **Crear**.

Este ID de cliente Android solo se registra en Google Cloud Console. No lo
copies en el código de VinApp. El plugin usa el `serverClientId`, que es el
ID de cliente web configurado en `environment.google.clientId`.

## 2. Verificar el cliente web

En **APIs y servicios > Credenciales**, abre el **ID de cliente web** que usa
VinApp y revisa **Orígenes de JavaScript autorizados**. Debe contener estas
dos entradas, cada una como origen independiente:

- `https://vinapp.artemisnet.cloud`
- `https://localhost`

No añadas rutas como `/login` a estos valores. Los orígenes incluyen solo
protocolo, host y, cuando corresponda, puerto.

## 3. Certificado de Play App Signing

El SHA-1 usado para firmar el AAB localmente puede no ser el SHA-1 que usan
los usuarios al instalar desde Google Play.

1. Sube el AAB a **Play Console** y activa **Play App Signing** si todavía no
   está activo.
2. Abre **Play Console > tu aplicación > Pruebas o Producción > Integridad de
   la aplicación**.
3. En **Certificado de la clave de firma de la aplicación**, copia la huella
   **SHA-1** del certificado de firma de Google. No uses el certificado de
   carga salvo que coincida con el de firma de la aplicación.
4. Regresa a **Google Cloud Console > APIs y servicios > Credenciales** y crea
   un segundo **ID de cliente de OAuth > Android** con:

   - **Nombre del paquete:** `cloud.artemisnet.vinapp`
   - **SHA-1:** la huella copiada desde Play Console

5. Guarda ambos clientes Android: uno para el certificado usado en pruebas o
   distribución directa y otro para el certificado de firma de Play.

Google Play vuelve a firmar el APK/AAB para la distribución. Si no registras
el SHA-1 del certificado de Play, Google no reconoce la combinación de
paquete y certificado de las instalaciones descargadas desde Play y
`GoogleAuth.signIn()` falla aunque funcione en un APK instalado manualmente.

## 4. Comprobación final

1. Genera una compilación release y pruébala en un dispositivo físico.
2. Confirma en depuración que `GoogleAuth.signIn()` devuelve un objeto con
   `authentication.idToken` no nulo.
3. Confirma que el backend acepta ese `idToken` mediante el mismo endpoint de
   login de Google usado antes.
4. Ejecuta `ng serve` y verifica que aparece el botón oficial de Google
   Identity Services y que el login web continúa funcionando.

> Nota de compatibilidad: la versión publicada de
> `@codetrix-studio/capacitor-google-auth` declara `@capacitor/core ^6.0.0`,
> mientras VinApp usa Capacitor 7.5.0. La dependencia se instaló con
> `--legacy-peer-deps`; la compilación Android y la prueba en dispositivo son
> obligatorias antes de distribuir la aplicación.