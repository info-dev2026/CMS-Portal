/**
 * Standalone PCB Hardware Telemetry Test Script
 * 
 * Simulates an EV Charger PCB controller sending real-time sensor packets
 * to the Charger Portal API using the charger's unique API key.
 * 
 * Run with: node test-pcb-client.js
 */

const http = require('http');

// Config: Default Key for Bay 01 / Active Fleet Charger
const API_KEY = process.env.PCB_KEY || 'evc_live_959f59a8a1f8a7e728815256';
const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

// Battery connection flag: can be set via --disconnected / --connected argument or env variable
const isDisconnectedArg = process.argv.includes('--disconnected') || process.env.BATTERY_CONNECTED === 'false';
let batteryConnected = !isDisconnectedArg;

let soc = batteryConnected ? 76.5 : 0.0;
let voltage = batteryConnected ? 415.0 : 0.0;
let current = batteryConnected ? 145.0 : 0.0;
let reqVoltage = batteryConnected ? 425.0 : 0.0;
let reqCurrent = batteryConnected ? 160.0 : 0.0;
let batteryTemp = batteryConnected ? 33.8 : 24.0;
let chargerTemp = 41.2;
let chargingState = batteryConnected ? 'CHARGING' : 'IDLE';

console.log('========================================================');
console.log('⚡ SIMULATING PCB TELEMETRY & HARDWARE CONTROLLER STREAM');
console.log(`🔑 Using PCB API Key: ${API_KEY}`);
console.log(`🌐 Target: http://${HOST}:${PORT}/api/telemetry`);
console.log(`🔋 Battery Hardware Status: ${batteryConnected ? 'CONNECTED (BMS Engaged)' : 'DISCONNECTED (No Battery)'}`);
console.log('💡 Tip: Run with "node test-pcb-client.js --disconnected" to simulate unplugged battery');
console.log('========================================================');

function sendPacket() {
  if (batteryConnected) {
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
    chargingState = 'CHARGING';
  } else {
    voltage = 0.0;
    current = 0.0;
    soc = 0.0;
    reqVoltage = 0.0;
    reqCurrent = 0.0;
    chargingState = 'IDLE';
  }

  const payload = JSON.stringify({
    charger_voltage: voltage,
    charger_current: current,
    battery_soc: soc,
    battery_req_voltage: reqVoltage,
    battery_req_current: reqCurrent,
    battery_temp: batteryTemp,
    charger_temp: chargerTemp,
    battery_connected: batteryConnected,
    status: chargingState,
    charging_mode: !batteryConnected ? 'STANDBY // NO BATTERY' : (soc > 85 ? 'CV TAPER MODE' : 'SPORT PLUS // CC FAST')
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
          console.log(`[${now}] ✅ Ingested: ${voltage}V, ${current}A (${json.power_kw} kW) | Battery: ${batteryConnected ? 'CONNECTED' : 'DISCONNECTED'} | SoC: ${soc}%`);

          // Process incoming dashboard commands
          if (json.pendingCommands && Array.isArray(json.pendingCommands) && json.pendingCommands.length > 0) {
            json.pendingCommands.forEach(cmd => {
              console.log(`[${now}] 📡 PCB COMMAND RECEIVED FROM DASHBOARD: [${cmd.command}]`);
              if (cmd.command === 'AUTHENTICATE_BATTERY_CONNECT') {
                if (batteryConnected) {
                  console.log(`[${now}] 🟢 AUTH RESPONSE: Battery IS connected. Sending positive acknowledgement to CSMS.`);
                } else {
                  console.log(`[${now}] 🔴 AUTH RESPONSE: Battery is NOT connected! Hardware safety interlock active.`);
                }
              }
            });
          }
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

// Send initial packet then repeat at 1.2s intervals
sendPacket();
setInterval(sendPacket, 1200);
