# ⚡ SAAPHZONE // CSMS Control & EV Charger Telemetry Portal

A comprehensive, enterprise-grade **EV Charging Station Management System (CSMS)** and **Real-Time Hardware Telemetry Portal** developed for **SAAPHZONE CSMS CONTROL**.

---

## 🌟 Key Updates & Features

### 1. 🖥️ CSMS Control Dashboard (Exact Match to Your Home Page)
- **Left Navy Navigation Sidebar (`#0b1a2e`)**:
  - **SAAPHZONE CSMS CONTROL** logo with modern geometric brand insignia.
  - Active **Dashboard** tab in vibrant cyan pill (`#00a3e0`), **Charge Points**, **Sessions**, **Tariffs**, **RFID / Tokens**.
  - **ADMINISTRATION**: **Users & Credentials**, **Organizations**, **OCPI Roaming**, **Audit Log**.
  - User footer card with **Administrator / ADMIN** profile and **Sign out** button.
- **Top Header Status & KPI Cards**:
  - **CHARGE POINTS**: `4` (with cyan accent bar)
  - **ONLINE NOW**: `3/4` (with green accent bar)
  - **ACTIVE SESSIONS**: `1` (with cyan accent bar)
  - **ENERGY DELIVERED**: `570.1 kWh` (with cyan accent bar)
  - **REVENUE**: `₹10,493` (with green accent bar)
  - **TOTAL SESSIONS**: `23` (with cyan accent bar)
- **Energy — last 7 days Bar Chart**:
  - Daily kWh delivered across the network (Thu: 120 kWh, Fri: 310 kWh, Sat: 25 kWh, Sun: 65 kWh, Mon: 140 kWh, Tue: 115 kWh, Wed: 72 kWh).
- **Live Connected Charge Points Table**:
  - Live table showing each charge point's status, actual Voltage & Current, battery BMS demand Voltage & Current, battery percentage present, power in kW, API Key, and 1-click access to Live Cockpit.

---

### 2. 🔐 Authentication & Login System (Admin & Every Charger)
- Dedicated login page accessible at the root URL.
- **Administrator Login**:
  - Default Username: `admin`
  - Default Password: `password123`
  - *Full control to customize your username and password at any time via the **Users & Credentials** tab!*
- **Charger Terminal Logins**:
  - Every charger has its own **Username** and **Password** defined by you:
    - `bay01` / `password123` (Bay 01)
    - `bay02` / `password123` (Bay 02)
    - `bay03` / `password123` (Bay 03)
    - `bay04` / `password123` (Bay 04)
  - When a charger terminal logs in, it lands directly in its dedicated **Live Telemetry Cockpit**!
  - Admin can change the username and password for any charger terminal at any time with 1 click in the portal.

---

### 3. 🌓 Light Theme & Dark Theme Switcher
- Dedicated **Theme Switcher** button (`☀️ Light Theme / 🌙 Dark Theme`) available:
  - On the **Login Screen**
  - In the **App Top Header**
- Seamless transition between:
  - **Light Theme**: High-contrast, clean white surfaces matching your CSMS screenshot.
  - **Dark Theme**: Sleek deep navy and slate surfaces (`#0b1120`, `#131d33`) with glowing cyan accents.
- Preserves your theme selection across browser refreshes via `localStorage`.

---

### 4. 🔋 Dedicated Battery Percentage Button
- Prominently reflects the **exact percentage of charge the battery already has** in real time:
  - **Top Header Status Button**: Displays `🔋 78% BATTERY PRESENT` with glowing pill and real-time updates.
  - **Cockpit Center Button**: A prominent circular radial gauge button displaying `78% BATTERY CURRENT STATE • 78% Already Charged`.
  - **Fleet Cards & Table**: Dedicated battery percentage pills dynamically reflecting the battery level present.

---

### 5. 🔤 Professional Typography & Branding
- Fully replaced "Porsche" with **SAAPHZONE** across all headers, cluster displays, firmware snippets, and telemetry tags.
- Replaced futuristic gaming fonts with the clean, corporate **Inter** typography (`'Inter', sans-serif`) with crisp numbers and tabular figures for an enterprise CSMS standard.

---

## 🔌 Hardware PCB Integration Guide

### HTTP POST Endpoint
- **Method**: `POST`
- **URL**: `http://<SERVER_IP>:3000/api/telemetry`
- **Headers**:
  - `Content-Type: application/json`
  - `x-api-key: <YOUR_CHARGER_API_KEY>`

### JSON Telemetry Payload
```json
{
  "charger_voltage": 418.5,
  "charger_current": 148.2,
  "battery_soc": 78.0,
  "battery_req_voltage": 425.0,
  "battery_req_current": 160.0,
  "battery_temp": 34.2,
  "charger_temp": 41.5,
  "status": "CHARGING"
}
```

---

### ESP32 / Arduino (C++) Code Snippet
```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://YOUR_SERVER_IP:3000/api/telemetry";
const char* pcbKey = "evc_live_9f82d1c470be31980a32e1"; // Generated Key for your charger

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected to SAAPHZONE CSMS!");
}

void sendTelemetry(float vOut, float aOut, float soc, float vReq, float aReq, float bTemp) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", pcbKey);

    StaticJsonDocument<256> doc;
    doc["charger_voltage"] = vOut;
    doc["charger_current"] = aOut;
    doc["battery_soc"] = soc;
    doc["battery_req_voltage"] = vReq;
    doc["battery_req_current"] = aReq;
    doc["battery_temp"] = bTemp;
    doc["status"] = "CHARGING";

    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);
    Serial.printf("Telemetry HTTP Response: %d\n", httpResponseCode);
    http.end();
  }
}

void loop() {
  // Read sensor inputs from PCB ADC / CAN Bus:
  float vOut = 418.5; // measured output voltage
  float aOut = 148.2; // measured output current
  float soc  = 78.0;  // Battery SoC %
  float vReq = 425.0; // BMS requested voltage
  float aReq = 160.0; // BMS requested current
  float bTemp = 34.2; // Battery pack temperature

  sendTelemetry(vOut, aOut, soc, vReq, aReq, bTemp);
  delay(1000); // 1 Hz stream rate
}
```

---

## 🚀 Running the Portal

The server is currently running at:
- **Web Portal**: [http://localhost:3000](http://localhost:3000)
- **Telemetry Ingestion Endpoint**: `POST http://localhost:3000/api/telemetry`
- **Real-Time WebSocket**: `ws://localhost:3000`

To start or restart the server at any time:
```bash
npm start
```

To run the terminal PCB simulator test:
```bash
npm run simulate
```
