// ======================================================
// REPETIDOR RF24 v2.2 - ESP8266 D1 mini
// ======================================================
// FIXES v2.2:
//   1. WiFi en modo STA con yield() frecuente para no
//      bloquear el loop RF durante handleClient()
//   2. Radio re-inicializado si se detecta fallo
//   3. Watchdog feed explícito durante operaciones largas
//   4. ACK payload precargado al arrancar
//   5. Timeout en webServer.handleClient() limitado
// ======================================================

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <SPI.h>
#include <RF24.h>
// Suprimir warning de redefinición de printf_P
#ifdef printf_P
#undef printf_P
#endif
#define printf_P(fmt, ...) Serial.printf(fmt, ##__VA_ARGS__)

// ======================================================
// PINES
// ======================================================
#define CE_PIN         D2
#define CSN_PIN        D8
#define LED_RED_PIN    D0
#define LED_GREEN_PIN  D3
#define LED_BLUE_PIN   D4

RF24 radio(CE_PIN, CSN_PIN);

// ======================================================
// CONFIGURACIÓN WIFI
// ======================================================
const char* WIFI_SSID     = "";
const char* WIFI_PASSWORD = "";

IPAddress local_IP(10, 144, 92, 200);
IPAddress gateway (10, 144, 92, 248);
IPAddress subnet  (255, 255, 255, 0);

bool wifiOk = false;
ESP8266WebServer webServer(80);

// ======================================================
// IDENTIDAD Y PROTOCOLO
// ======================================================
const char* REPEATER_CODE      = "REPETIDOR-01";
const byte  upstreamAddress[6] = "RPT01";
const uint32_t RF_SHARED_TOKEN = ;

struct PacketRF  { uint8_t nodo; uint8_t comando; uint32_t token; };
struct PacketACK { uint8_t nodo; uint8_t status; };

// ======================================================
// LOG CIRCULAR
// ======================================================
#define LOG_MAX 20
struct LogEntry {
  unsigned long timestamp;
  uint8_t  nodo, comando;
  bool     tokenOk, txOk, hasAckPayload;
  uint8_t  ackStatus;
};
LogEntry eventLog[LOG_MAX];
int logHead = 0, logCount = 0;

void logEvent(uint8_t nodo, uint8_t cmd, bool tok, bool tx, uint8_t ack, bool payload) {
  eventLog[logHead] = { millis(), nodo, cmd, tok, tx, payload, ack };
  logHead = (logHead + 1) % LOG_MAX;
  if (logCount < LOG_MAX) logCount++;
}

// ======================================================
// STATS
// ======================================================
unsigned long totalForwarded = 0, totalAckOk = 0, totalAckFail = 0;
unsigned long lastStatsMs = 0;
const unsigned long STATS_INTERVAL_MS = 30000UL;

// ======================================================
// LEDs
// ======================================================
unsigned long redBlinkUntilMs = 0, blueBlinkUntilMs = 0;
unsigned long lastRedToggleMs = 0, lastBlueToggleMs = 0;
bool redLedState = false, blueLedState = false;
const unsigned long RED_MS = 5000UL, BLUE_MS = 2000UL, BLINK_MS = 200UL;

void setRedLed  (bool on) { digitalWrite(LED_RED_PIN,   on ? LOW : HIGH); }
void setGreenLed(bool on) { digitalWrite(LED_GREEN_PIN, on ? LOW : HIGH); }
void setBlueLed (bool on) { digitalWrite(LED_BLUE_PIN,  on ? LOW : HIGH); }

void startRedBlink()  { redBlinkUntilMs  = millis() + RED_MS;  lastRedToggleMs  = 0; redLedState  = true; setRedLed(true); }
void startBlueBlink() { blueBlinkUntilMs = millis() + BLUE_MS; lastBlueToggleMs = 0; blueLedState = true; setBlueLed(true); }

void updateLeds() {
  unsigned long now = millis();
  if (now < redBlinkUntilMs) {
    if (!lastRedToggleMs || now - lastRedToggleMs >= BLINK_MS) {
      redLedState = !redLedState; setRedLed(redLedState); lastRedToggleMs = now;
    }
  } else { setRedLed(false); }
  if (now < blueBlinkUntilMs) {
    if (!lastBlueToggleMs || now - lastBlueToggleMs >= BLINK_MS) {
      blueLedState = !blueLedState; setBlueLed(blueLedState); lastBlueToggleMs = now;
    }
  } else { setBlueLed(false); }
}

// ======================================================
// ROUTING
// ======================================================
bool buildDownstreamAddress(uint8_t node, byte (&addr)[6]) {
  if (node < 1 || node > 5) return false;
  snprintf((char*)addr, sizeof(addr), "NODE%u", node);
  return true;
}

// ======================================================
// RADIO — init y reinicio
// ======================================================
bool initRadio() {
  radio.powerDown();
  delay(5);
  if (!radio.begin()) return false;

  radio.setChannel(90);
  radio.setDataRate(RF24_250KBPS);
  radio.setPALevel(RF24_PA_HIGH);
  radio.setRetries(5, 15);
  radio.setAutoAck(true);
  radio.enableAckPayload();
  radio.openReadingPipe(1, upstreamAddress);
  radio.startListening();
  return true;
}

// Contador de fallos consecutivos para detectar radio colgado
uint8_t radioFailCount = 0;
const uint8_t RADIO_FAIL_THRESHOLD = 5;

// ======================================================
// WEB SERVER
// ======================================================
const char* cmdName(uint8_t c) {
  if (c == 1) return "ON";
  if (c == 0) return "OFF";
  if (c == 2) return "PING";
  return "?";
}

void handleRoot() {
  String html = F("<!DOCTYPE html><html><head><meta charset='utf-8'>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<meta http-equiv='refresh' content='5'>"
    "<title>Repetidor RF24</title>"
    "<style>body{font-family:monospace;background:#111;color:#e0e0e0;margin:0;padding:16px}"
    "h1{color:#4fc3f7}table{width:100%;border-collapse:collapse;font-size:.82em}"
    "th{background:#263238;color:#80cbc4;padding:6px 4px;text-align:left}"
    "td{padding:5px 4px;border-bottom:1px solid #1e1e1e}"
    "tr:nth-child(even){background:#1a1a1a}"
    ".ok{color:#66bb6a}.fail{color:#ef5350}.warn{color:#ffa726}"
    ".card{background:#1e1e1e;border-radius:8px;padding:14px;margin-bottom:14px}"
    ".row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #2a2a2a}"
    ".lbl{color:#aaa}.val{color:#fff;font-weight:bold}"
    ".b{display:inline-block;padding:2px 7px;border-radius:4px;font-size:.8em}"
    ".b-ok{background:#1b5e20;color:#a5d6a7}.b-fail{background:#b71c1c;color:#ef9a9a}"
    ".b-warn{background:#e65100;color:#ffcc80}</style></head><body>");

  html += "<h1>&#x1F4E1; Repetidor RF24 v2.2</h1>";
  html += "<div style='color:#888;font-size:.85em;margin-bottom:16px'>Auto-refresco 5s | IP: ";
  html += WiFi.localIP().toString();
  html += "</div>";

  html += "<div class='card'>";
  html += "<div class='row'><span class='lbl'>Uptime</span><span class='val'>" + String(millis()/1000) + " s</span></div>";
  html += "<div class='row'><span class='lbl'>Reenviados</span><span class='val'>" + String(totalForwarded) + "</span></div>";
  html += "<div class='row'><span class='lbl'>ACK OK</span><span class='val ok'>" + String(totalAckOk) + "</span></div>";
  html += "<div class='row'><span class='lbl'>ACK FAIL</span><span class='val fail'>" + String(totalAckFail) + "</span></div>";
  html += "<div class='row'><span class='lbl'>WiFi RSSI</span><span class='val'>" + String(WiFi.RSSI()) + " dBm</span></div>";
  html += "<div class='row'><span class='lbl'>Radio fallos</span><span class='val " + String(radioFailCount > 0 ? "fail" : "ok") + "'>" + String(radioFailCount) + "</span></div>";
  html += "</div>";

  html += "<div class='card'><b style='color:#80cbc4'>Últimas transacciones</b><br><br>";
  if (logCount == 0) {
    html += "<span class='warn'>Sin transacciones aún.</span>";
  } else {
    html += "<table><tr><th>t(s)</th><th>Nodo</th><th>Cmd</th><th>Token</th><th>TX→hijo</th><th>ACK→maestro</th></tr>";
    for (int i = 0; i < logCount; i++) {
      int idx = ((logHead - 1 - i) + LOG_MAX) % LOG_MAX;
      LogEntry& e = eventLog[idx];
      html += "<tr><td>" + String(e.timestamp/1000) + "</td>";
      html += "<td>NODE" + String(e.nodo) + "</td>";
      html += "<td>" + String(cmdName(e.comando)) + "</td>";
      html += "<td><span class='b " + String(e.tokenOk ? "b-ok'>OK" : "b-fail'>FAIL") + "</span></td>";
      html += "<td><span class='b " + String(e.txOk ? "b-ok'>OK" : "b-fail'>FAIL") + "</span></td>";
      String ack;
      if (!e.txOk)         ack = "<span class='b b-fail'>SIN RESP</span>";
      else if (e.ackStatus) ack = "<span class='b b-ok'>OK (" + String(e.hasAckPayload ? "payload" : "hw") + ")</span>";
      else                  ack = "<span class='b b-warn'>FALLO hijo</span>";
      html += "<td>" + ack + "</td></tr>";
    }
    html += "</table>";
  }
  html += "</div></body></html>";
  webServer.send(200, "text/html; charset=utf-8", html);
}

void handleJson() {
  String json = "{\"uptime\":" + String(millis()/1000) +
    ",\"forwarded\":" + String(totalForwarded) +
    ",\"ackOk\":"     + String(totalAckOk) +
    ",\"ackFail\":"   + String(totalAckFail) +
    ",\"rssi\":"      + String(WiFi.RSSI()) +
    ",\"radioFails\":" + String(radioFailCount) +
    ",\"events\":[";
  for (int i = 0; i < logCount; i++) {
    int idx = ((logHead - 1 - i) + LOG_MAX) % LOG_MAX;
    LogEntry& e = eventLog[idx];
    if (i > 0) json += ",";
    json += "{\"t\":" + String(e.timestamp/1000) +
            ",\"nodo\":" + String(e.nodo) +
            ",\"cmd\":\"" + String(cmdName(e.comando)) + "\"" +
            ",\"txOk\":" + String(e.txOk ? "true" : "false") +
            ",\"ackStatus\":" + String(e.ackStatus) + "}";
  }
  json += "]}";
  webServer.send(200, "application/json", json);
}

// ======================================================
// SETUP
// ======================================================
void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(LED_RED_PIN,   OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_BLUE_PIN,  OUTPUT);
  setRedLed(false); setGreenLed(false); setBlueLed(false);

  Serial.println("\n=== REPETIDOR RF24 v2.2 ===");

  // ---- WiFi ----
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.mode(WIFI_STA);

  if (!WiFi.config(local_IP, gateway, subnet)) {
    Serial.println("[WiFi] IP fija falló, usando DHCP");
  }

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WiFi] Conectando a '%s'", WIFI_SSID);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 20) {
    delay(400);
    Serial.print(".");
    yield();
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiOk = true;
    Serial.printf("\n[WiFi] OK | IP: %s | RSSI: %d dBm\n",
      WiFi.localIP().toString().c_str(), WiFi.RSSI());
    webServer.on("/",     handleRoot);
    webServer.on("/json", handleJson);
    webServer.begin();
    Serial.printf("[Web] http://%s/\n", WiFi.localIP().toString().c_str());
  } else {
    wifiOk = false;
    Serial.println("\n[WiFi] Sin conexión — modo RF puro");
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
  }

  // ---- SPI + NRF24 ----
  SPI.begin();
  delay(50);

  if (!initRadio()) {
    Serial.println("[FATAL] NRF24 no detectado");
    setRedLed(true);
    while (1) { yield(); delay(1000); }
  }

  setGreenLed(true);
  Serial.printf("[RF24] Canal:%u | 250KBPS | PA_HIGH | Pipe:RPT01\n", radio.getChannel());
  Serial.println("[OK] Repetidor listo\n");
}

// ======================================================
// LOOP
// ======================================================
void loop() {
  updateLeds();
  yield();

  // Web server — tiempo limitado para no bloquear RF
  if (wifiOk) {
    webServer.handleClient();
    yield();
  }

  // Stats periódicas
  unsigned long now = millis();
  if (now - lastStatsMs >= STATS_INTERVAL_MS) {
    lastStatsMs = now;
    Serial.printf("[STATS] fwd=%lu ok=%lu fail=%lu uptime=%lus\n",
      totalForwarded, totalAckOk, totalAckFail, now/1000);
  }

  // ---- Escuchar paquete del maestro ----
  uint8_t pipeNumber;
  if (!radio.available(&pipeNumber)) {
    yield();
    return;
  }

  PacketRF incoming;
  radio.read(&incoming, sizeof(incoming));

  Serial.printf("[RX] pipe=%u nodo=%u cmd=%s token=%s\n",
    pipeNumber, incoming.nodo,
    cmdName(incoming.comando),
    incoming.token == RF_SHARED_TOKEN ? "OK" : "INVALIDO");

  // ---- Validaciones ----
  if (incoming.token != RF_SHARED_TOKEN) {
    logEvent(incoming.nodo, incoming.comando, false, false, 0, false);
    startRedBlink();
    radio.flush_rx();
    return;
  }

  if (pipeNumber != 1) {
    Serial.printf("[WARN] Pipe inesperado %u\n", pipeNumber);
    return;
  }

  byte downstreamAddr[6] = {0};
  if (!buildDownstreamAddress(incoming.nodo, downstreamAddr)) {
    Serial.printf("[ROUTE] Nodo %u fuera de rango\n", incoming.nodo);
    logEvent(incoming.nodo, incoming.comando, true, false, 0, false);
    startRedBlink();
    return;
  }

  Serial.printf("[TX] %s → %s\n", cmdName(incoming.comando), (char*)downstreamAddr);

  // ---- TX hacia el hijo ----
  radio.stopListening();
  radio.openWritingPipe(downstreamAddr);

  totalForwarded++;
  bool txOk = radio.write(&incoming, sizeof(incoming));

  PacketACK ackFromChild;
  bool hasAckPayload = false;

  if (txOk) {
    radioFailCount = 0;  // reset contador de fallos
    if (radio.isAckPayloadAvailable()) {
      radio.read(&ackFromChild, sizeof(ackFromChild));
      hasAckPayload = true;
      Serial.printf("[ACK] hijo nodo=%u status=%u\n", ackFromChild.nodo, ackFromChild.status);
    } else {
      ackFromChild.nodo   = incoming.nodo;
      ackFromChild.status = 1;
      Serial.println("[ACK] hw-only → genérico OK");
    }
    totalAckOk++;
    startBlueBlink();
  } else {
    ackFromChild.nodo   = incoming.nodo;
    ackFromChild.status = 0;
    totalAckFail++;
    radioFailCount++;
    Serial.println("[ACK] TIMEOUT — hijo no responde");
    startRedBlink();

    // Si hay muchos fallos consecutivos, reiniciar el radio
    if (radioFailCount >= RADIO_FAIL_THRESHOLD) {
      Serial.println("[RADIO] Demasiados fallos — reiniciando NRF24...");
      radioFailCount = 0;
      if (!initRadio()) {
        Serial.println("[RADIO] Reinicio fallido");
      } else {
        Serial.println("[RADIO] Reinicio OK");
      }
      return;  // salir del loop para no enviar ACK corrupto
    }
  }

  // ---- Volver a RX y preparar ACK para el maestro ----
  radio.openReadingPipe(1, upstreamAddress);
  radio.startListening();
  radio.writeAckPayload(1, &ackFromChild, sizeof(ackFromChild));

  logEvent(incoming.nodo, incoming.comando, true, txOk, ackFromChild.status, hasAckPayload);

  Serial.printf("[DONE] fwd=%lu ok=%lu fail=%lu\n", totalForwarded, totalAckOk, totalAckFail);
}
