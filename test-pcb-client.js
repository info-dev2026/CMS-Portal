/**
 * Standalone PCB Hardware Telemetry Test Script
 * 
 * Simulates an EV Charger PCB controller sending real-time sensor packets
 * to the Charger Portal API using the charger's unique API key.
 * 
 * Run with: node test-pcb-client.js
 */

const http = require('http');

// Config: Default Key for Bay 01
const API_KEY = process.env.PCB_KEY || 'evc_live_9f82d1c470be31980a32e1';
const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

let soc = 76.5;
let voltage = 415.0;
let current = 145.0;
let reqVoltage = 425.0;
let reqCurrent = 160.0;
let batteryTemp = 33.8;
let chargerTemp = 41.2;

console.log('========================================================');
console.log('⚡ SIMULATING PCB TELEMETRY STREAM');
console.log(`🔑 Using PCB API Key: ${API_KEY}`);
console.log(`🌐 Target: http://${HOST}:${PORT}/api/telemetry`);
console.log('========================================================');

function sendPacket() {
  // Simulate battery charging progress & micro ADC sensor noise
  soc = Math.min(100, +(soc + 0.1).toFixed(2));
  voltage = +(voltage + (Math.random() - 0.5) * 1.5).toFixed(1);
  current = +(current + (Math.random() - 0.5) * 2.0).toFixed(1);
  batteryTemp = +(batteryTemp + (Math.random() - 0.5) * 0.1).toFixed(1);

  // If SoC > 85%, simulate BMS tapering current demand (Constant Voltage Mode)
  if (soc > 85) {
    reqCurrent = Math.max(30, +(reqCurrent - 1.5).toFixed(1));
    current = Math.min(current, reqCurrent);
  }

  const payload = JSON.stringify({
    charger_voltage: voltage,
    charger_current: current,
    battery_soc: soc,
    battery_req_voltage: reqVoltage,
    battery_req_current: reqCurrent,
    battery_temp: batteryTemp,
    charger_temp: chargerTemp,
    status: 'CHARGING',
    charging_mode: soc > 85 ? 'CV TAPER MODE' : 'SPORT PLUS // CC FAST'
  });

  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/telemetry',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'x-api-key': API_KEY
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      const now = new Date().toLocaleTimeString();
      try {
        const json = JSON.parse(body);
        if (json.success) {
          console.log(`[${now}] ✅ Ingested: ${voltage}V, ${current}A (${json.power_kw} kW) | Req: ${reqVoltage}V, ${reqCurrent}A | SoC: ${soc}%`);
        } else {
          console.log(`[${now}] ❌ Rejected: ${json.error}`);
        }
      } catch (e) {
        console.log(`[${now}] Response: ${body}`);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`❌ Connection error: ${err.message}. Make sure server is running.`);
  });

  req.write(payload);
  req.end();
}

// Send initial packet then repeat at 1 Hz
sendPacket();
setInterval(sendPacket, 1200);
