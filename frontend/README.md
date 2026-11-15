# � SmartVin – Frontend del Proyecto de Vinculación

Frontend del sistema desarrollado para el **Proyecto de Vinculación**, orientado al control de nodos, gestión de usuarios, roles, auditorías y notificaciones.  
Construido con **Ionic, Angular y Capacitor**.

---

## 🚀 Tecnologías Utilizadas

- Ionic Framework
- Angular
- TypeScript
- Capacitor
- RxJS
- Ionicons
- ESLint
- Angular CLI

---

## 📂 Estructura del Proyecto

```
src/
├── app/
│   ├── app.component.html
│   ├── app.component.scss
│   ├── app.component.ts
│   ├── app.routes.ts
│   └── home/
│       ├── home.page.html
│       ├── home.page.scss
│       ├── home.page.ts
│       └── home.page.spec.ts
├── assets/
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
├── global.scss
├── index.html
├── main.ts
├── polyfills.ts
├── test.ts
└── zone-flags.ts
angular.json
capacitor.config.ts
ionic.config.json
karma.conf.js
package.json
tsconfig.json
tsconfig.app.json
tsconfig.spec.json
README.md
```

---

## ⚙️ Requisitos Previos

- Node.js v18 o superior
- npm v9 o superior
- Ionic CLI (`npm install -g @ionic/cli`)

---

## 🔐 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
API_URL=http://localhost:3000/api
URL_LOGO=https://example.com/logo.png
API_TIMEOUT=60000
```

Los archivos de environment se generan automáticamente desde `.env` al ejecutar `npm start` o `npm run build`. No es necesario ejecutar comandos manuales.

---

## 📦 Instalación del Proyecto

Instala todas las dependencias:

```bash
npm install
```

---

## 🏃 Ejecución del Proyecto

### 🔧 Modo Desarrollo

```bash
npm start
# o
ionic serve
```

Esto iniciará el servidor de desarrollo en `http://localhost:8100`.

### 🏗️ Compilación a Producción

```bash
npm run build
# o
ionic build
```

### ▶️ Modo Producción

```bash
npm run build --prod
```

---

## 📱 Construcción para Móviles

### Android

```bash
ionic capacitor add android
ionic capacitor run android
```

### iOS

```bash
ionic capacitor add ios
ionic capacitor run ios
```

---

## 🧪 Scripts Disponibles

| Script             | Descripción                            |
| ------------------ | -------------------------------------- |
| `npm start`        | Ejecuta el servidor en modo desarrollo (Angular) |
| `ionic serve`    | Ejecuta el servidor en modo desarrollo (Ionic) |
| `npm run build`    | Compila el proyecto para producción    |
| `npm run watch`    | Compila y observa cambios              |
| `npm test`         | Ejecuta las pruebas unitarias          |
| `npm run lint`     | Analiza errores con ESLint             |
| `npm run format`   | Formatea el código con Prettier        |

---

## 🔒 Seguridad

- Integración con backend para autenticación JWT
- Control de roles y permisos
- Encriptación de datos sensibles

---

## 🧹 Calidad de Código

Este proyecto utiliza:

- **ESLint** para validación de código
- **Angular CLI** para herramientas de desarrollo
- Configuración compatible con TypeScript y Angular

**Flujo recomendado:**

```bash
npm run lint
npm start
```

---

## 👨‍💻 Autor

**ArtemisNet**  
Proyecto desarrollado para el sistema de seguridad y gestión de nodos del Proyecto de Vinculación.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **ISC**.
