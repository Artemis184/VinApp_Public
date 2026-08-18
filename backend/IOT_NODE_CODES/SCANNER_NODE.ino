// ============================================
// RF24 SCANNER v1.5 - XIAO ESP32-S3 Sense
// ============================================
// FIXES v1.5:
//   1. yield() entre pings para evitar que el
//      watchdog y el stack BLE se cuelguen
//   2. Umbral mínimo de ACKs para marcar ok=true
//      (evita falsos positivos de nodos apagados)
//   3. Configuración de targets explícita:
//      solo escanea los nodos que definas
// ============================================

#include <SPI.h>
#include <RF24.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ============================================
// PINES — XIAO ESP32-S3
// ============================================
#define CE_PIN   43
#define CSN_PIN  44
#define SCK_PIN   7
#define MISO_PIN  8
#define MOSI_PIN  9

RF24 radio(CE_PIN, CSN_PIN);

// ============================================
// PROTOCOLO RF24
// ============================================
const uint32_t RF_SHARED_TOKEN = ;
const uint8_t  CMD_PING        = ;
const uint8_t  RF_CHANNEL      = 90;

// ============================================
// TARGETS A ESCANEAR
// ============================================
// ⚠️ EDITA AQUÍ: solo pon los nodos que
// realmente existen en tu red.
//
// slot: número que verá la app (1-9)
// label: nombre visible en el CSV y la app
// address: dirección RF24 (debe coincidir
//          con el firmware del nodo)
// minAckPct: % mínimo de ACKs para ok=true
//            (0 = cualquier ACK cuenta,
//             30 = necesita ≥30% de respuestas)
// ============================================
struct ScanTarget {
  uint8_t    slot;
  const char* label;
  byte        address[6];
  uint8_t    minAckPct;  // umbral anti-falsos
};

const uint8_t TOTAL_TARGETS = 4;  // ← cambia este número si agregas/quitas

ScanTarget targets[TOTAL_TARGETS] = {
  // slot  label     address   minAckPct
  {  1,   "NODE1",  "NODE1",  30  },  // nodo 1
  {  2,   "NODE2",  "NODE2",  30  },  // nodo 2
  {  3,   "NODE3",  "NODE3",  30  },  // nodo 3 (el que tienes cerca)
  {  6,   "RPT01",  "RPT01",  10  },  // repetidor (umbral bajo xk puede estar lejos)
  // Descomenta para agregar más:
  // {  4,   "NODE4",  "NODE4",  30  },
  // {  5,   "NODE5",  "NODE5",  30  },
};

// ============================================
// MEDICIÓN DE CALIDAD
// ============================================
const uint8_t  PINGS_PER_NODE = 15;   // reducido de 20 a 15 para dar más CPU al BLE
const uint16_t PING_DELAY_MS  = 25;   // ligeramente mayor para dar tiempo al yield
const int      RSSI_MIN       = -100;
const int      RSSI_MAX       = -40;

// ============================================
// ESTRUCTURAS RF24
// ============================================
struct PacketRF  { uint8_t nodo; uint8_t comando; uint32_t token; };
struct PacketACK { uint8_t nodo; uint8_t status; };

// ============================================
// BLE UUIDs
// ============================================
#define BLE_SERVICE_UUID      "12345678-1234-1234-1234-123456789abc"
#define BLE_CHAR_SCAN_UUID    "12345678-1234-1234-1234-123456789abd"
#define BLE_CHAR_CONTROL_UUID "12345678-1234-1234-1234-123456789abe"

BLEServer*         pServer      = nullptr;
BLECharacteristic* pScanChar    = nullptr;
BLECharacteristic* pControlChar = nullptr;
bool               bleConnected = false;
bool               scanActive   = false;

const unsigned long SCAN_INTERVAL_MS = 4000UL;  // aumentado para dar más respiro al BLE
unsigned long lastScanMs = 0;
uint32_t      scanSeq    = 0;

// ============================================
// BLE CALLBACKS
// ============================================
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s) override {
    bleConnected = true;
    Serial.println("[BLE] Cliente conectado");
  }
  void onDisconnect(BLEServer* s) override {
    bleConnected = false;
    scanActive   = false;
    Serial.println("[BLE] Desconectado — reanudando advertising...");
    delay(200);
    BLEDevice::startAdvertising();
  }
};

class ControlCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    String val = c->getValue().c_str();
    val.trim();
    val.toUpperCase();
    if (val == "START") {
      scanActive = true;
      lastScanMs = millis() - SCAN_INTERVAL_MS;
      Serial.println("[BLE] Scan INICIADO");
    } else if (val == "STOP") {
      scanActive = false;
      Serial.println("[BLE] Scan DETENIDO");
    }
  }
};

// ============================================
// INICIALIZAR BLE
// ============================================
void initBLE() {
  BLEDevice::init("RF24-Scanner");
  BLEDevice::setPower(ESP_PWR_LVL_P9);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* svc = pServer->createService(BLE_SERVICE_UUID);

  pScanChar = svc->createCharacteristic(
    BLE_CHAR_SCAN_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pScanChar->addDescriptor(new BLE2902());

  pControlChar = svc->createCharacteristic(
    BLE_CHAR_CONTROL_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pControlChar->setCallbacks(new ControlCallbacks());

  svc->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(BLE_SERVICE_UUID);
  adv->setScanResponse(true);
  adv->setMinPreferred(0x06);
  adv->setMaxPreferred(0x12);

  BLEAdvertisementData advData;
  advData.setName("RF24-Scanner");
  advData.setCompleteServices(BLEUUID(BLE_SERVICE_UUID));
  adv->setAdvertisementData(advData);

  BLEAdvertisementData scanData;
  scanData.setName("RF24-Scanner");
  adv->setScanResponseData(scanData);

  BLEDevice::startAdvertising();
  Serial.println("[BLE] Advertising activo — RF24-Scanner");
}

// ============================================
// HELPERS
// ============================================
int qualityToRSSI(uint8_t quality) {
  return RSSI_MIN + ((int)quality * (RSSI_MAX - RSSI_MIN)) / 100;
}

void sendBLE(uint32_t seq, uint8_t slot, const char* label,
             bool ok, int rssi, uint32_t ts) {
  if (!bleConnected) return;
  char buf[160];
  snprintf(buf, sizeof(buf),
    "{\"seq\":%lu,\"slot\":%u,\"label\":\"%s\",\"ok\":%s,\"rssi\":%d,\"ts\":%lu}",
    (unsigned long)seq, slot, label,
    ok ? "true" : "false", rssi, (unsigned long)ts);
  pScanChar->setValue((uint8_t*)buf, strlen(buf));
  pScanChar->notify();
  Serial.printf("[BLE→] %s\n", buf);
}

void sendScanEnd(uint32_t seq) {
  if (!bleConnected) return;
  char end[64];
  snprintf(end, sizeof(end), "{\"scan\":\"end\",\"seq\":%lu}", (unsigned long)seq);
  pScanChar->setValue((uint8_t*)end, strlen(end));
  pScanChar->notify();
}

// ============================================
// PING ÚNICO CON yield()
// FIX: yield() cede CPU al stack BLE entre
// cada ping para evitar que se cuelgue
// ============================================
bool pingOnce(const ScanTarget& t) {
  uint8_t nodoField = (t.slot <= 5) ? t.slot : 0;
  PacketRF pkt = { nodoField, CMD_PING, RF_SHARED_TOKEN };

  radio.stopListening();
  radio.openWritingPipe(t.address);
  bool ack = radio.write(&pkt, sizeof(pkt));

  if (ack && radio.isAckPayloadAvailable()) {
    PacketACK tmp;
    radio.read(&tmp, sizeof(tmp));
  }

  radio.startListening();

  // FIX CRÍTICO: ceder CPU al RTOS/BLE stack
  yield();

  return ack;
}

// ============================================
// MEDIR CALIDAD CON UMBRAL ANTI-FALSOS
// ============================================
uint8_t measureQuality(const ScanTarget& t,
                       uint8_t& successOut,
                       uint8_t& attemptsOut) {
  uint8_t success = 0;

  for (uint8_t i = 0; i < PINGS_PER_NODE; i++) {
    if (!bleConnected) break;

    if (pingOnce(t)) success++;

    // delay con yield embebido para no bloquear el BLE
    unsigned long d = millis();
    while (millis() - d < PING_DELAY_MS) {
      yield();
      delay(1);
    }
  }

  attemptsOut = bleConnected ? PINGS_PER_NODE : 0;
  successOut  = success;
  if (attemptsOut == 0) return 0;
  return ((uint16_t)success * 100) / attemptsOut;
}

// ============================================
// ESCANEO COMPLETO
// ============================================
void runScan() {
  scanSeq++;
  Serial.printf("\n===== SCAN #%lu =====\n", (unsigned long)scanSeq);

  for (uint8_t i = 0; i < TOTAL_TARGETS; i++) {
    if (!bleConnected) {
      Serial.println("[SCAN] BLE desconectado");
      return;
    }

    ScanTarget& t = targets[i];
    uint8_t success = 0, attempts = 0;
    uint8_t quality = measureQuality(t, success, attempts);
    int     rssi    = qualityToRSSI(quality);

    // FIX anti-falsos: aplicar umbral mínimo de % ACK
    bool ok = (success > 0) && (quality >= t.minAckPct);

    uint32_t ts = millis();

    Serial.printf("[%s] %s | ACK: %u/%u | Quality: %u%% | RSSI: %d%s\n",
      t.label,
      ok ? "OK" : "SIN RESP",
      success, attempts, quality, rssi,
      (success > 0 && !ok) ? " (descartado por umbral)" : "");

    sendBLE(scanSeq, t.slot, t.label, ok, rssi, ts);

    // yield entre nodos para dar respiro al BLE
    yield();
    delay(30);
  }

  sendScanEnd(scanSeq);
  Serial.println("==== SCAN COMPLETADO ====\n");
}

// ============================================
// SETUP
// ============================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=== RF24 SCANNER v1.5 ===");

  Serial.println("[TARGETS]");
  for (uint8_t i = 0; i < TOTAL_TARGETS; i++) {
    Serial.printf("  Slot %u → %s (umbral: %u%%)\n",
      targets[i].slot, targets[i].label, targets[i].minAckPct);
  }

  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, CSN_PIN);
  delay(100);

  Serial.print("[RF24] Inicializando... ");
  if (!radio.begin()) {
    Serial.println("FALLO — revisa cableado");
    while (1) { yield(); delay(1000); }
  }
  Serial.println("OK");

  radio.setChannel(RF_CHANNEL);
  radio.setDataRate(RF24_250KBPS);
  radio.setPALevel(RF24_PA_HIGH);
  radio.setAutoAck(true);
  radio.enableAckPayload();
  radio.setRetries(5, 10);
  radio.startListening();

  Serial.printf("[RF24] Canal:%u | 250KBPS | PA_HIGH | Token:0x%08X\n",
    RF_CHANNEL, RF_SHARED_TOKEN);

  initBLE();

  Serial.println("[OK] Listo — conecta la app y presiona Iniciar scan\n");
}

// ============================================
// LOOP
// ============================================
void loop() {
  if (scanActive) {
    unsigned long now = millis();
    if (now - lastScanMs >= SCAN_INTERVAL_MS) {
      lastScanMs = now;
      runScan();
    }
  }
  // yield en el loop principal también
  yield();
  delay(5);
}