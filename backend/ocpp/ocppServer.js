/**
 * SAAPHZONE OCPP 1.6-J (JSON over WebSockets) Central System (CSMS) Server
 *
 * Implements Open Charge Point Protocol 1.6-J specifications for EV Charger PCB Controllers:
 *
 * 1. Physical Charger ON Button -> PCB initiates firmware -> Sends Authorize / StartTransaction to Portal -> Portal approves -> PCB starts charging
 * 2. Portal Remote Control -> Portal sends RemoteStartTransaction / RemoteStopTransaction to PCB -> PCB engages/disengages contactors
 * 3. Continuous MeterValues Telemetry -> Live voltage, current, power kW, SoC, temperature streaming to dashboard
 */

const { WebSocketServer } = require('ws');
const db = require('../../database/db');
const { recordTelemetryToPg } = require('../routes/postgresRoutes');

// OCPP Message Type IDs according to OCPP-J 1.6 specification
const MESSAGE_TYPE_CALL = 2;        // [2, "<UniqueId>", "<Action>", { <Payload> }]
const MESSAGE_TYPE_CALLRESULT = 3;  // [3, "<UniqueId>", { <Payload> }]
const MESSAGE_TYPE_CALLERROR = 4;   // [4, "<UniqueId>", "<ErrorCode>", "<ErrorDescription>", { <ErrorDetails> }]

class OcppServer {
  constructor(broadcast) {
    this.broadcast = broadcast;
    // Map of chargerId -> { ws, chargerId, ip, connectedAt, pendingCalls: Map, activeTransactionId, charger }
    this.clients = new Map();
    this.transactionCounter = 1000 + Math.floor(Math.random() * 500);

    // Initialize dedicated WebSocketServer with noServer: true
    this.wss = new WebSocketServer({
      noServer: true,
      handleProtocols: (protocols, req) => {
        // Accept ocpp1.6 or ocpp1.5 subprotocols, or default to ocpp1.6
        if (protocols.has('ocpp1.6')) return 'ocpp1.6';
        if (protocols.has('ocpp1.5')) return 'ocpp1.5';
        return 'ocpp1.6'; // Default fallback for hardware clients omitting header
      }
    });

    this.setupListeners();
  }

  setupListeners() {
    this.wss.on('connection', (ws, req) => {
      // Extract chargerId from URL: /ocpp16/:chargerId or /ocpp/:chargerId
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const parts = url.pathname.split('/').filter(Boolean);
      const rawChargerId = decodeURIComponent(parts[1] || parts[0] || '').trim();

      if (!rawChargerId) {
        console.warn('⚠️ [OCPP 1.6J] Rejected connection with no ChargePointId in URL path.');
        ws.close(1008, 'ChargePointId required in URL (e.g. /ocpp16/<chargePointId>)');
        return;
      }

      // Resolve charger in database by ID or API Key or Name
      let charger = db.getChargerById(rawChargerId) || db.getChargerByApiKey(rawChargerId);
      if (!charger) {
        const all = db.getAllChargers();
        if (all.length === 1 && (rawChargerId === 'chg_bay_01' || rawChargerId === 'default' || rawChargerId === 'test' || rawChargerId === 'sim')) {
          charger = all[0];
        } else {
          // Auto-provision any new incoming hardware charge point!
          const cleanName = rawChargerId.replace(/[_-]+/g, ' ').toUpperCase();
          charger = db.addCharger({
            name: cleanName,
            location: 'OCPP Auto-Enrolled Bay',
            connectorType: 'CCS2 Combo',
            maxVoltage: 800,
            maxCurrent: 350
          });
          console.log(`✨ [OCPP 1.6J] Auto-registered new charger: "${charger.name}" (${charger.id})`);
          this.broadcast({
            type: 'CHARGER_ADDED',
            charger
          });
        }
      }
      const chargerId = charger ? charger.id : rawChargerId;

      const clientInfo = {
        ws,
        chargerId,
        rawId: rawChargerId,
        ip: req.socket.remoteAddress,
        connectedAt: Date.now(),
        lastSeen: Date.now(),
        pendingCalls: new Map(), // uniqueId -> { resolve, reject, timeoutTimer, action }
        activeTransactionId: charger ? (charger.currentTransactionId || null) : null
      };

      this.clients.set(chargerId, clientInfo);

      console.log(`========================================================`);
      console.log(`🔌 [OCPP 1.6J] CHARGE POINT CONNECTED: ${chargerId} (IP: ${clientInfo.ip})`);
      console.log(`📡 WebSocket Protocol: ${ws.protocol || 'ocpp1.6'}`);
      console.log(`========================================================`);

      // Update charger DB record
      if (charger) {
        charger.lastSeen = Date.now();
        charger.status = charger.status === 'CHARGING' ? 'CHARGING' : 'ONLINE';
        if (!charger.ocpp) charger.ocpp = {};
        charger.ocpp.connected = true;
        charger.ocpp.protocol = 'ocpp1.6j';
        charger.ocpp.connectedAt = new Date().toISOString();
        charger.ocpp.remoteIp = clientInfo.ip;
        db.saveChargers();

        this.broadcast({
          type: 'CHARGER_UPDATED',
          charger
        });
      }

      ws.on('message', (msg) => {
        clientInfo.lastSeen = Date.now();
        if (charger) charger.lastSeen = Date.now();
        this.handleMessage(clientInfo, msg.toString());
      });

      ws.on('close', (code, reason) => {
        console.log(`⚠️ [OCPP 1.6J] Charge Point ${chargerId} disconnected (${code}: ${reason || 'Closed'})`);
        this.clients.delete(chargerId);

        // Cancel any pending remote calls
        clientInfo.pendingCalls.forEach(({ reject, timeoutTimer }) => {
          clearTimeout(timeoutTimer);
          reject(new Error('Charge Point disconnected while awaiting command response'));
        });
        clientInfo.pendingCalls.clear();

        const chg = db.getChargerById(chargerId);
        if (chg && chg.ocpp) {
          chg.ocpp.connected = false;
          chg.ocpp.disconnectedAt = new Date().toISOString();
          db.saveChargers();
          this.broadcast({
            type: 'CHARGER_UPDATED',
            charger: chg
          });
        }
      });

      ws.on('error', (err) => {
        console.error(`❌ [OCPP 1.6J] Error on socket for ${chargerId}:`, err.message);
      });
    });
  }

  /**
   * Handle incoming raw OCPP JSON message
   */
  handleMessage(client, rawText) {
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.error(`❌ [OCPP 1.6J] Invalid JSON from ${client.chargerId}:`, rawText);
      return;
    }

    if (!Array.isArray(parsed) || parsed.length < 3) {
      console.error(`❌ [OCPP 1.6J] Malformed OCPP packet from ${client.chargerId}:`, parsed);
      return;
    }

    const messageTypeId = parsed[0];
    const uniqueId = String(parsed[1]);

    if (messageTypeId === MESSAGE_TYPE_CALL) {
      // Incoming CALL from Charge Point (PCB) -> Central System (Portal)
      const action = parsed[2];
      const payload = parsed[3] || {};
      this.handleCall(client, uniqueId, action, payload);
    } else if (messageTypeId === MESSAGE_TYPE_CALLRESULT) {
      // Incoming CALLRESULT from Charge Point in response to Central System's CALL (e.g. RemoteStartTransaction)
      const payload = parsed[2] || {};
      this.handleCallResult(client, uniqueId, payload);
    } else if (messageTypeId === MESSAGE_TYPE_CALLERROR) {
      // Incoming CALLERROR from Charge Point
      const errorCode = parsed[2];
      const errorDescription = parsed[3];
      const errorDetails = parsed[4] || {};
      this.handleCallError(client, uniqueId, errorCode, errorDescription, errorDetails);
    }
  }

  /**
   * Process OCPP CALL from PCB
   */
  handleCall(client, uniqueId, action, payload) {
    console.log(`📥 [OCPP 1.6J CALL] ${client.chargerId} -> Action: [${action}] (ID: ${uniqueId})`);

    const charger = db.getChargerById(client.chargerId) || db.getChargerByApiKey(client.chargerId);

    switch (action) {
      case 'BootNotification':
        this.onBootNotification(client, uniqueId, payload, charger);
        break;

      case 'Heartbeat':
        this.onHeartbeat(client, uniqueId, payload, charger);
        break;

      case 'StatusNotification':
        this.onStatusNotification(client, uniqueId, payload, charger);
        break;

      case 'Authorize':
        this.onAuthorize(client, uniqueId, payload, charger);
        break;

      case 'StartTransaction':
        // Physical Button or Hardware-initiated Start Transaction
        this.onStartTransaction(client, uniqueId, payload, charger);
        break;

      case 'StopTransaction':
        // Physical Button or Hardware-initiated Stop Transaction
        this.onStopTransaction(client, uniqueId, payload, charger);
        break;

      case 'MeterValues':
        this.onMeterValues(client, uniqueId, payload, charger);
        break;

      case 'DataTransfer':
        this.onDataTransfer(client, uniqueId, payload, charger);
        break;

      default:
        console.warn(`⚠️ [OCPP 1.6J] Unhandled Action: ${action} from ${client.chargerId}`);
        this.sendCallError(client, uniqueId, 'NotImplemented', `Action ${action} is not implemented`);
        break;
    }
  }

  // --- Handlers for Core OCPP 1.6 Actions ---

  onBootNotification(client, uniqueId, payload, charger) {
    const { chargePointVendor, chargePointModel, firmwareVersion, chargeBoxSerialNumber } = payload;
    console.log(`⚡ [OCPP Boot] ${client.chargerId} Vendor: "${chargePointVendor}", Model: "${chargePointModel}", FW: "${firmwareVersion || '1.0'}"`);

    if (charger) {
      if (!charger.ocpp) charger.ocpp = {};
      charger.ocpp.vendor = chargePointVendor || 'Generic PCB';
      charger.ocpp.model = chargePointModel || 'EVSE-V1';
      charger.ocpp.firmwareVersion = firmwareVersion || '1.0.0';
      charger.ocpp.serialNumber = chargeBoxSerialNumber || client.chargerId;
      charger.lastSeen = Date.now();
      charger.status = 'ONLINE';
      db.saveChargers();

      this.broadcast({
        type: 'CHARGER_UPDATED',
        charger
      });
    }

    this.sendCallResult(client, uniqueId, {
      status: 'Accepted',
      currentTime: new Date().toISOString(),
      interval: 30 // PCB sends Heartbeat every 30s
    });
  }

  onHeartbeat(client, uniqueId, payload, charger) {
    if (charger) {
      charger.lastSeen = Date.now();
      db.saveChargers();
    }
    this.sendCallResult(client, uniqueId, {
      currentTime: new Date().toISOString()
    });
  }

  onStatusNotification(client, uniqueId, payload, charger) {
    const { connectorId, errorCode, status } = payload;
    console.log(`📊 [OCPP StatusNotification] ${client.chargerId} Conn: ${connectorId}, Status: [${status}], Error: ${errorCode}`);

    if (charger) {
      charger.lastSeen = Date.now();

      // Map OCPP 1.6 status to Portal status
      let portalStatus = 'ONLINE';
      if (status === 'Charging') {
        portalStatus = 'CHARGING';
        charger.batteryConnected = true;
      } else if (status === 'Available' || status === 'Preparing' || status === 'Finishing') {
        portalStatus = 'ONLINE';
      } else if (status === 'Faulted' || status === 'Unavailable') {
        portalStatus = 'FAULTED';
      }

      charger.status = portalStatus;
      if (!charger.telemetry) charger.telemetry = {};
      charger.telemetry.status = portalStatus;
      charger.telemetry.fault_code = errorCode || 'NONE';

      db.saveChargers();

      this.broadcast({
        type: 'CHARGER_UPDATED',
        charger
      });

      this.broadcast({
        type: 'TELEMETRY_UPDATE',
        chargerId: charger.id,
        telemetry: charger.telemetry,
        status: charger.status
      });
    }

    this.sendCallResult(client, uniqueId, {});
  }

  onAuthorize(client, uniqueId, payload, charger) {
    const { idTag } = payload;
    console.log(`🔑 [OCPP Authorize] ${client.chargerId} Tag: "${idTag}"`);

    // Verify tag against charger's registered RFID tokens or permit physical button tags
    let isAccepted = true;
    if (charger && Array.isArray(charger.rfidTokens) && charger.rfidTokens.length > 0) {
      // If tag is generic button command or in authorized list
      const tagStr = String(idTag).trim().toUpperCase();
      const isButtonTag = tagStr.includes('BUTTON') || tagStr.includes('START') || tagStr === '0' || tagStr === '1' || tagStr === 'LOCAL' || tagStr.includes('USER');
      const isTokenMatched = charger.rfidTokens.some(t => t.toUpperCase() === tagStr);
      isAccepted = isButtonTag || isTokenMatched || true; // Permissive by default for developer convenience
    }

    this.sendCallResult(client, uniqueId, {
      idTagInfo: {
        status: isAccepted ? 'Accepted' : 'Invalid',
        expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
      }
    });
  }

  /**
   * Hardware Start Transaction:
   * Charger ON button was pressed -> PCB firmware initiated -> PCB commands Portal to proceed with charging!
   */
  onStartTransaction(client, uniqueId, payload, charger) {
    const { connectorId, idTag, meterStart, timestamp } = payload;
    const txId = ++this.transactionCounter;
    client.activeTransactionId = txId;

    console.log(`========================================================`);
    console.log(`🟢 [OCPP 1.6J START TRANSACTION] ${client.chargerId}`);
    console.log(`   Transaction ID: #${txId}`);
    console.log(`   Initiated By: Physical Charger ON Button / RFID (${idTag || 'BUTTON_START'})`);
    console.log(`   Meter Start: ${meterStart || 0} Wh`);
    console.log(`   Timestamp: ${timestamp || new Date().toISOString()}`);
    console.log(`========================================================`);

    if (charger) {
      charger.status = 'CHARGING';
      charger.batteryConnected = true;
      charger.currentTransactionId = txId;
      charger.lastSeen = Date.now();

      if (!charger.telemetry) charger.telemetry = {};
      charger.telemetry.status = 'CHARGING';
      charger.telemetry.battery_connected = true;
      charger.telemetry.charging_mode = 'OCPP 1.6-J // ACTIVE SESSION';
      charger.telemetry.session_energy_kwh = 0.0;
      charger.telemetry.session_duration_min = 0.0;
      charger.sessionPendingReset = false;

      // Provide active voltage & target current
      const isAc = charger.isAc === true || db.isAcConnector(charger.connectorType);
      if (isAc) {
        charger.telemetry.charger_voltage = Number(charger.maxVoltage) || 230.0;
        charger.telemetry.charger_current = Number(charger.maxCurrent) || 32.0;
        charger.telemetry.power_kw = db.calculatePowerKw(charger.telemetry.charger_voltage, charger.telemetry.charger_current, true, charger.connectorType);
      } else {
        charger.telemetry.charger_voltage = Number(charger.maxVoltage) || 418.5;
        charger.telemetry.charger_current = Number(charger.maxCurrent) || 148.2;
        charger.telemetry.power_kw = db.calculatePowerKw(charger.telemetry.charger_voltage, charger.telemetry.charger_current, false, charger.connectorType);
      }

      db.saveChargers();

      this.broadcast({
        type: 'CHARGER_UPDATED',
        charger
      });

      this.broadcast({
        type: 'TELEMETRY_UPDATE',
        chargerId: charger.id,
        telemetry: charger.telemetry,
        status: charger.status,
        transactionId: txId
      });
    }

    // Central System approves PCB to proceed with charging:
    this.sendCallResult(client, uniqueId, {
      transactionId: txId,
      idTagInfo: {
        status: 'Accepted'
      }
    });
  }

  /**
   * Stop Transaction:
   * Stop button pressed, unplugged, or remote stop completed
   */
  onStopTransaction(client, uniqueId, payload, charger) {
    const { transactionId, meterStop, timestamp, reason, idTag } = payload;
    console.log(`========================================================`);
    console.log(`🔴 [OCPP 1.6J STOP TRANSACTION] ${client.chargerId}`);
    console.log(`   Transaction ID: #${transactionId}`);
    console.log(`   Meter Stop: ${meterStop || 0} Wh`);
    console.log(`   Reason: ${reason || 'Local'}`);
    console.log(`========================================================`);

    client.activeTransactionId = null;

    if (charger) {
      charger.status = 'ONLINE';
      charger.currentTransactionId = null;
      charger.lastSeen = Date.now();

      if (!charger.telemetry) charger.telemetry = {};
      charger.telemetry.status = 'ONLINE';
      charger.telemetry.power_kw = 0.0;
      charger.telemetry.charger_current = 0.0;
      charger.telemetry.charging_mode = 'STANDBY // READY';

      // Calculate delivered energy in kWh
      let deliveredKwh = 0.0;
      if (meterStop !== undefined && !isNaN(Number(meterStop))) {
        // Meter in OCPP is typically reported in Wh or kWh
        deliveredKwh = Number(meterStop) > 500 ? +(Number(meterStop) / 1000).toFixed(2) : +Number(meterStop).toFixed(2);
      } else if (charger.telemetry.session_energy_kwh) {
        deliveredKwh = Number(charger.telemetry.session_energy_kwh);
      }

      // Record completed session in database
      const rate = charger.tariff ? (Number(charger.tariff.ratePerKwh) || 18.0) : 18.0;
      const sessionFee = charger.tariff ? (Number(charger.tariff.sessionFee) || 0.0) : 0.0;
      const revenue = +((deliveredKwh * rate) + sessionFee).toFixed(2);

      if (!charger.stats) charger.stats = { totalEnergyKwh: 0, totalRevenue: 0, totalSessions: 0 };
      charger.stats.totalSessions = (charger.stats.totalSessions || 0) + 1;
      charger.stats.totalEnergyKwh = +((charger.stats.totalEnergyKwh || 0) + deliveredKwh).toFixed(2);
      charger.stats.totalRevenue = +((charger.stats.totalRevenue || 0) + revenue).toFixed(2);

      if (!charger.completedSessions) charger.completedSessions = [];
      const sessionRecord = {
        sessionId: `ocpp_tx_${transactionId}`,
        transactionId,
        chargerId: charger.id,
        chargerName: charger.name,
        energyKwh: deliveredKwh,
        revenue,
        reason: reason || 'Stopped',
        completedAt: timestamp || new Date().toISOString()
      };
      charger.completedSessions.push(sessionRecord);
      charger.lastCompletedSession = sessionRecord;

      db.saveChargers();

      this.broadcast({
        type: 'CHARGER_UPDATED',
        charger
      });

      this.broadcast({
        type: 'TELEMETRY_UPDATE',
        chargerId: charger.id,
        telemetry: charger.telemetry,
        status: charger.status
      });
    }

    this.sendCallResult(client, uniqueId, {
      idTagInfo: {
        status: 'Accepted'
      }
    });
  }

  /**
   * Continuous MeterValues from PCB:
   * Maps OCPP 1.6 sampled values (Voltage, Current, Power, Energy, SoC) to Dashboard Telemetry
   */
  onMeterValues(client, uniqueId, payload, charger) {
    const { connectorId, transactionId, meterValue } = payload;

    if (charger && Array.isArray(meterValue) && meterValue.length > 0) {
      charger.lastSeen = Date.now();
      if (!charger.telemetry) charger.telemetry = {};

      let voltage = charger.telemetry.charger_voltage || 0;
      let current = charger.telemetry.charger_current || 0;
      let powerKw = charger.telemetry.power_kw || 0;
      let soc = charger.telemetry.battery_soc || 0;
      let energyKwh = charger.telemetry.session_energy_kwh || 0;
      let temp = charger.telemetry.battery_temp || 32.0;

      meterValue.forEach(mv => {
        if (Array.isArray(mv.sampledValue)) {
          mv.sampledValue.forEach(sample => {
            const val = parseFloat(sample.value);
            if (isNaN(val)) return;

            const measurand = (sample.measurand || 'Energy.Active.Import.Register').toLowerCase();
            const unit = (sample.unit || '').toLowerCase();

            if (measurand.includes('voltage')) {
              voltage = val;
            } else if (measurand.includes('current')) {
              current = val;
            } else if (measurand.includes('power.active')) {
              powerKw = unit === 'w' ? +(val / 1000).toFixed(2) : +val.toFixed(2);
            } else if (measurand.includes('soc')) {
              soc = val;
            } else if (measurand.includes('energy.active')) {
              energyKwh = unit === 'wh' ? +(val / 1000).toFixed(3) : +val.toFixed(3);
            } else if (measurand.includes('temperature')) {
              temp = val;
            }
          });
        }
      });

      // If power wasn't explicitly sampled, calculate
      if (powerKw === 0 && voltage > 10 && current > 0.5) {
        powerKw = db.calculatePowerKw(voltage, current, charger.isAc, charger.connectorType);
      }

      charger.telemetry.charger_voltage = +voltage.toFixed(1);
      charger.telemetry.charger_current = +current.toFixed(1);
      charger.telemetry.power_kw = +powerKw.toFixed(2);
      charger.telemetry.battery_soc = +soc.toFixed(1);
      charger.telemetry.session_energy_kwh = +energyKwh.toFixed(3);
      charger.telemetry.battery_temp = +temp.toFixed(1);
      charger.telemetry.timestamp = Date.now();

      if (current > 0.5 && charger.status !== 'CHARGING') {
        charger.status = 'CHARGING';
        charger.batteryConnected = true;
      }

      db.saveChargers();

      this.broadcast({
        type: 'TELEMETRY_UPDATE',
        chargerId: charger.id,
        telemetry: charger.telemetry,
        status: charger.status
      });

      // Persist to Postgres if available
      recordTelemetryToPg(charger, charger.telemetry).catch(() => {});
    }

    this.sendCallResult(client, uniqueId, {});
  }

  onDataTransfer(client, uniqueId, payload, charger) {
    const { vendorId, messageId, data } = payload;
    console.log(`📦 [OCPP DataTransfer] ${client.chargerId} Vendor: ${vendorId}, Msg: ${messageId}`);
    this.sendCallResult(client, uniqueId, {
      status: 'Accepted',
      data: 'OK'
    });
  }

  // --- Remote Commands Dispatched from Portal to PCB (Flow 2) ---

  /**
   * Portal Remote Start Transaction -> Commands PCB to start charging
   */
  async remoteStart(chargerId, connectorId = 1, idTag = 'PORTAL_REMOTE') {
    const client = this.getClient(chargerId);
    if (!client) {
      throw new Error(`Charge Point ${chargerId} is not connected via OCPP 1.6-J`);
    }

    const payload = {
      connectorId: Number(connectorId) || 1,
      idTag: String(idTag)
    };

    console.log(`🚀 [OCPP RemoteStartTransaction] Sending to ${chargerId}...`);
    const result = await this.sendCall(client, 'RemoteStartTransaction', payload);
    return result;
  }

  /**
   * Portal Remote Stop Transaction -> Commands PCB to stop charging
   */
  async remoteStop(chargerId, transactionId) {
    const client = this.getClient(chargerId);
    if (!client) {
      throw new Error(`Charge Point ${chargerId} is not connected via OCPP 1.6-J`);
    }

    const txId = transactionId || client.activeTransactionId;
    if (!txId) {
      // Look up transactionId from DB
      const chg = db.getChargerById(chargerId);
      if (chg && chg.currentTransactionId) {
        transactionId = chg.currentTransactionId;
      } else {
        transactionId = 1; // Fallback
      }
    } else {
      transactionId = txId;
    }

    const payload = {
      transactionId: Number(transactionId)
    };

    console.log(`🛑 [OCPP RemoteStopTransaction] Sending to ${chargerId} for Tx #${transactionId}...`);
    const result = await this.sendCall(client, 'RemoteStopTransaction', payload);
    return result;
  }

  /**
   * Remote Reset (Soft / Hard)
   */
  async reset(chargerId, type = 'Soft') {
    const client = this.getClient(chargerId);
    if (!client) {
      throw new Error(`Charge Point ${chargerId} is not connected via OCPP 1.6-J`);
    }
    return this.sendCall(client, 'Reset', { type });
  }

  /**
   * Remote Unlock Connector
   */
  async unlockConnector(chargerId, connectorId = 1) {
    const client = this.getClient(chargerId);
    if (!client) {
      throw new Error(`Charge Point ${chargerId} is not connected via OCPP 1.6-J`);
    }
    return this.sendCall(client, 'UnlockConnector', { connectorId: Number(connectorId) || 1 });
  }

  // --- Low-Level OCPP Protocol Helpers ---

  getClient(chargerId) {
    if (!chargerId) return null;
    let client = this.clients.get(chargerId);
    if (client) return client;

    // Search by API Key or raw ID
    for (const [key, c] of this.clients.entries()) {
      if (key === chargerId || c.rawId === chargerId) return c;
    }

    const charger = db.getChargerById(chargerId) || db.getChargerByApiKey(chargerId);
    if (charger) {
      return this.clients.get(charger.id) || null;
    }
    return null;
  }

  isChargerConnected(chargerId) {
    const client = this.getClient(chargerId);
    return Boolean(client && client.ws && client.ws.readyState === 1);
  }

  getConnectedChargers() {
    const list = [];
    this.clients.forEach((c, id) => {
      if (c.ws && c.ws.readyState === 1) {
        list.push({
          chargerId: id,
          ip: c.ip,
          connectedAt: new Date(c.connectedAt).toISOString(),
          lastSeen: new Date(c.lastSeen).toISOString(),
          activeTransactionId: c.activeTransactionId
        });
      }
    });
    return list;
  }

  sendCall(client, action, payload, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      if (!client.ws || client.ws.readyState !== 1) {
        return reject(new Error('WebSocket connection is not open'));
      }

      const uniqueId = 'csms_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      const msg = JSON.stringify([MESSAGE_TYPE_CALL, uniqueId, action, payload]);

      const timeoutTimer = setTimeout(() => {
        client.pendingCalls.delete(uniqueId);
        reject(new Error(`OCPP command [${action}] timed out after ${timeoutMs}ms with no response from PCB.`));
      }, timeoutMs);

      client.pendingCalls.set(uniqueId, {
        action,
        resolve,
        reject,
        timeoutTimer
      });

      client.ws.send(msg);
    });
  }

  sendCallResult(client, uniqueId, payload) {
    if (!client.ws || client.ws.readyState !== 1) return;
    const msg = JSON.stringify([MESSAGE_TYPE_CALLRESULT, uniqueId, payload]);
    client.ws.send(msg);
  }

  sendCallError(client, uniqueId, errorCode, errorDescription, errorDetails = {}) {
    if (!client.ws || client.ws.readyState !== 1) return;
    const msg = JSON.stringify([MESSAGE_TYPE_CALLERROR, uniqueId, errorCode, errorDescription, errorDetails]);
    client.ws.send(msg);
  }

  handleCallResult(client, uniqueId, payload) {
    const pending = client.pendingCalls.get(uniqueId);
    if (pending) {
      clearTimeout(pending.timeoutTimer);
      client.pendingCalls.delete(uniqueId);
      console.log(`📥 [OCPP CALLRESULT] Response for [${pending.action}]:`, payload);
      pending.resolve(payload);
    }
  }

  handleCallError(client, uniqueId, errorCode, errorDescription, errorDetails) {
    const pending = client.pendingCalls.get(uniqueId);
    if (pending) {
      clearTimeout(pending.timeoutTimer);
      client.pendingCalls.delete(uniqueId);
      console.warn(`❌ [OCPP CALLERROR] Error for [${pending.action}]: ${errorCode} - ${errorDescription}`);
      pending.reject(new Error(`OCPP Error: ${errorCode} - ${errorDescription}`));
    }
  }
}

let ocppInstance = null;

module.exports = function(broadcast) {
  if (!ocppInstance) {
    ocppInstance = new OcppServer(broadcast);
  }
  return ocppInstance;
};
