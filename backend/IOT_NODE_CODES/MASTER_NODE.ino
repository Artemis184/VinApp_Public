// ============================================
// MAESTRO RF24 CON REPORTE DE FALLOS v2.0
// ============================================
// Intermediario HTTP ↔ RF24 con notificación al backend
// cuando un nodo hijo no responde
// 🔐 Autenticación con API Key
#define RF24_DEBUG
#include <printf.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <RF24.h>

// ============================================
// CONFIGURACIÓN WIFI
// ============================================


// ===========PRODUCTION=================================
const char* ssid = "";
const char* password = "";
const bool WIFI_HIDDEN = true;
// ============================================

// ==========DEVELOPMENT==================================
//const char* ssid = "";
//const char* password = "";
//const bool WIFI_HIDDEN = false;

// IP fija del maestro
IPAddress local_IP(192, 168, 0, 2);
IPAddress gateway(192, 168, 0, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(1 , 1, 1, 1);

// ============================================
// CONFIGURACIÓN BACKEND
// ============================================
const char* BACKEND_IP = "";        // ⬅️ CAMBIAR A TU IP DEL BACKEND
const int BACKEND_PORT = ;
const char* API_KEY = ""; // 🔑 API Key para autenticación

// ============================================
// CONFIGURACIÓN NRF24
// ============================================
#define CE_PIN   3   // D1
#define CSN_PIN  4   // D2

RF24 radio(CE_PIN, CSN_PIN);

// Direcciones genéricas (1-5)
const byte addresses[5][6] = {"NODE1", "NODE2", "NODE3", "NODE4", "NODE5"};

// Token compartido padre ↔ hijos para validar comandos RF
const uint32_t RF_SHARED_TOKEN = ;

// ============================================
// MAPA DINÁMICO DESDE BACKEND (DB)
// ============================================
const int MAX_NODE_MAP = 32;
const unsigned long NODE_MAP_SYNC_INTERVAL_MS = 120000;  // 2 minutos

struct NodeMapEntry {
  int nodeId;         // ID real en DB
  String code;        // Código único del nodo en DB
  uint8_t rfNode;     // Nodo RF físico (1-5)
  String rfAddress;   // Primer salto RF (repetidor), vacío si es directo
  bool usesRepeater;  // true si el nodo se enruta vía repetidor
  bool isEnabled;     // Estado habilitado/deshabilitado
};

const byte repeaterAddress[6] = "RPT01";

NodeMapEntry nodeMap[MAX_NODE_MAP];
int nodeMapCount = 0;
unsigned long lastNodeMapSyncMs = 0;

// ============================================
// ESTRUCTURA DE PAQUETE RF24
// ============================================
struct Packet {
  uint8_t nodo;
  uint8_t comando;  // 1 = ON, 0 = OFF, 2 = PING
  uint32_t token;
};

struct PacketACK {
  uint8_t nodo;
  uint8_t status;  // 1 = OK
};

// ============================================
// SERVIDOR WEB
// ============================================
WebServer server(80);

// ============================================
// HELPERS MAPA DE NODOS
// ============================================
int findNodeMapIndexByCode(const String& code) {
  for (int i = 0; i < nodeMapCount; i++) {
    if (nodeMap[i].code.equalsIgnoreCase(code)) {
      return i;
    }
  }
  return -1;
}

int extractIntField(const String& jsonObject, const char* key, int fallbackValue) {
  String pattern = "\"" + String(key) + "\":";
  int keyPos = jsonObject.indexOf(pattern);
  if (keyPos < 0) {
    return fallbackValue;
  }

  int valueStart = keyPos + pattern.length();
  while (valueStart < jsonObject.length() && jsonObject.charAt(valueStart) == ' ') {
    valueStart++;
  }

  int valueEnd = valueStart;
  while (
    valueEnd < jsonObject.length() &&
    (isDigit(jsonObject.charAt(valueEnd)) || jsonObject.charAt(valueEnd) == '-')
  ) {
    valueEnd++;
  }

  if (valueEnd <= valueStart) {
    return fallbackValue;
  }

  return jsonObject.substring(valueStart, valueEnd).toInt();
}

bool extractBoolField(const String& jsonObject, const char* key, bool fallbackValue) {
  String pattern = "\"" + String(key) + "\":";
  int keyPos = jsonObject.indexOf(pattern);
  if (keyPos < 0) {
    return fallbackValue;
  }

  int valueStart = keyPos + pattern.length();
  while (valueStart < jsonObject.length() && jsonObject.charAt(valueStart) == ' ') {
    valueStart++;
  }

  if (jsonObject.startsWith("true", valueStart)) {
    return true;
  }

  if (jsonObject.startsWith("false", valueStart)) {
    return false;
  }

  return fallbackValue;
}

String extractStringField(const String& jsonObject, const char* key) {
  String pattern = "\"" + String(key) + "\":";
  int keyPos = jsonObject.indexOf(pattern);
  if (keyPos < 0) {
    return "";
  }

  int valueStart = keyPos + pattern.length();
  while (valueStart < jsonObject.length() && jsonObject.charAt(valueStart) == ' ') {
    valueStart++;
  }

  if (jsonObject.startsWith("null", valueStart)) {
    return "";
  }

  if (valueStart >= jsonObject.length() || jsonObject.charAt(valueStart) != '"') {
    return "";
  }

  int valueEnd = jsonObject.indexOf('"', valueStart + 1);
  if (valueEnd < 0) {
    return "";
  }

  return jsonObject.substring(valueStart + 1, valueEnd);
}

bool parseNodeMapJson(const String& body) {
  nodeMapCount = 0;
  int cursor = 0;

  while (nodeMapCount < MAX_NODE_MAP) {
    int nodeIdKey = body.indexOf("\"nodeId\":", cursor);
    if (nodeIdKey < 0) {
      break;
    }

    int objectStart = body.lastIndexOf('{', nodeIdKey);
    if (objectStart < 0) {
      break;
    }

    int objectEnd = body.indexOf('}', nodeIdKey);
    if (objectEnd < 0) {
      break;
    }

    String jsonObject = body.substring(objectStart, objectEnd + 1);

    int nodeId = extractIntField(jsonObject, "nodeId", -1);
    String code = extractStringField(jsonObject, "code");
    int rfNode = extractIntField(jsonObject, "rfNode", -1);
    String rfAddress = extractStringField(jsonObject, "rfAddress");
    bool usesRepeater = extractBoolField(jsonObject, "usesRepeater", false);
    bool isEnabled = extractBoolField(jsonObject, "isEnabled", false);

    if (!code.isEmpty() && rfNode >= 1 && rfNode <= 5 && nodeId > 0) {
      nodeMap[nodeMapCount].nodeId = nodeId;
      nodeMap[nodeMapCount].code = code;
      nodeMap[nodeMapCount].rfNode = (uint8_t)rfNode;
      nodeMap[nodeMapCount].rfAddress = rfAddress;
      nodeMap[nodeMapCount].usesRepeater = usesRepeater;
      nodeMap[nodeMapCount].isEnabled = isEnabled;
      nodeMapCount++;
    }

    cursor = objectEnd + 1;
  }

  // Mapa vacío también es una respuesta válida del backend.
  return true;
}

const NodeMapEntry* findNodeMapByRfNode(uint8_t nodo) {
  for (int i = 0; i < nodeMapCount; i++) {
    if (nodeMap[i].rfNode == nodo) {
      return &nodeMap[i];
    }
  }

  return nullptr;
}

bool syncNodeMapFromBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi desconectado, no se puede sincronizar mapa de nodos");
    return false;
  }

  WiFiClient client;
  HTTPClient http;
  String url = "http://" + String(BACKEND_IP) + ":" + String(BACKEND_PORT) + "/api/nodes/maestro/map";

  Serial.println("\n🗺️ Sincronizando mapa de nodos desde backend...");
  Serial.printf("   ↳ URL: %s\n", url.c_str());

  http.begin(client, url);
  http.addHeader("x-api-key", API_KEY);

  int httpCode = http.GET();
  if (httpCode != 200) {
    Serial.printf("❌ No se pudo sincronizar mapa. HTTP: %d\n", httpCode);
    http.end();
    return false;
  }

  String body = http.getString();
  http.end();

  bool parsed = parseNodeMapJson(body);
  if (!parsed) {
    Serial.println("❌ Respuesta inválida al parsear mapa de nodos");
    return false;
  }

  Serial.printf("✅ Mapa sincronizado: %d nodos\n", nodeMapCount);
  for (int i = 0; i < nodeMapCount; i++) {
    Serial.printf("   [%d] id=%d code=%s rf=%d hop=%s repeater=%s enabled=%s\n",
      i + 1,
      nodeMap[i].nodeId,
      nodeMap[i].code.c_str(),
      nodeMap[i].rfNode,
      nodeMap[i].rfAddress.length() > 0 ? nodeMap[i].rfAddress.c_str() : "DIRECT",
      nodeMap[i].usesRepeater ? "true" : "false",
      nodeMap[i].isEnabled ? "true" : "false");
  }

  lastNodeMapSyncMs = millis();
  return true;
}

// ============================================
// FUNCIÓN: REPORTAR AL BACKEND
// ============================================
void reportarAlBackend(int nodeIdDb, const String& code, uint8_t rfNode, const char* comando, bool exito) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("  ⚠️ WiFi desconectado, no se puede reportar");
    return;
  }

  WiFiClient client;
  HTTPClient http;
  
  // Determinar endpoint según resultado
  String endpoint = exito ? "/api/nodes/recovery" : "/api/nodes/failure";
  String url = "http://" + String(BACKEND_IP) + ":" + String(BACKEND_PORT) + endpoint;
  
  Serial.printf("  📡 Reportando %s al backend...\n", exito ? "recuperación" : "fallo");
  Serial.printf("     URL: %s\n", url.c_str());

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);  // 🔑 Agregar API Key
  
  // Construir JSON
  String payload;
  if (exito) {
    payload = "{\"nodeId\":" + String(nodeIdDb) +
              ",\"code\":\"" + code +
              "\",\"rfNode\":" + String(rfNode) +
              ",\"comando\":\"" + String(comando) + "\"}";
  } else {
    payload = "{\"nodeId\":" + String(nodeIdDb) +
              ",\"code\":\"" + code +
              "\",\"rfNode\":" + String(rfNode) +
              ",\"comando\":\"" + String(comando) + 
              "\",\"intentos\":3}";
  }
  
  Serial.printf("     Payload: %s\n", payload.c_str());

  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    if (httpCode == 200) {
      Serial.printf("     ✅ %s reportado exitosamente\n", exito ? "Recuperación" : "Fallo");
      String response = http.getString();
      Serial.printf("     Respuesta: %s\n", response.c_str());
    } else if (httpCode == 401) {
      Serial.println("     ❌ API Key inválida - Verifica la configuración");
    } else {
      Serial.printf("     ⚠️ Backend respondió: %d\n", httpCode);
    }
  } else {
    Serial.printf("     ❌ Error HTTP: %s\n", http.errorToString(httpCode).c_str());
  }
  
  http.end();
}

// ============================================
// FUNCIÓN: ENVIAR COMANDO RF24 CON REINTENTOS
// ============================================
bool enviarComando(uint8_t nodo, uint8_t accion) {
  if (nodo < 1 || nodo > 5) {
    Serial.printf("❌ Nodo %d fuera de rango (1-5)\n", nodo);
    return false;
  }

  if (nodeMapCount == 0 && WiFi.status() == WL_CONNECTED) {
    Serial.println("ℹ️ Mapa local vacío, intentando sincronizar antes de enviar...");
    syncNodeMapFromBackend();
  }

  Packet pkt = {nodo, accion, RF_SHARED_TOKEN};
  const char* accionStr = (accion == 1) ? "ON" : (accion == 0) ? "OFF" : "PING";

  const byte* targetAddress = addresses[nodo - 1];
  const NodeMapEntry* nodeEntry = findNodeMapByRfNode(nodo);
  if (nodeEntry != nullptr && nodeEntry->usesRepeater) {
    targetAddress = repeaterAddress;
    Serial.printf("↪️ Ruta DB nodo %d: REPETIDOR (%s)\n", nodo, nodeEntry->rfAddress.length() > 0 ? nodeEntry->rfAddress.c_str() : "RPT01");
  } else {
    Serial.printf("↪️ Ruta DB nodo %d: DIRECTO (%s)\n", nodo, (const char*)targetAddress);
  }

  Serial.printf("\n📤 ENVÍO - Nodo: %d, Comando: %s\n", nodo, accionStr);

  // 3 intentos
  for (int intento = 1; intento <= 3; intento++) {
    radio.stopListening();
    radio.openWritingPipe(targetAddress);

    Serial.printf("  ↳ Intento %d/3...\n", intento);

    if (radio.write(&pkt, sizeof(pkt))) {
      // ACK hardware recibido, ahora leer ACK Payload si está disponible
      delay(10);  // Pequeña pausa para recibir ACK payload
      
      if (radio.isAckPayloadAvailable()) {
        PacketACK ackData;
        radio.read(&ackData, sizeof(ackData));
        
        if (ackData.nodo == nodo && ackData.status == 1) {
          Serial.printf("  ✅ ACK válido recibido - Nodo %d respondió OK\n", ackData.nodo);
          radio.startListening();
          return true;
        } else {
          Serial.printf("  ⚠️ ACK inválido: nodo=%d status=%d\n", ackData.nodo, ackData.status);
        }
      } else {
        // ACK hardware OK pero sin payload (compatibilidad)
        Serial.println("  ✅ ACK hardware recibido (sin payload)");
        radio.startListening();
        return true;
      }
    }

    delay(100);
  }

  // ❌ FALLÓ TRAS 3 INTENTOS
  Serial.println("  ❌ Falló tras 3 intentos - Nodo no responde");

  radio.startListening();
  return false;
}

bool enviarComandoPorCodigo(const String& codeRaw, uint8_t accion) {
  String code = codeRaw;
  code.trim();

  if (code.length() == 0) {
    Serial.println("❌ code vacío en petición");
    return false;
  }

  if (nodeMapCount == 0) {
    syncNodeMapFromBackend();
  }

  int index = findNodeMapIndexByCode(code);
  if (index < 0) {
    Serial.printf("⚠️ Código %s no encontrado en mapa local. Reintentando sync...\n", code.c_str());
    if (syncNodeMapFromBackend()) {
      index = findNodeMapIndexByCode(code);
    }
  }

  if (index < 0) {
    Serial.printf("❌ Código %s no existe en el mapa de nodos\n", code.c_str());
    return false;
  }

  NodeMapEntry entry = nodeMap[index];
  const bool isPing = accion == 2;
  const char* accionStr = (accion == 1) ? "ON" : (accion == 0) ? "OFF" : "PING";

  if (!entry.isEnabled) {
    Serial.printf("⚠️ Nodo %s está deshabilitado en DB\n", entry.code.c_str());
    if (!isPing) {
      reportarAlBackend(entry.nodeId, entry.code, entry.rfNode, accionStr, false);
    }
    return false;
  }

  bool ok = false;

  ok = enviarComando(entry.rfNode, accion);

  if (!isPing) {
    reportarAlBackend(entry.nodeId, entry.code, entry.rfNode, accionStr, ok);
  }
  return ok;
}

// ============================================
// ENDPOINT: GET /on?code=ALM-JC-0001-L1
// ============================================
void handleOn() {
  String code = server.hasArg("code") ? server.arg("code") : "";

  if (!server.hasArg("code") && server.hasArg("n")) {
    // Compatibilidad temporal
    int nodo = server.arg("n").toInt();
    if (nodo >= 1 && nodo <= 5) {
      bool resultadoLegacy = enviarComando((uint8_t)nodo, 1);
      String jsonLegacy = "{\"exito\":" + String(resultadoLegacy ? "true" : "false") +
                        ",\"nodo\":" + String(nodo) +
                        ",\"comando\":\"ON\",\"legacy\":true}";
      server.send(200, "application/json", jsonLegacy);
      return;
    }
  }

  bool resultado = enviarComandoPorCodigo(code, 1);

  String json = "{\"exito\":" + String(resultado ? "true" : "false") +
                ",\"code\":\"" + code +
                "\",\"comando\":\"ON\"}";

  server.send(200, "application/json", json);
}

// ============================================
// ENDPOINT: GET /off?code=ALM-JC-0001-L1
// ============================================
void handleOff() {
  String code = server.hasArg("code") ? server.arg("code") : "";

  if (!server.hasArg("code") && server.hasArg("n")) {
    // Compatibilidad temporal
    int nodo = server.arg("n").toInt();
    if (nodo >= 1 && nodo <= 5) {
      bool resultadoLegacy = enviarComando((uint8_t)nodo, 0);
      String jsonLegacy = "{\"exito\":" + String(resultadoLegacy ? "true" : "false") +
                        ",\"nodo\":" + String(nodo) +
                        ",\"comando\":\"OFF\",\"legacy\":true}";
      server.send(200, "application/json", jsonLegacy);
      return;
    }
  }

  bool resultado = enviarComandoPorCodigo(code, 0);

  String json = "{\"exito\":" + String(resultado ? "true" : "false") +
                ",\"code\":\"" + code +
                "\",\"comando\":\"OFF\"}";

  server.send(200, "application/json", json);
}

// ============================================
// ENDPOINT: GET /status
// ============================================
void handleStatus() {
  String html = "<html><head><meta charset='utf-8'><title>Maestro RF24</title></head><body>";
  html += "<h1>🛰️ Maestro RF24 - Status</h1>";
  html += "<p><b>WiFi SSID:</b> " + String(ssid) + "</p>";
  html += "<p><b>IP Local:</b> " + WiFi.localIP().toString() + "</p>";
  html += "<p><b>Backend IP:</b> " + String(BACKEND_IP) + ":" + String(BACKEND_PORT) + "</p>";
  html += "<p><b>API Key:</b> " + String(API_KEY).substring(0, 10) + "...</p>";
  html += "<p><b>RF24 Channel:</b> 90</p>";
  html += "<p><b>RF24 DataRate:</b> 250 KBPS</p>";
  html += "<p><b>RF24 PA Level:</b> HIGH</p>";
  html += "<h2>⚡ Prueba Rápida</h2>";
  
  html += "<p><b>Nodos en mapa:</b> " + String(nodeMapCount) + "</p>";

  for (int i = 0; i < nodeMapCount; i++) {
    html += "<p>[" + String(nodeMap[i].nodeId) + "] " + nodeMap[i].code +
            " (RF " + String(nodeMap[i].rfNode) + ") " +
            (nodeMap[i].isEnabled ? "✅" : "⛔") +
            " | <a href='/on?code=" + nodeMap[i].code + "' style='color:green; margin-right:10px'>ON</a> | " +
            "<a href='/off?code=" + nodeMap[i].code + "' style='color:red'>OFF</a> | " +
            "<a href='/ping?code=" + nodeMap[i].code + "' style='color:blue'>PING</a></p>";
  }
  
  html += "</body></html>";
  server.send(200, "text/html; charset=utf-8", html);
}

// ============================================
// ENDPOINT: GET /ping?code=ALM-JC-0001-L1
// ============================================
void handlePing() {
  String code = server.hasArg("code") ? server.arg("code") : "";

  // Compatibilidad con parámetro legacy "n"
  if (!server.hasArg("code") && server.hasArg("n")) {
    int nodo = server.arg("n").toInt();
    if (nodo >= 1 && nodo <= 5) {
      Serial.printf("\n🏓 PING - RF Node: %d (legacy)\n", nodo);
      bool resultadoLegacy = enviarComando((uint8_t)nodo, 2);
      String jsonLegacy = "{\"exito\":" + String(resultadoLegacy ? "true" : "false") +
                        ",\"nodo\":" + String(nodo) +
                        ",\"comando\":\"PING\",\"legacy\":true}";
      server.send(200, "application/json", jsonLegacy);
      return;
    }
  }

  // Usar la misma función que ON/OFF para consistencia
  bool resultado = enviarComandoPorCodigo(code, 2);

  String json = "{\"exito\":" + String(resultado ? "true" : "false") +
                ",\"code\":\"" + code +
                "\",\"comando\":\"PING\"}";

  server.send(200, "application/json", json);
}

// ============================================
// SETUP
// ============================================
void setup() {
  Serial.begin(115200);
  printf_begin();
  delay(500);

  Serial.println("\n\n🔧 SETUP MAESTRO RF24 v2.0");
  Serial.println("================================");

  // ==================== WiFi ====================
  Serial.print("📶 Conectando WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);

  if (!WiFi.config(local_IP, gateway, subnet, dns)) {
    Serial.println("⚠️ No se pudo aplicar IP fija");
  }

  if (WIFI_HIDDEN) {
    WiFi.begin(ssid, password);
  } else {
    WiFi.begin(ssid, password);
  }

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 30) {
    delay(300);
    Serial.print(".");
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" ✅");
    Serial.print("🔗 IP Local: ");
    Serial.println(WiFi.localIP());
    Serial.print("🔗 Gateway: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("🔗 Mascara: ");
    Serial.println(WiFi.subnetMask());
    Serial.printf("🔗 Backend: http://%s:%d\n", BACKEND_IP, BACKEND_PORT);
    Serial.printf("🔑 API Key: %s\n", API_KEY);
  } else {
    Serial.println(" ❌");
    Serial.println("⚠️ Sin WiFi - Reportes de fallo deshabilitados");
  }

  // Primera sincronización del mapa desde backend
  if (WiFi.status() == WL_CONNECTED) {
    syncNodeMapFromBackend();
  }

  // ==================== SPI ====================
  SPI.begin(7, 8, 9);

  pinMode(CSN_PIN, OUTPUT);
  digitalWrite(CSN_PIN, HIGH);

  pinMode(CE_PIN, OUTPUT);
  digitalWrite(CE_PIN, LOW);

  delay(100);

  // ==================== NRF24 ====================
  Serial.print("📡 Inicializando NRF24...");
  if (!radio.begin()) {
    Serial.println("radio.begin() = FALSE");
    radio.printDetails();
    Serial.println(" ❌ NO DETECTADO");
    while (1) {
      delay(1000);
      Serial.println("❌ NRF24 falla - revisa conexión SPI/CE/CSN");
    }
  }

  Serial.println(" ✅");

  // Configuración RF24
  radio.setChannel(90);
  radio.setDataRate(RF24_250KBPS);
  radio.setPALevel(RF24_PA_HIGH);

  radio.setAutoAck(true);
  radio.enableAckPayload();
  radio.setRetries(5, 15);

  radio.startListening();

  // ==================== WEB SERVER ====================
  Serial.println("\n🌐 Web Server iniciando...");
  server.on("/", handleStatus);
  server.on("/on", handleOn);
  server.on("/off", handleOff);
  server.on("/status", handleStatus);
  server.on("/ping", handlePing);  // 🎯 Endpoint para heartbeat
  server.begin();

  Serial.println("\n✅ MAESTRO LISTO");
  Serial.println("================================\n");
}

// ============================================
// LOOP
// ============================================
void loop() {
  server.handleClient();

  if (WiFi.status() == WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastNodeMapSyncMs >= NODE_MAP_SYNC_INTERVAL_MS) {
      syncNodeMapFromBackend();
    }
  }

  delay(10);
}
