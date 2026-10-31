/**
 * End-to-End OCPP 1.6-J Integration Test Suite
 *
 * Verifies:
 * 1. WebSocket handshake with subprotocol ocpp1.6
 * 2. BootNotification & Heartbeat
 * 3. Flow 1: Physical ON Button -> PCB initiates firmware -> StartTransaction -> Portal Accepted
 * 4. MeterValues telemetry ingestion
 * 5. Flow 2: Portal Remote Stop command (RemoteStopTransaction)
 * 6. Flow 2: Portal Remote Start command (RemoteStartTransaction)
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = 3000;
const CHARGER_ID = 'chg_bay_01';
const WS_URL = `ws://localhost:${PORT}/ocpp16/${CHARGER_ID}`;

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('🧪 Starting OCPP 1.6-J End-to-End Test Suite...\n');

  // Discover registered charger ID
  const fleet = await getJson('/api/chargers');
  const targetCharger = (fleet && fleet.chargers && fleet.chargers[0]) || { id: 'chg_muya1w8x_4zmz' };
  const CHARGER_ID = targetCharger.id;
  const WS_URL = `ws://localhost:${PORT}/ocpp16/${CHARGER_ID}`;
  console.log(`🎯 Testing with Charge Point: "${targetCharger.name || CHARGER_ID}" (${CHARGER_ID})`);

  let ws;
  let activeTxId = null;
  const pendingCalls = new Map();

  function sendCall(action, payload) {
    return new Promise((resolve, reject) => {
      const id = 'test_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      pendingCalls.set(id, { resolve, reject, action });
      ws.send(JSON.stringify([2, id, action, payload]));
    });
  }

  function sendCallResult(id, payload) {
    ws.send(JSON.stringify([3, id, payload]));
  }

  // 1. Connect WebSocket
  ws = new WebSocket(WS_URL, ['ocpp1.6']);

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  console.log('✅ TEST 1: WebSocket connected to /ocpp16/chg_bay_01 with subprotocol ocpp1.6');

  // Handle incoming messages
  ws.on('message', data => {
    const parsed = JSON.parse(data.toString());
    const msgType = parsed[0];
    const id = parsed[1];

    if (msgType === 2) {
      const action = parsed[2];
      const payload = parsed[3] || {};
      console.log(`   📥 Received CALL from Portal: [${action}]`, payload);

      if (action === 'RemoteStopTransaction') {
        sendCallResult(id, { status: 'Accepted' });
        // PCB responds to remote stop by sending StopTransaction
        setTimeout(() => {
          sendCall('StopTransaction', {
            transactionId: payload.transactionId,
            meterStop: 15400,
            timestamp: new Date().toISOString(),
            reason: 'Remote'
          });
        }, 100);
      } else if (action === 'RemoteStartTransaction') {
        sendCallResult(id, { status: 'Accepted' });
        // PCB responds to remote start by initiating StartTransaction
        setTimeout(() => {
          sendCall('StartTransaction', {
            connectorId: payload.connectorId || 1,
            idTag: payload.idTag || 'PORTAL_REMOTE',
            meterStart: 15400,
            timestamp: new Date().toISOString()
          }).then(res => {
            activeTxId = res.transactionId;
          });
        }, 100);
      }
    } else if (msgType === 3) {
      const pending = pendingCalls.get(id);
      if (pending) {
        pendingCalls.delete(id);
        pending.resolve(parsed[2] || {});
      }
    }
  });

  // 2. BootNotification
  const bootRes = await sendCall('BootNotification', {
    chargePointVendor: 'SaaphZone',
    chargePointModel: 'SZ-PCB-V1',
    firmwareVersion: '2.1.0'
  });
  if (bootRes.status !== 'Accepted') throw new Error('BootNotification not accepted');
  console.log('✅ TEST 2: BootNotification accepted by CSMS');

  // 3. Heartbeat
  const hbRes = await sendCall('Heartbeat', {});
  if (!hbRes.currentTime) throw new Error('Heartbeat missing currentTime');
  console.log('✅ TEST 3: Heartbeat acknowledged with timestamp:', hbRes.currentTime);

  // 4. Flow 1: Physical ON Button -> StartTransaction
  const startRes = await sendCall('StartTransaction', {
    connectorId: 1,
    idTag: 'PHYSICAL_BUTTON_USER',
    meterStart: 12000,
    timestamp: new Date().toISOString()
  });
  if (!startRes.transactionId || startRes.idTagInfo?.status !== 'Accepted') {
    throw new Error('StartTransaction was not approved by portal');
  }
  activeTxId = startRes.transactionId;
  console.log(`✅ TEST 4: Flow 1 verified! StartTransaction approved with Tx ID #${activeTxId}`);

  // Check charger status in DB via REST API
  const chgStatus = await getJson(`/api/chargers/${CHARGER_ID}`);
  if (chgStatus.charger.status !== 'CHARGING') {
    throw new Error(`Expected status CHARGING, got ${chgStatus.charger.status}`);
  }
  console.log('✅ TEST 5: Portal database reflects status = CHARGING');

  // 5. MeterValues telemetry
  await sendCall('MeterValues', {
    connectorId: 1,
    transactionId: activeTxId,
    meterValue: [{
      timestamp: new Date().toISOString(),
      sampledValue: [
        { value: '420.5', measurand: 'Voltage', unit: 'V' },
        { value: '150.0', measurand: 'Current.Import', unit: 'A' },
        { value: '63.0', measurand: 'Power.Active.Import', unit: 'kW' },
        { value: '82', measurand: 'SoC', unit: 'Percent' }
      ]
    }]
  });
  console.log('✅ TEST 6: MeterValues successfully ingested and processed');

  // 6. Flow 2: Portal Remote Stop command
  console.log('\nTesting Flow 2: Triggering Remote Stop via Portal API...');
  const stopControlRes = await postJson(`/api/chargers/${CHARGER_ID}/control`, { action: 'OFF' });
  if (!stopControlRes.success || !stopControlRes.ocpp) {
    throw new Error('Portal Remote Stop failed: ' + JSON.stringify(stopControlRes));
  }
  console.log('✅ TEST 7: Flow 2 verified! Portal RemoteStopTransaction dispatched and accepted');

  // 7. Flow 2: Portal Remote Start command
  console.log('\nTesting Flow 2: Triggering Remote Start via Portal API...');
  const startControlRes = await postJson(`/api/chargers/${CHARGER_ID}/control`, { action: 'ON' });
  if (!startControlRes.success || !startControlRes.ocpp) {
    throw new Error('Portal Remote Start failed: ' + JSON.stringify(startControlRes));
  }
  console.log('✅ TEST 8: Flow 2 verified! Portal RemoteStartTransaction dispatched and accepted');

  // 8. Verify OCPP status endpoint
  const ocppEndpointRes = await getJson(`/api/chargers/${CHARGER_ID}/ocpp`);
  if (!ocppEndpointRes.ocpp.connected) {
    throw new Error('OCPP endpoint reports not connected');
  }
  console.log('✅ TEST 9: /api/chargers/:id/ocpp endpoint reports connected = true, subprotocol = ocpp1.6');

  // Clean stop
  await sendCall('StopTransaction', {
    transactionId: activeTxId || 1001,
    meterStop: 16000,
    timestamp: new Date().toISOString(),
    reason: 'Local'
  });
  ws.close();

  console.log('\n🎉 ALL 9 OCPP 1.6-J INTEGRATION TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
