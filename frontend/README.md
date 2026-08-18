# 🔷 SmartVin – Frontend of the VinApp Project

Frontend of the system developed for the **VinApp project**, focused on node control, user management, roles, auditing, and notifications.
Built with **Ionic, Angular, and Capacitor**.

---

## 🚀 Technologies Used

- Ionic Framework
- Angular
- TypeScript
- Capacitor
- RxJS
- Ionicons
- ESLint
- Angular CLI

---

## 📂 Project Structure

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

## ⚙️ Prerequisites

- Node.js v18 or higher
- npm v9 or higher
- Ionic CLI (`npm install -g @ionic/cli`)

---

## 🔐 Environment Variables

Create a `.env` file in the project root with the following content:

```env
API_URL=http://localhost:3000/api
URL_LOGO=https://example.com/logo.png
API_TIMEOUT=60000
```

Environment files are generated automatically from `.env` when running `npm start` or `npm run build`. No manual commands are required.

---

## 📦 Project Installation

Install all dependencies:

```bash
npm install
```

---

## 🏃 Running the Project

### 🔧 Development Mode

```bash
npm start
# or
ionic serve
```

This starts the development server at `http://localhost:8100`.

### 🏗️ Production Build

```bash
npm run build
# or
ionic build
```

### ▶️ Production Mode

```bash
npm run build --prod
```

---

## 📱 Mobile Builds

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

## 🧪 Available Scripts

| Script             | Description                                        |
| ------------------ | -------------------------------------------------- |
| `npm start`        | Runs the app in development mode (Angular)        |
| `ionic serve`      | Runs the app in development mode (Ionic)          |
| `npm run build`    | Builds the project for production                 |
| `npm run watch`    | Builds and watches for changes                    |
| `npm test`         | Runs unit tests                                    |
| `npm run lint`     | Runs ESLint checks                                 |
| `npm run format`   | Formats the code with Prettier                     |

---

## 🔒 Security

- Integration with backend for JWT authentication
- Role and permission management
- Encryption of sensitive data

---

## 🧹 Code Quality

This project uses:

- **ESLint** for code validation
- **Angular CLI** for development tooling
- Configuration compatible with TypeScript and Angular

**Recommended workflow:**

```bash
npm run lint
npm start
```

---

## 👨‍💻 Author

**ArtemisNet**  
Project developed for the security and node management system of the VinApp project, UPSE - 2026.

---

## 📄 License

This project is distributed under the **ISC** license.
