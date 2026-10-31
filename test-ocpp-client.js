/**
 * Standalone OCPP 1.6-J Hardware PCB Simulator
 *
 * Simulates an EV Charger Hardware Controller running embedded firmware communicating with
 * the Charger Portal (CSMS) over OCPP 1.6-J JSON WebSockets.
 *
 * Demonstrates:
 * 1. Physical Charger ON Button -> Firmware startup -> StartTransaction to Portal -> Starts Charging
 * 2. Portal Remote Start & Remote Stop commands (RemoteStartTransaction / RemoteStopTransaction)
 * 3. Live OCPP MeterValues telemetry stream (Voltage, Current, Power kW, SoC, Energy Wh, Temp)
 *
 * Run with:
 *   node test-ocpp-client.js
 *   node test-ocpp-client.js --charger chg_bay_01
 *   node test-ocpp-client.js --auto-start
 */

const WebSocket = require('ws');
const readline = require('readline');
const http = require('http');

// Command line arguments parsing
const args = process.argv.slice(2);
const chargerArgIdx = args.indexOf('--charger');
let chargerId = chargerArgIdx !== -1 && args[chargerArgIdx + 1] ? args[chargerArgIdx + 1] : (process.env.CHARGER_ID || null);
const host = process.env.HOST || 'localhost';
const port = process.env.PORT || 3000;
const autoStart = args.includes('--auto-start');
const isNonInteractive = args.includes('--non-interactive') || !process.stdin.isTTY;

let wsUrl = '';

function resolveChargerId() {
  if (chargerId) return Promise.resolve(chargerId);
  return new Promise((resolve) => {
    http.get(`http://${host}:${port}/api/chargers`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.chargers && json.chargers.length > 0) {
            return resolve(json.chargers[0].id);
          }
        } catch (e) {}
        resolve('chg_bay_01');
      });
    }).on('error', () => {
      resolve('chg_bay_01');
    });
  });
}


let ws = null;
let isConnected = false;
let isCharging = false;
let activeTransactionId = null;
let currentMeterWh = 12450;
let soc = 68.0;
let voltage = 415.0;
let current = 145.0;
let telemetryTimer = null;
let heartbeatTimer = null;
let msgCounter = 1;

const pendingResponses = new Map(); // msgId -> { resolve, reject }

function getUniqueId() {
  return `pcb_${Date.now()}_${msgCounter++}`;
}

function sendCall(action, payload) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return reject(new Error('WebSocket not connected'));
    }
    const uniqueId = getUniqueId();
    const packet = JSON.stringify([2, uniqueId, action, payload]);
    pendingResponses.set(uniqueId, { resolve, reject, action });
    ws.send(packet);
    console.log(`➡️  [OUTBOUND OCPP CALL] [${action}] (ID: ${uniqueId})`);
  });
}

function sendCallResult(uniqueId, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const packet = JSON.stringify([3, uniqueId, payload]);
  ws.send(packet);
  console.log(`➡️  [OUTBOUND CALLRESULT] (ID: ${uniqueId})`);
}

function connect() {
  console.log(`Connecting to CSMS Portal via WebSocket (protocol: ocpp1.6)...`);
  ws = new WebSocket(wsUrl, ['ocpp1.6']);

  ws.on('open', () => {
    isConnected = true;
    console.log(`\n✅ Connected to Portal CSMS successfully!`);
    console.log(`----------------------------------------------------------------`);
    
    // Step 1: Send BootNotification (Firmware handshake)
    sendCall('BootNotification', {
      chargePointVendor: 'SaaphZone Systems',
      chargePointModel: 'SZ-PCB-EVSE-800V',
      firmwareVersion: '3.4.2-RELEASE',
      chargePointSerialNumber: `SN-${chargerId.toUpperCase()}`
    }).then(res => {
      console.log(`📥 [CSMS RESPONSE] BootNotification:`, res);
      
      // Step 2: Send StatusNotification (Ready / Available)
      return sendCall('StatusNotification', {
        connectorId: 1,
        errorCode: 'NoError',
        status: 'Available',
        timestamp: new Date().toISOString()
      });
    }).then(() => {
      console.log(`📥 [CSMS RESPONSE] StatusNotification acknowledged.`);
      startHeartbeat();
      printInstructions();

      if (autoStart) {
        console.log(`\n⏳ Auto-start enabled. Simulating physical ON button press in 2 seconds...`);
        setTimeout(handlePhysicalButtonStart, 2000);
      }
    }).catch(err => {
      console.error(`❌ Boot handshake error:`, err.message);
    });
  });

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (!Array.isArray(parsed)) return;

      const messageTypeId = parsed[0];
      const uniqueId = parsed[1];

      if (messageTypeId === 2) {
        // CALL from Portal (RemoteStartTransaction, RemoteStopTransaction, Reset, etc.)
        const action = parsed[2];
        const payload = parsed[3] || {};
        handleIncomingPortalCall(uniqueId, action, payload);
      } else if (messageTypeId === 3) {
        // CALLRESULT from Portal
        const payload = parsed[2] || {};
        const pending = pendingResponses.get(uniqueId);
        if (pending) {
          pendingResponses.delete(uniqueId);
          pending.resolve(payload);
        }
      } else if (messageTypeId === 4) {
        // CALLERROR from Portal
        const errorCode = parsed[2];
        const errorDesc = parsed[3];
        const pending = pendingResponses.get(uniqueId);
        if (pending) {
          pendingResponses.delete(uniqueId);
          pending.reject(new Error(`${errorCode}: ${errorDesc}`));
        }
      }
    } catch (e) {
      console.error(`❌ Error parsing message:`, e.message);
    }
  });

  ws.on('close', (code, reason) => {
    isConnected = false;
    isCharging = false;
    stopTelemetry();
    stopHeartbeat();
    console.log(`\n⚠️ Disconnected from CSMS (${code}: ${reason || 'Closed'}). Reconnecting in 3s...`);
    setTimeout(connect, 3000);
  });

  ws.on('error', (err) => {
    console.error(`❌ WebSocket error: ${err.message}`);
  });
}

/**
 * Handle incoming OCPP CALL commands from the Portal CSMS
 */
function handleIncomingPortalCall(uniqueId, action, payload) {
  console.log(`\n================================================================`);
  console.log(`📥 [INCOMING PORTAL COMMAND] Action: [${action}]`);
  console.log(`   Payload:`, payload);
  console.log(`================================================================`);

  if (action === 'RemoteStartTransaction') {
    // Portal operator clicked "Turn Charger ON / Start" in the web dashboard!
    const { idTag, connectorId } = payload;
    console.log(`[FIRMWARE] ⚡ Portal Operator requested RemoteStartTransaction.`);
    console.log(`[FIRMWARE] Running safety checks... Pilot signal OK. Engaging contactor...`);

    // Acknowledge portal immediately
    sendCallResult(uniqueId, { status: 'Accepted' });

    // Begin firmware charging loop & send StartTransaction to portal
    setTimeout(() => {
      startChargingSequence(idTag || 'PORTAL_REMOTE');
    }, 500);

  } else if (action === 'RemoteStopTransaction') {
    // Portal operator clicked "Turn Charger OFF / Stop" in the web dashboard!
    const { transactionId } = payload;
    console.log(`[FIRMWARE] ⏹ Portal Operator requested RemoteStopTransaction for Tx #${transactionId}.`);
    console.log(`[FIRMWARE] Ramp-down current... Opening main contactor relay...`);

    // Acknowledge portal immediately
    sendCallResult(uniqueId, { status: 'Accepted' });

    // Terminate charging sequence & report StopTransaction to portal
    setTimeout(() => {
      stopChargingSequence('Remote');
    }, 500);

  } else if (action === 'Reset') {
    const { type } = payload;
    console.log(`[FIRMWARE] 🔄 Reset command received (${type}). Rebooting firmware...`);
    sendCallResult(uniqueId, { status: 'Accepted' });
    if (isCharging) stopChargingSequence('Reset');
    setTimeout(() => {
      console.log(`[FIRMWARE] Reboot complete.`);
    }, 1500);

  } else if (action === 'UnlockConnector') {
    console.log(`[FIRMWARE] 🔓 Unlocking connector latch relay...`);
    sendCallResult(uniqueId, { status: 'Unlocked' });

  } else {
    sendCallResult(uniqueId, {});
  }
}

/**
 * FLOW 1: User presses physical "ON" button on the physical charger / PCB
 */
function handlePhysicalButtonStart() {
  if (isCharging) {
    console.log(`⚠️ Charger is already in an active charging session (Tx #${activeTransactionId}).`);
    return;
  }
  console.log(`\n================================================================`);
  console.log(`🔘 [PHYSICAL BUTTON PRESSED] Charger ON Button Triggered on Hardware!`);
  console.log(`[FIRMWARE] Step 1: Hardware interrupt received.`);
  console.log(`[FIRMWARE] Step 2: Microcontroller checks Pilot CP line & interlock.`);
  console.log(`[FIRMWARE] Step 3: Sending Authorize & StartTransaction to Portal CSMS...`);
  console.log(`================================================================`);

  // Authorize tag/button
  sendCall('Authorize', { idTag: 'PHYSICAL_BUTTON_USER' })
    .then(authRes => {
      console.log(`📥 [CSMS Authorize]:`, authRes);
      if (authRes.idTagInfo && authRes.idTagInfo.status === 'Accepted') {
        startChargingSequence('PHYSICAL_BUTTON_USER');
      } else {
        console.warn(`❌ Authorization denied by portal:`, authRes);
      }
    })
    .catch(err => {
      console.error(`❌ StartTransaction request failed:`, err.message);
    });
}

/**
 * FLOW 1 & 2 Execution: Start charging sequence and continuous telemetry
 */
function startChargingSequence(idTag) {
  if (isCharging) return;

  sendCall('StartTransaction', {
    connectorId: 1,
    idTag: idTag,
    meterStart: Math.round(currentMeterWh),
    timestamp: new Date().toISOString()
  }).then(startRes => {
    console.log(`\n📥 [CSMS StartTransaction Response]:`, startRes);
    if (startRes.idTagInfo && startRes.idTagInfo.status === 'Accepted') {
      activeTransactionId = startRes.transactionId || 1001;
      isCharging = true;
      console.log(`\n🟢 [CHARGING IN PROGRESS] Main contactor CLOSED. Power delivery active!`);
      console.log(`   Transaction ID: #${activeTransactionId}`);
      console.log(`   Starting live OCPP MeterValues streaming to Portal dashboard...`);

      // Send StatusNotification: Charging
      sendCall('StatusNotification', {
        connectorId: 1,
        errorCode: 'NoError',
        status: 'Charging',
        timestamp: new Date().toISOString()
      }).catch(() => {});

      startTelemetry();
    } else {
      console.warn(`❌ Portal rejected StartTransaction:`, startRes);
    }
  }).catch(err => {
    console.error(`❌ Error starting transaction:`, err.message);
  });
}

/**
 * Stop charging sequence and notify portal
 */
function stopChargingSequence(reason = 'Local') {
  if (!isCharging) {
    console.log(`⚠️ Charger is already idle.`);
    return;
  }

  const txId = activeTransactionId;
  isCharging = false;
  activeTransactionId = null;
  stopTelemetry();

  console.log(`\n================================================================`);
  console.log(`🛑 [STOP CHARGING] Reason: ${reason}`);
  console.log(`[FIRMWARE] Opening contactor. Current zeroed.`);
  console.log(`[FIRMWARE] Reporting StopTransaction to Portal CSMS (Tx #${txId})...`);
  console.log(`================================================================`);

  sendCall('StopTransaction', {
    transactionId: txId || 1,
    meterStop: Math.round(currentMeterWh),
    timestamp: new Date().toISOString(),
    reason: reason
  }).then(stopRes => {
    console.log(`📥 [CSMS StopTransaction Response]:`, stopRes);
    
    // Status back to Available
    return sendCall('StatusNotification', {
      connectorId: 1,
      errorCode: 'NoError',
      status: 'Available',
      timestamp: new Date().toISOString()
    });
  }).then(() => {
    console.log(`✅ Charger is now in STANDBY (Available) ready for next session.`);
    printInstructions();
  }).catch(err => {
    console.error(`❌ StopTransaction error:`, err.message);
  });
}

/**
 * Stream OCPP MeterValues every 1.5 seconds during active session
 */
function startTelemetry() {
  stopTelemetry();
  telemetryTimer = setInterval(() => {
    if (!isCharging) return;

    // Simulate charging progression
    soc = Math.min(100, +(soc + 0.15).toFixed(1));
    voltage = +(418.0 + (Math.random() - 0.5) * 3).toFixed(1);
    current = +(148.0 + (Math.random() - 0.5) * 4).toFixed(1);
    const powerKw = +((voltage * current) / 1000).toFixed(2);
    currentMeterWh += Math.round((powerKw * 1000) / 2400); // add consumed Wh

    const now = new Date().toISOString();

    const meterPayload = {
      connectorId: 1,
      transactionId: activeTransactionId,
      meterValue: [
        {
          timestamp: now,
          sampledValue: [
            { value: String(voltage), measurand: 'Voltage', unit: 'V' },
            { value: String(current), measurand: 'Current.Import', unit: 'A' },
            { value: String(powerKw), measurand: 'Power.Active.Import', unit: 'kW' },
            { value: String(soc), measurand: 'SoC', unit: 'Percent' },
            { value: String(currentMeterWh), measurand: 'Energy.Active.Import.Register', unit: 'Wh' },
            { value: '34.5', measurand: 'Temperature', unit: 'Celsius' }
          ]
        }
      ]
    };

    sendCall('MeterValues', meterPayload).then(() => {
      const timeStr = new Date().toLocaleTimeString();
      console.log(`[${timeStr}] ⚡ MeterValues -> ${voltage}V | ${current}A | ${powerKw} kW | SoC: ${soc}% | Delivered: ${(currentMeterWh/1000).toFixed(2)} kWh`);
    }).catch(e => {});

    // If reached 100% SoC, simulate completion
    if (soc >= 100) {
      console.log(`\n🔋 Vehicle battery reached 100% full charge! Terminating session...`);
      stopChargingSequence('EVDeparted');
    }
  }, 1500);
}

function stopTelemetry() {
  if (telemetryTimer) {
    clearInterval(telemetryTimer);
    telemetryTimer = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!isConnected) return;
    sendCall('Heartbeat', {}).catch(() => {});
  }, 30000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function printInstructions() {
  console.log('\n================================================================');
  console.log('🎮 SIMULATOR INTERACTIVE COMMANDS:');
  console.log('   Press [1] or [b] + ENTER : Simulate Physical Charger ON Button');
  console.log('   Press [0] or [s] + ENTER : Simulate Physical Charger STOP Button');
  console.log('   Press [q] + ENTER       : Quit Simulator');
  console.log('   (Or click Start / Stop in the Portal Dashboard to test Remote Control!)');
  console.log('================================================================\n');
}

// Setup terminal input
if (!isNonInteractive) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === '1' || cmd === 'b' || cmd === 'start' || cmd === 'on') {
      handlePhysicalButtonStart();
    } else if (cmd === '0' || cmd === 's' || cmd === 'stop' || cmd === 'off') {
      stopChargingSequence('Local');
    } else if (cmd === 'q' || cmd === 'quit' || cmd === 'exit') {
      console.log('Exiting simulator...');
      process.exit(0);
    } else {
      printInstructions();
    }
  });
}

// Start connection with auto-discovered charger
resolveChargerId().then((id) => {
  chargerId = id;
  wsUrl = `ws://${host}:${port}/ocpp16/${chargerId}`;

  console.log('================================================================');
  console.log('⚡ SAAPHZONE OCPP 1.6-J HARDWARE PCB & FIRMWARE SIMULATOR');
  console.log(`🔌 Target CSMS Portal: ${wsUrl}`);
  console.log(`🔋 Charge Point ID:    ${chargerId}`);
  console.log(`📡 Protocol Version:   OCPP-J 1.6`);
  console.log('================================================================');

  connect();
});
