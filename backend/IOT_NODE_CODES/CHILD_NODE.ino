// ======================================================
// NODO HIJO RF - ESP8266 D1 Mini
// Compatible con maestro RF24 (Packet + ACK)
// ======================================================

#include <SPI.h>
#include <RF24.h>

#ifdef printf_P
#undef printf_P
#endif

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <string.h>

// ======================================================
// SWITCH DE MODO
// 1 = RF | 0 = WIFI
// ======================================================
#define USE_RF 1

// ======================================================
// WIFI CONFIG (solo usado si USE_RF == 0)
// ======================================================
const char* WIFI_SSID = "";
const char* WIFI_PASS = "";

IPAddress local_IP(192, 168, 0, 2);  // ← cambia por nodo
IPAddress gateway(192, 168, 0, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);

ESP8266WebServer server(80);

// ======================================================
// NRF24
// ======================================================
#define CE_PIN   D2
#define CSN_PIN  D8
RF24 radio(CE_PIN, CSN_PIN);

// ======================================================
// IDENTIDAD — CAMBIAR POR NODO
// ======================================================
const char*    NODE_CODE    = "ALM-JC-000X-LX";  // ← cambiar
const uint8_t  NODE_RF_SLOT = ;                  // ← cambiar
const byte     address[6]   = "NODEX";            // ← cambiar

// ======================================================
// SEGURIDAD
// ======================================================
const uint32_t RF_SHARED_TOKEN = ;

const uint8_t CMD_OFF  = 0;
const uint8_t CMD_ON   = 1;
const uint8_t CMD_PING = 2;

// ======================================================
// PAQUETES
// ======================================================
struct PacketRF {
  uint8_t  nodo;
  uint8_t  comando;
  uint32_t token;
};

struct PacketACK {
  uint8_t nodo;
  uint8_t status;
};

struct PacketWiFi {
  uint8_t nodo;
  char    code[20];
  uint8_t comando;
  uint32_t token;
};

PacketRF  incomingRF;
PacketACK ack;

// ======================================================
// RELÉ
// ======================================================
#define RELAY_PIN         D1
#define RELAY_ACTIVE_LOW  true

void setRelayOff() { digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW); }
void setRelayOn()  { digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? LOW  : HIGH); }

// ======================================================
// LÓGICA COMÚN
// ======================================================
bool ejecutarComando(uint8_t comando) {
  if (comando == CMD_ON)   { setRelayOn();  Serial.println("RELE ON");  return true; }
  if (comando == CMD_OFF)  { setRelayOff(); Serial.println("RELE OFF"); return true; }
  if (comando == CMD_PING) { Serial.println("PING recibido"); return true; }
  Serial.println("COMANDO INVALIDO");
  return false;
}

bool procesarComandoRF(const PacketRF& pkt) {
  if (pkt.token != RF_SHARED_TOKEN) {
    Serial.printf("[SEC] Token invalido: 0x%08X\n", pkt.token);
    return false;
  }
  if (pkt.nodo != NODE_RF_SLOT) {
    Serial.printf("[SEC] Nodo incorrecto: %u (esperado %u)\n", pkt.nodo, NODE_RF_SLOT);
    return false;
  }
  return ejecutarComando(pkt.comando);
}

// ======================================================
// WIFI PARSER (solo compilado si USE_RF == 0)
// ======================================================
#if USE_RF == 0
bool parseWifiPacket(const String& body, PacketWiFi& pkt) {
  memset(&pkt, 0, sizeof(pkt));
  return sscanf(
    body.c_str(),
    "{\"nodo\":%hhu,\"code\":\"%19[^\"]\",\"comando\":%hhu,\"token\":%lu}",
    &pkt.nodo, pkt.code, &pkt.comando, &pkt.token
  ) == 4;
}

bool procesarComandoWiFi(const PacketWiFi& pkt) {
  if (pkt.token != RF_SHARED_TOKEN) return false;
  if (pkt.nodo  != NODE_RF_SLOT)   return false;
  if (strcmp(pkt.code, NODE_CODE) != 0) return false;
  return ejecutarComando(pkt.comando);
}

void handleCommand() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"body requerido\"}");
    return;
  }
  PacketWiFi pkt;
  if (!parseWifiPacket(server.arg("plain"), pkt)) {
    server.send(400, "application/json", "{\"error\":\"bad json\"}");
    return;
  }
  bool ok = procesarComandoWiFi(pkt);
  String res = "{\"nodo\":" + String(NODE_RF_SLOT) +
               ",\"code\":\"" + String(NODE_CODE) +
               "\",\"status\":" + String(ok ? 1 : 0) + "}";
  server.send(200, "application/json", res);
}
#endif

// ======================================================
// SETUP RF
// ======================================================
void setupRF() {
  // ──────────────────────────────────────────────────
  // FIX CRÍTICO: apagar WiFi completamente antes de
  // inicializar el NRF24L01.
  // El ESP8266 arranca con WiFi activo por defecto.
  // El transmisor WiFi interno opera en 2.4GHz y
  // genera interferencia directa sobre el NRF24L01,
  // causando pérdida intermitente de paquetes incluso
  // a distancias muy cortas.
  // ──────────────────────────────────────────────────
  WiFi.persistent(false);    // no guardar config en flash
  WiFi.mode(WIFI_OFF);       // apagar radio WiFi
  WiFi.forceSleepBegin();    // forzar sleep del modem
  delay(100);                // esperar a que el modem se apague

  Serial.println("[RF] WiFi desactivado — iniciando NRF24...");

  SPI.begin();
  delay(50);

  if (!radio.begin()) {
    Serial.println("[RF] NRF24 NO DETECTADO — revisa SPI/CE/CSN");
    while (1) delay(1000);
  }

  radio.setChannel(90);
  radio.setDataRate(RF24_250KBPS);
  radio.setPALevel(RF24_PA_HIGH);
  radio.setAutoAck(true);
  radio.enableAckPayload();
  radio.setRetries(5, 15);

  radio.openReadingPipe(1, address);

  // Precargar ACK payload inicial
  // El NRF24L01 necesita tener el ACK listo ANTES
  // de que llegue el primer paquete para poder
  // incluirlo en la respuesta automática de hardware.
  ack.nodo   = NODE_RF_SLOT;
  ack.status = 1;
  radio.writeAckPayload(1, &ack, sizeof(ack));

  radio.startListening();

  Serial.printf("[RF] Listo | slot=%u | addr=%s | canal=90 | 250KBPS\n",
    NODE_RF_SLOT, (const char*)address);
}

// ======================================================
// SETUP WIFI
// ======================================================
void setupWiFi() {
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);

  if (!WiFi.config(local_IP, gateway, subnet, dns)) {
    Serial.println("[WiFi] Error configurando IP");
  }

  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 30000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Error de conexión");
    while (1) delay(1000);
  }

  Serial.printf("[WiFi] Conectado | IP: %s\n", WiFi.localIP().toString().c_str());

#if USE_RF == 0
  server.on("/cmd", HTTP_POST, handleCommand);
  server.begin();
  Serial.println("[WiFi] Servidor HTTP listo en /cmd");
#endif
}

// ======================================================
// SETUP
// ======================================================
void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(RELAY_PIN, OUTPUT);
  setRelayOff();

  Serial.println("\n=========================");
  Serial.printf("NODO %s | slot %u\n", NODE_CODE, NODE_RF_SLOT);
  Serial.println("=========================");

#if USE_RF
  setupRF();
#else
  setupWiFi();
#endif

  Serial.println("[OK] Sistema operativo\n");
}

// ======================================================
// LOOP
// ======================================================
void loop() {
#if USE_RF
  if (radio.available()) {
    radio.read(&incomingRF, sizeof(incomingRF));

    Serial.printf("[RX] nodo=%u cmd=%u token=0x%08X\n",
      incomingRF.nodo, incomingRF.comando, incomingRF.token);

    bool ok = procesarComandoRF(incomingRF);

    // Precargar ACK para el SIGUIENTE paquete
    ack.nodo   = NODE_RF_SLOT;
    ack.status = ok ? 1 : 0;
    radio.writeAckPayload(1, &ack, sizeof(ack));
  }
#else
  server.handleClient();
#endif
}
