# Guia de release Android para Google Play

## Requisitos

- Android SDK y Java configurados.
- Dependencias instaladas en `frontend`.
- Keystore de upload guardado fuera del repositorio.
- `frontend/android/keystore.properties` creado localmente. Este archivo esta excluido por Git.
- `versionCode` incrementado respecto al release anterior.

## 1. Crear el keystore de upload

Este comando es una plantilla. Sustituye los valores entre `<...>` y ejecutalo localmente; no lo ejecutes desde CI sin configurar un almacenamiento seguro de secretos:

```powershell
keytool -genkeypair -v -keystore "C:\ruta\segura\vinapp-upload.jks" -alias "<ALIAS_DE_UPLOAD>" -keyalg RSA -keysize 2048 -validity 10000 -storetype JKS -dname "CN=VinApp, OU=<UNIDAD>, O=<ORGANIZACION>, L=<CIUDAD>, ST=<PROVINCIA>, C=<PAIS>"
```

Conserva el archivo y sus contrasenas. La perdida del material de firma puede impedir futuras actualizaciones de la aplicacion.

## 2. Configurar `keystore.properties`

Copia `frontend/android/keystore.properties.example` como `frontend/android/keystore.properties` y completa los valores:

```properties
storeFile=C:/ruta/segura/vinapp-upload.jks
storePassword=<CONTRASENA_DEL_KEYSTORE>
keyAlias=<ALIAS_DE_UPLOAD>
keyPassword=<CONTRASENA_DE_LA_CLAVE>
```

En Windows es preferible usar `/` en `storeFile`, o escapar las barras invertidas. El archivo real no debe subirse al repositorio.

El Gradle del proyecto busca este archivo en `frontend/android/keystore.properties` y usa `signingConfigs.release` cuando las cuatro propiedades existen. Antes de generar el AAB, verifica que la ruta del keystore sea valida y que el alias corresponda al certificado de upload.

## 3. Incrementar la version

Antes de cada release aumenta `versionCode` en `frontend/android/app/build.gradle`:

```gradle
versionCode 2
versionName "1.1"
```

`versionCode` debe ser un entero mayor que el publicado anteriormente y nunca puede repetirse en Play Console. `versionName` es la version visible para los usuarios.

## 4. Generar el AAB para Play

Desde PowerShell, en la raiz del repositorio:

```powershell
npm run build --prefix frontend
Push-Location frontend/android
.\gradlew.bat bundleRelease
Pop-Location
```

El archivo que se debe subir a Google Play es:

```text
frontend/android/app/build/outputs/bundle/release/app-release.aab
```

El equivalente en macOS/Linux es:

```bash
npm run build --prefix frontend
cd frontend/android
./gradlew bundleRelease
```

`assembleRelease` genera un APK y no sustituye a `bundleRelease` para la publicacion normal en Play. El workflow actual no contiene un comando de release; solo ejecuta lint y formato.

## 5. Verificar que el AAB esta firmado

Puedes inspeccionar el certificado del keystore de upload con:

```powershell
keytool -list -v -keystore "C:\ruta\segura\vinapp-upload.jks" -alias "<ALIAS_DE_UPLOAD>" | Select-String -Pattern "Alias name|SHA1|SHA256"
```

Si `keystore.properties` falta o esta incompleto, el script Gradle no aplica la firma release y el artefacto no debe subirse a Play. Corrige la configuracion y vuelve a ejecutar `bundleRelease`.

## 6. Probar el AAB en un dispositivo fisico con bundletool

Descarga una version compatible de `bundletool` desde sus releases oficiales y guardala, por ejemplo, como `C:\tools\bundletool-all-1.17.2.jar`. Con el dispositivo conectado y autorizado por ADB, ejecuta:

```powershell
java -jar "C:\tools\bundletool-all-1.17.2.jar" build-apks --bundle="frontend/android/app/build/outputs/bundle/release/app-release.aab" --output="frontend/android/app/build/outputs/bundle/release/vinapp-release.apks" --mode=universal --ks="C:\ruta\segura\vinapp-upload.jks" --ks-key-alias="<ALIAS_DE_UPLOAD>" --ks-pass=pass:<CONTRASENA_DEL_KEYSTORE> --key-pass=pass:<CONTRASENA_DE_LA_CLAVE>
java -jar "C:\tools\bundletool-all-1.17.2.jar" install-apks --apks="frontend/android/app/build/outputs/bundle/release/vinapp-release.apks"
```

El comando `install-apks` instala el APK universal generado desde el AAB en el dispositivo conectado. No compartas el historial de PowerShell si contiene contrasenas; para un entorno automatizado usa un mecanismo seguro de secretos.

Prueba como minimo:

- Instalacion limpia y actualizacion sobre una version anterior.
- Login normal y login con Google.
- Renovacion de sesion y logout.
- Conexion WebSocket y notificaciones esperadas.
- Carga de avatar y permisos relacionados.
- Version instalada, package name `cloud.artemisnet.vinapp` y comportamiento en red movil.

## 7. Subir a Play Console

1. Abre Play Console y selecciona la aplicacion con package name `cloud.artemisnet.vinapp`.
2. Crea el track correspondiente, preferiblemente **Internal testing** para la primera prueba.
3. Sube `app-release.aab` desde `frontend/android/app/build/outputs/bundle/release/`.
4. Confirma que el `versionCode` sea mayor que el ultimo publicado.
5. Revisa errores de firma, permisos, politica y contenido.
6. Publica primero para testers y valida el login de Google con el certificado de Play App Signing.
7. Solo despues promueve el release al track de produccion.

El AAB puede ser firmado con el certificado de upload durante el proceso local, pero los APK que Google Play distribuye se firman con Play App Signing. Por eso el SHA-1 de Play App Signing debe estar registrado en Google Cloud Console junto al SHA-1 del keystore de upload, como se explica en [oauth-setup.md](oauth-setup.md).
