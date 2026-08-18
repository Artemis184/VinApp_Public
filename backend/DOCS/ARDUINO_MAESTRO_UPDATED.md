# 🔌 Código Actualizado para Arduino Maestro RF24

Este archivo contiene el código actualizado para el Arduino Maestro que reporta fallos de nodos al backend.

## 📋 Cambios Implementados

1. **Detección de fallos RF24**: Cuando un nodo no responde (sin ACK)
2. **Reporte automático al backend**: Envía POST a `/api/nodes/failure`
3. **Notificación WebSocket**: El backend notifica a todos los clientes conectados

---

## 🔧 Código Arduino Maestro

### Variables de Configuración

```cpp
// Configuración WiFi
const char* WIFI_SSID = "TuSSID";
const char* WIFI_PASSWORD = "TuPassword";

// Configuración Backend
const char* BACKEND_IP = "192.168.4.2";  // IP de tu backend
const int BACKEND_PORT = 4000;           // Puerto de tu backend

// Configuración RF24
RF24 radio(7, 8); // CE, CSN
```

### Función Principal: enviarComando()

```cpp
void enviarComando(uint8_t nodo, bool estado) {
  const char* comando = estado ? "ON" : "OFF";
  bool exito = false;

  Serial.printf("\n📤 ENVÍO - Nodo: %d, Comando: %s\n", nodo, comando);

  // Intentar 3 veces
  for (int i = 1; i <= 3; i++) {
    Serial.printf("  ↳ Intento %d/3...\n", i);

    if (radio.write(&estado, sizeof(estado))) {
      Serial.println("  ✅ ACK recibido");
      exito = true;
      break;
    }
    delay(100);
  }

  if (!exito) {
    Serial.println("  ❌ Falló tras 3 intentos");
    // 🆕 REPORTAR FALLO AL BACKEND
    reportarFalloNodo(nodo, comando);
  }
}
```

### Nueva Función: reportarFalloNodo()

```cpp
/**
 * Reporta al backend cuando un nodo no responde
 *
 * @param nodo - Número del nodo (1-5)
 * @param comando - Comando que falló ("ON" o "OFF")
 */
void reportarFalloNodo(uint8_t nodo, const char* comando) {
  // Verificar WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("  ⚠️ WiFi desconectado, no se puede reportar");
    return;
  }

  HTTPClient http;

  // Construir URL
  String url = "http://" + String(BACKEND_IP) + ":" + String(BACKEND_PORT) + "/api/nodes/failure";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Construir JSON payload
  String payload = "{";
  payload += "\"nodeId\":" + String(nodo) + ",";
  payload += "\"comando\":\"" + String(comando) + "\",";
  payload += "\"intentos\":3";
  payload += "}";

  Serial.println("  📡 Reportando fallo al backend...");
  Serial.println("     URL: " + url);
  Serial.println("     Payload: " + payload);

  // Enviar POST
  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.printf("     HTTP Response: %d\n", httpCode);

    if (httpCode == 200) {
      String response = http.getString();
      Serial.println("  ✅ Fallo reportado exitosamente");
      Serial.println("     Response: " + response);
    } else {
      Serial.printf("  ⚠️ Backend respondió con código: %d\n", httpCode);
    }
  } else {
    Serial.printf("  ❌ Error HTTP: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}
```

### Servidor Web (Recepción de Comandos HTTP)

```cpp
void handleOnCommand() {
  if (!server.hasArg("n")) {
    server.send(400, "text/plain", "Parámetro 'n' faltante");
    return;
  }

  uint8_t nodo = server.arg("n").toInt();

  if (nodo < 1 || nodo > 5) {
    server.send(400, "text/plain", "Nodo inválido (1-5)");
    return;
  }

  // Cambiar canal RF24 según nodo
  radio.openWritingPipe(nodo);

  // Enviar comando
  enviarComando(nodo, true); // ON

  server.send(200, "text/plain", "Comando ON enviado a nodo " + String(nodo));
}

void handleOffCommand() {
  if (!server.hasArg("n")) {
    server.send(400, "text/plain", "Parámetro 'n' faltante");
    return;
  }

  uint8_t nodo = server.arg("n").toInt();

  if (nodo < 1 || nodo > 5) {
    server.send(400, "text/plain", "Nodo inválido (1-5)");
    return;
  }

  radio.openWritingPipe(nodo);
  enviarComando(nodo, false); // OFF

  server.send(200, "text/plain", "Comando OFF enviado a nodo " + String(nodo));
}
```

### Setup Completo

```cpp
void setup() {
  Serial.begin(115200);

  // Conectar WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi conectado");
  Serial.print("   IP: ");
  Serial.println(WiFi.localIP());

  // Inicializar RF24
  if (!radio.begin()) {
    Serial.println("❌ RF24 no iniciado");
    while (1);
  }

  radio.setPALevel(RF24_PA_LOW);
  radio.setDataRate(RF24_250KBPS);
  radio.enableAckPayload();
  radio.setRetries(15, 15);

  Serial.println("✅ RF24 iniciado");

  // Configurar servidor HTTP
  server.on("/on", handleOnCommand);
  server.on("/off", handleOffCommand);
  server.on("/status", []() {
    server.send(200, "text/plain", "Maestro RF24 OK");
  });

  server.begin();
  Serial.println("✅ Servidor HTTP iniciado");
  Serial.printf("   Escuchando en: http://%s:%d\n",
                WiFi.localIP().toString().c_str(),
                BACKEND_PORT);
}

void loop() {
  server.handleClient();
}
```

---

## 🔄 Flujo Completo

1. **Frontend** → WebSocket → **Backend**: `node:alarm:set`
2. **Backend** → HTTP → **Maestro**: `GET /on?n=3`
3. **Maestro** → RF24 → **Nodo 3**: Intenta 3 veces
4. **Si falla**:
   - **Maestro** → HTTP POST → **Backend**: `/api/nodes/failure`
   - **Backend** → Actualiza DB: `is_online = false`
   - **Backend** → WebSocket → **Frontend**: `node:status:change`
   - **Frontend** → Muestra alerta: "Nodo desconectado"

---

## 📦 Librerías Requeridas

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <RF24.h>
#include <SPI.h>
```

Instala desde Arduino Library Manager:

- `RF24` by TMRh20
- `HTTPClient` (incluida en ESP32)
- `WebServer` (incluida en ESP32)

---

## 🧪 Pruebas

### 1. Test de Conectividad Backend

```bash
curl http://192.168.4.30/status
```

Esperado: `Maestro RF24 OK`

### 2. Test de Comando ON

```bash
curl "http://192.168.4.30/on?n=3"
```

### 3. Test de Reporte de Fallo (simular)

Desconectar Nodo 3 y ejecutar:

```bash
curl "http://192.168.4.30/on?n=3"
```

Debería:

- Fallar 3 intentos RF24
- Enviar POST a backend
- Backend emite WebSocket
- Frontend muestra alerta

---

## 🛠️ Variables de Entorno Backend

Asegúrate de configurar en tu `.env`:

```env
MAESTRO_IP=192.168.4.30
MAESTRO_PORT=80
```

---

## ✅ Checklist de Implementación

- [ ] Actualizar código Arduino Maestro
- [ ] Compilar y flashear
- [ ] Verificar conexión WiFi
- [ ] Verificar endpoint `/status`
- [ ] Probar comando ON/OFF con nodo conectado
- [ ] Probar comando con nodo desconectado
- [ ] Verificar reporte POST al backend
- [ ] Verificar notificación WebSocket en frontend
- [ ] Verificar alerta en UI del frontend

---

## 📞 Contacto / Soporte

Para más información sobre este proyecto, consulta:

- [README.md](README.md)
- [WEBSOCKET_SETUP.md](WEBSOCKET_SETUP.md)
- [DIAGNOSTICO_RF24.md](DIAGNOSTICO_RF24.md)
