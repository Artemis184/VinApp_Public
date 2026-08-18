# 🔧 Guía de Diagnóstico: RF24 no envía comandos

## 🎯 Problema Actual

```
✅ Backend WebSocket → Funciona perfecto
✅ HTTP al ESP8266 → Llega correctamente (200 OK)
❌ RF24 write() → FALLA (sin auto-ack)
```

**Síntoma:**

```cpp
➡️ Enviando a nodo 3 comando 0
❌ write() falló (sin auto-ack)
```

---

## 🔍 Causas Posibles

### 1️⃣ **Nodo Esclavo NO está escuchando**

**Verificar:**

- ¿Está encendido el nodo esclavo #3?
- ¿Tiene energía suficiente? (NRF24 necesita 3.3V estable)
- ¿El código del esclavo está cargado y corriendo?

**Código mínimo para nodo esclavo:**

```cpp
#include <SPI.h>
#include <RF24.h>

#define CE_PIN  9
#define CSN_PIN 10

RF24 radio(CE_PIN, CSN_PIN);
const byte address[6] = "NODE3"; // 🔥 DEBE COINCIDIR CON EL MAESTRO

struct PacketTX {
  uint8_t nodo;
  uint8_t comando;
};

void setup() {
  Serial.begin(115200);
  SPI.begin();

  if (!radio.begin()) {
    Serial.println("❌ NRF24 NO DETECTADO");
    while(1);
  }

  radio.setChannel(90);           // 🔥 MISMO CANAL
  radio.setPALevel(RF24_PA_HIGH); // 🔥 MISMA POTENCIA
  radio.setDataRate(RF24_250KBPS);// 🔥 MISMA VELOCIDAD
  radio.setAutoAck(true);
  radio.enableAckPayload();

  radio.openReadingPipe(1, address);
  radio.startListening(); // 🔥 CRUCIAL: DEBE ESTAR ESCUCHANDO

  Serial.println("✅ Esclavo escuchando en NODE3...");
}

void loop() {
  if (radio.available()) {
    PacketTX rx;
    radio.read(&rx, sizeof(rx));

    Serial.printf("📩 Recibido: nodo=%d comando=%d\n", rx.nodo, rx.comando);

    // Controlar pin según comando
    if (rx.comando == 1) {
      digitalWrite(LED_BUILTIN, HIGH);
      Serial.println("🟢 ALARMA ON");
    } else {
      digitalWrite(LED_BUILTIN, LOW);
      Serial.println("🔴 ALARMA OFF");
    }
  }
}
```

---

### 2️⃣ **Configuración RF24 no coincide**

**Verificar que MAESTRO y ESCLAVO tengan:**

| Parámetro   | Valor                                  |
| ----------- | -------------------------------------- |
| Canal       | 90                                     |
| Data Rate   | RF24_250KBPS                           |
| PA Level    | RF24_PA_HIGH (o LOW si están cerca)    |
| Auto ACK    | true                                   |
| Direcciones | "NODE1", "NODE2", "NODE3"... (5 bytes) |

---

### 3️⃣ **Hardware mal conectado**

**Conexiones NRF24L01+ en ESP8266:**

```
NRF24L01+    ESP8266
---------    --------
VCC    →     3.3V (con condensador 10uF)
GND    →     GND
CE     →     D1 (GPIO 5)
CSN    →     D2 (GPIO 4)
SCK    →     D5 (GPIO 14)
MOSI   →     D7 (GPIO 13)
MISO   →     D6 (GPIO 12)
IRQ    →     No conectar (opcional)
```

⚠️ **IMPORTANTE:**

- **NO conectar VCC a 5V** (el NRF24 es 3.3V)
- Usar **condensador 10uF** entre VCC y GND (cerca del módulo)
- Cables cortos (< 10cm)
- Verificar soldaduras

**En Arduino (esclavo):**

```
NRF24L01+    Arduino Nano
---------    ------------
VCC    →     3.3V (con condensador)
GND    →     GND
CE     →     D9
CSN    →     D10
SCK    →     D13
MOSI   →     D11
MISO   →     D12
IRQ    →     No conectar
```

---

### 4️⃣ **Distancia o interferencias**

**Verificar:**

- ¿Están los módulos cerca? (< 5 metros para prueba inicial)
- ¿Hay obstáculos metálicos entre ellos?
- ¿Hay otros dispositivos en 2.4GHz? (WiFi, Bluetooth)

**Solución temporal:**

```cpp
radio.setPALevel(RF24_PA_MAX); // Máxima potencia
```

---

## 🛠️ Pasos de Diagnóstico

### Paso 1: Verificar maestro solo

Carga el código corregido `ESP8266_MAESTRO_FIXED.ino` y abre Serial Monitor:

```
✅ WiFi OK
📍 IP: 192.168.4.30
✅ NRF24 OK
   Canal: 90
   Potencia: 3
   DataRate: 250
🌐 Servidor Web iniciado
```

Si ves `❌ NRF24 NO DETECTADO`:

- Revisar conexiones
- Verificar alimentación 3.3V
- Probar otro módulo NRF24

---

### Paso 2: Test de loopback (maestro se envía a sí mismo)

Añade en `setup()` del maestro:

```cpp
void setup() {
  // ... código existente ...

  // TEST: El maestro se escribe a sí mismo
  Serial.println("🧪 Test de loopback...");

  byte testAddr[6] = "TEST1";
  radio.openWritingPipe(testAddr);
  radio.openReadingPipe(1, testAddr);

  uint8_t testData = 42;
  radio.stopListening();
  bool ok = radio.write(&testData, sizeof(testData));

  if (ok) {
    Serial.println("✅ Write OK - Hardware funciona");
  } else {
    Serial.println("❌ Write FALLÓ - Problema de hardware");
  }

  // Continuar con configuración normal...
}
```

---

### Paso 3: Verificar esclavo está escuchando

Carga el código de esclavo y abre Serial Monitor:

```
✅ Esclavo escuchando en NODE3...
```

Si no arranca:

- Verificar NRF24 conectado correctamente
- Verificar alimentación 3.3V estable

---

### Paso 4: Test simple maestro → esclavo

**En maestro:**

```cpp
Serial.println("📡 Enviando test a NODE3...");
enviarComando(3, 1); // ON
delay(2000);
enviarComando(3, 0); // OFF
```

**Esperado en esclavo:**

```
📩 Recibido: nodo=3 comando=1
🟢 ALARMA ON
📩 Recibido: nodo=3 comando=0
🔴 ALARMA OFF
```

---

## 🎯 Solución Rápida (Checklist)

✅ **Hardware:**

- [ ] NRF24 conectado correctamente (VCC → 3.3V)
- [ ] Condensador 10uF en VCC/GND
- [ ] Cables cortos y firmes

✅ **Software:**

- [ ] Mismo canal (90) en maestro y esclavo
- [ ] Misma velocidad (RF24_250KBPS)
- [ ] Misma potencia (RF24_PA_HIGH o LOW)
- [ ] Direcciones correctas ("NODE1", "NODE2"...)

✅ **Código esclavo:**

- [ ] `radio.startListening()` está llamado
- [ ] Está en un loop verificando `radio.available()`
- [ ] Address coincide con el índice del nodo

✅ **Pruebas:**

- [ ] Maestro detecta NRF24 (no dice "NO DETECTADO")
- [ ] Esclavo detecta NRF24
- [ ] Están a < 2 metros de distancia (para prueba)

---

## 📊 Códigos de Error

| Error                | Causa                  | Solución                              |
| -------------------- | ---------------------- | ------------------------------------- |
| `NRF24 NO DETECTADO` | No conectado o malo    | Revisar cables/soldaduras             |
| `write() falló`      | Esclavo no escucha     | Cargar código en esclavo              |
| `ACK inválido`       | Packet corrupto        | Verificar interferencias              |
| `Sin payload`        | Esclavo no prepara ACK | Normal si no usas `writeAckPayload()` |

---

## 🚀 Próximos Pasos

1. **Sube código corregido** al ESP8266 maestro
2. **Verifica** que detecta NRF24
3. **Carga código** en nodo esclavo #3
4. **Prueba** desde el backend con WebSocket
5. Si funciona, **replica** para nodos 1, 2, 4, 5

---

## 💡 Nota sobre el Backend

El backend **YA ESTÁ FUNCIONANDO PERFECTO**. No necesitas cambiar nada ahí.

El problema es 100% del lado RF24 (hardware + firmware ESP8266/Arduino).

Una vez que el RF24 funcione, todo el sistema trabajará en tiempo real:

```
Frontend → WebSocket → Backend → HTTP → ESP8266 → RF24 → Nodo Esclavo
                                                              ↓
                                                      🔔 Alarma ON/OFF
```

¡Éxito! 🎉
