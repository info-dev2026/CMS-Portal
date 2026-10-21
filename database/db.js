const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_DIR = __dirname;
const CHARGERS_FILE = path.join(DB_DIR, 'chargers.json');
const DATA_CHARGERS_FILE = path.join(__dirname, '..', 'data', 'chargers.json');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const TARIFFS_FILE = path.join(DB_DIR, 'tariffs.json');
const TOKENS_FILE = path.join(DB_DIR, 'tokens.json');

// Helper to generate secure PCB Hardware API Key
function generateApiKey() {
  return 'evc_live_' + crypto.randomBytes(12).toString('hex');
}

// Initial Default Seed Chargers
const SEED_CHARGERS = [
  {
    id: 'chg_bay_01',
    name: 'SAAPHZONE HyperCharge Bay 01 [800V Ultra-Fast]',
    location: 'Terminal A - Stall 01',
    apiKey: 'evc_live_9f82d1c470be31980a32e1',
    credentials: {
      username: 'bay01',
      password: 'password123'
    },
    tariff: {
      ratePerKwh: 18.50,
      currency: '₹',
      sessionFee: 50.00
    },
    stats: {
      totalSessions: 14,
      totalEnergyKwh: 345.2,
      totalRevenue: 6386.20
    },
    rfidTokens: ['RFID_SAAPH_0841', 'TOKEN_PCB_MASTER'],
    createdAt: new Date().toISOString(),
    maxVoltage: 800,
    maxCurrent: 350,
    connectorType: 'CCS2 Combo (Liquid-Cooled)',
    status: 'CHARGING',
    lastSeen: Date.now(),
    telemetry: {
      charger_voltage: 418.5,
      charger_current: 148.2,
      battery_soc: 78.0,
      battery_req_voltage: 425.0,
      battery_req_current: 160.0,
      battery_temp: 34.2,
      charger_temp: 41.5,
      status: 'CHARGING',
      charging_mode: 'SPORT PLUS // CC FAST',
      fault_code: 'NONE',
      session_energy_kwh: 45.8,
      session_duration_min: 22.4,
      power_kw: 62.0,
      target_power_kw: 68.0,
      timestamp: Date.now()
    },
    history: []
  },
  {
    id: 'chg_bay_02',
    name: 'SAAPHZONE SuperCharge Bay 02 [CCS2 350kW]',
    location: 'Terminal A - Stall 02',
    apiKey: 'evc_live_41a87b22d9904f4ec8872b',
    credentials: {
      username: 'bay02',
      password: 'password123'
    },
    tariff: {
      ratePerKwh: 16.50,
      currency: '₹',
      sessionFee: 40.00
    },
    stats: {
      totalSessions: 6,
      totalEnergyKwh: 162.4,
      totalRevenue: 2679.60
    },
    rfidTokens: ['RFID_SAAPH_0923'],
    createdAt: new Date().toISOString(),
    maxVoltage: 500,
    maxCurrent: 250,
    connectorType: 'CCS2 500V',
    status: 'ONLINE',
    lastSeen: Date.now() - 5000,
    telemetry: {
      charger_voltage: 0.0,
      charger_current: 0.0,
      battery_soc: 0.0,
      battery_req_voltage: 0.0,
      battery_req_current: 0.0,
      battery_temp: 24.0,
      charger_temp: 26.5,
      status: 'IDLE',
      charging_mode: 'STANDBY READY',
      fault_code: 'NONE',
      session_energy_kwh: 0.0,
      session_duration_min: 0.0,
      power_kw: 0.0,
      target_power_kw: 0.0,
      timestamp: Date.now()
    },
    history: []
  },
  {
    id: 'chg_bay_03',
    name: 'SAAPHZONE Prototyping Bench 03 [Hardware Lab]',
    location: 'Hardware Prototyping Lab - Desk 3',
    apiKey: 'evc_live_72c388ef01b349aa9231f8',
    credentials: {
      username: 'bay03',
      password: 'password123'
    },
    tariff: {
      ratePerKwh: 12.00,
      currency: '₹',
      sessionFee: 0.00
    },
    stats: {
      totalSessions: 2,
      totalEnergyKwh: 38.5,
      totalRevenue: 462.00
    },
    rfidTokens: ['RFID_LAB_BENCH_01'],
    createdAt: new Date().toISOString(),
    maxVoltage: 1000,
    maxCurrent: 400,
    connectorType: 'Custom CAN/Isolated Bus',
    status: 'ONLINE',
    lastSeen: Date.now() - 15000,
    telemetry: {
      charger_voltage: 0.0,
      charger_current: 0.0,
      battery_soc: 0.0,
      battery_req_voltage: 0.0,
      battery_req_current: 0.0,
      battery_temp: 23.5,
      charger_temp: 25.0,
      status: 'IDLE',
      charging_mode: 'STANDBY',
      fault_code: 'NONE',
      session_energy_kwh: 0.0,
      session_duration_min: 0.0,
      power_kw: 0.0,
      target_power_kw: 0.0,
      timestamp: Date.now()
    },
    history: []
  },
  {
    id: 'chg_bay_04',
    name: 'SAAPHZONE Fast DC Stall 04 [Terminal West]',
    location: 'Terminal West - Stall 04',
    apiKey: 'evc_live_83b511cd09fe43ba102a99',
    credentials: {
      username: 'bay04',
      password: 'password123'
    },
    tariff: {
      ratePerKwh: 17.00,
      currency: '₹',
      sessionFee: 45.00
    },
    stats: {
      totalSessions: 1,
      totalEnergyKwh: 24.0,
      totalRevenue: 453.00
    },
    rfidTokens: ['RFID_SAAPH_0771'],
    createdAt: new Date().toISOString(),
    maxVoltage: 800,
    maxCurrent: 300,
    connectorType: 'CCS2 Combo',
    status: 'OFFLINE',
    lastSeen: Date.now() - 3600000,
    telemetry: {
      charger_voltage: 0.0,
      charger_current: 0.0,
      battery_soc: 0.0,
      battery_req_voltage: 0.0,
      battery_req_current: 0.0,
      battery_temp: 22.0,
      charger_temp: 22.0,
      status: 'OFFLINE',
      charging_mode: 'DISCONNECTED',
      fault_code: 'COMM_TIMEOUT',
      session_energy_kwh: 0.0,
      session_duration_min: 0.0,
      power_kw: 0.0,
      target_power_kw: 0.0,
      timestamp: Date.now()
    },
    history: []
  }
];

class Database {
  constructor() {
    this.chargers = [];
    this.users = {
      admin: {
        username: 'admin',
        password: 'password123',
        role: 'ADMIN',
        name: 'Administrator'
      }
    };
    this.init();
  }

  init() {
    // 1. Load or seed users
    try {
      if (fs.existsSync(USERS_FILE)) {
        this.users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      } else {
        this.saveUsers();
      }
    } catch (e) {
      console.error('Error loading users DB:', e);
    }

    // 2. Load or seed chargers
    try {
      if (fs.existsSync(CHARGERS_FILE)) {
        const raw = fs.readFileSync(CHARGERS_FILE, 'utf8');
        this.chargers = JSON.parse(raw);
        // Ensure every charger has tariff and stats
        this.chargers = this.chargers.map((c, idx) => {
          if (!c.tariff) {
            c.tariff = { ratePerKwh: 18.00, currency: '₹', sessionFee: 40.00 };
          }
          if (!c.stats) {
            c.stats = { totalSessions: 5 + idx * 3, totalEnergyKwh: 120 + idx * 45, totalRevenue: 2200 + idx * 800 };
          }
          if (!c.rfidTokens) {
            c.rfidTokens = [`RFID_TAG_00${idx + 1}`];
          }
          if (!c.credentials) {
            c.credentials = { username: `bay0${idx + 1}`, password: 'password123' };
          }
          return c;
        });
        this.saveChargers();
      } else {
        this.chargers = SEED_CHARGERS;
        this.saveChargers();
      }
    } catch (e) {
      console.error('Error loading chargers DB:', e);
      this.chargers = SEED_CHARGERS;
    }
  }

  saveUsers() {
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving users DB:', e);
    }
  }

  saveChargers() {
    try {
      const jsonStr = JSON.stringify(this.chargers, null, 2);
      fs.writeFileSync(CHARGERS_FILE, jsonStr, 'utf8');
      try {
        const dataDir = path.dirname(DATA_CHARGERS_FILE);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(DATA_CHARGERS_FILE, jsonStr, 'utf8');
      } catch (err2) {
        console.error('Error syncing data/chargers.json:', err2);
      }
    } catch (e) {
      console.error('Error saving chargers DB:', e);
    }
  }

  // --- Chargers CRUD ---

  getAllChargers() {
    return this.chargers;
  }

  getChargerById(id) {
    return this.chargers.find(c => c.id === id);
  }

  getChargerByApiKey(apiKey) {
    return this.chargers.find(c => c.apiKey === apiKey);
  }

  isAcConnector(connectorType) {
    if (!connectorType) return false;
    const str = String(connectorType).toUpperCase();
    return str.includes('AC') || str.includes('TYPE 2') || str.includes('TYPE 1') || str.includes('BHARAT') || str.includes('J1772') || str.includes('MENNEKES') || str.includes('230V') || str.includes('415V');
  }

  calculatePowerKw(voltage, current, isAc, connectorType = '') {
    const v = Number(voltage) || 0;
    const a = Number(current) || 0;
    if (v <= 0 || a <= 0) return 0.0;

    const str = String(connectorType).toUpperCase();
    const is3Phase = isAc && (v >= 380 || str.includes('THREE') || str.includes('415') || str.includes('3-PHASE') || str.includes('22KW') || str.includes('11KW'));

    if (is3Phase) {
      // 3-Phase AC formula: P = (sqrt(3) * V * I) / 1000
      return +( (Math.sqrt(3) * v * a) / 1000 ).toFixed(2);
    } else {
      // Single-phase AC or DC: P = (V * I) / 1000
      return +( (v * a) / 1000 ).toFixed(2);
    }
  }

  addCharger(data) {
    const id = 'chg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const apiKey = generateApiKey();

    const connector = (data.connectorType || 'CCS2 Combo').trim();
    const isAc = this.isAcConnector(connector);

    let maxV = Number(data.maxVoltage);
    let maxA = Number(data.maxCurrent);

    if (isAc) {
      if (!maxV || maxV > 500) {
        maxV = connector.toLowerCase().includes('three') || connector.includes('415') || connector.includes('22kw') || connector.includes('11kw') ? 415 : 230;
      }
      if (!maxA || maxA > 100) {
        maxA = connector.includes('16a') || connector.includes('11kw') ? 16 : 32;
      }
    } else {
      maxV = maxV || 800;
      maxA = maxA || 350;
    }

    // Automatically generate the power in kW / kWh rate
    const calculatedPowerKw = this.calculatePowerKw(maxV, maxA, isAc, connector);

    const newCharger = {
      id: id,
      name: data.name.trim(),
      location: data.location ? data.location.trim() : 'Unassigned Bay',
      apiKey: apiKey,
      isAc: isAc,
      credentials: {
        username: data.username ? data.username.trim() : `bay0${this.chargers.length + 1}`,
        password: data.password ? data.password.trim() : 'password123'
      },
      tariff: {
        ratePerKwh: Number(data.ratePerKwh) || 18.00,
        currency: '₹',
        sessionFee: Number(data.sessionFee) || 40.00
      },
      stats: {
        totalSessions: 0,
        totalEnergyKwh: 0.0,
        totalRevenue: 0.0
      },
      completedSessions: [],
      rfidTokens: data.rfidToken ? [data.rfidToken.trim()] : [`RFID_TAG_${Math.floor(1000 + Math.random() * 9000)}`],
      createdAt: new Date().toISOString(),
      maxVoltage: maxV,
      maxCurrent: maxA,
      maxPowerKw: calculatedPowerKw,
      connectorType: connector,
      status: 'ONLINE',
      lastSeen: Date.now(),
      telemetry: {
        charger_voltage: maxV,
        charger_current: 0.0,
        battery_soc: 0.0,
        battery_req_voltage: maxV,
        battery_req_current: maxA,
        battery_temp: 25.0,
        charger_temp: 25.0,
        status: 'IDLE',
        charging_mode: isAc ? 'AC STANDARD // STANDBY' : 'STANDBY READY',
        fault_code: 'NONE',
        session_energy_kwh: 0.0,
        session_duration_min: 0.0,
        power_kw: 0.0,
        target_power_kw: calculatedPowerKw,
        timestamp: Date.now()
      },
      history: []
    };

    this.chargers.push(newCharger);
    this.saveChargers();
    return newCharger;
  }

  updateCharger(id, updates) {
    const index = this.chargers.findIndex(c => c.id === id);
    if (index === -1) return null;

    this.chargers[index] = { ...this.chargers[index], ...updates };
    this.saveChargers();
    return this.chargers[index];
  }

  deleteCharger(id) {
    const index = this.chargers.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.chargers.splice(index, 1);
    this.saveChargers();
    return true;
  }

  regenerateApiKey(id) {
    const charger = this.getChargerById(id);
    if (!charger) return null;

    const oldKey = charger.apiKey;
    const newKey = generateApiKey();
    charger.apiKey = newKey;
    this.saveChargers();
    return { oldKey, newKey, charger };
  }

  updateChargerCredentials(id, username, password) {
    const charger = this.getChargerById(id);
    if (!charger) return null;

    charger.credentials = {
      username: username.trim(),
      password: password.trim()
    };
    this.saveChargers();
    return charger;
  }

  updateChargerTariff(id, ratePerKwh, sessionFee) {
    const charger = this.getChargerById(id);
    if (!charger) return null;

    if (!charger.tariff) charger.tariff = { currency: '₹' };
    if (ratePerKwh !== undefined) charger.tariff.ratePerKwh = Number(ratePerKwh);
    if (sessionFee !== undefined) charger.tariff.sessionFee = Number(sessionFee);

    this.saveChargers();
    return charger;
  }

  addRfidTokenToCharger(id, token) {
    const charger = this.getChargerById(id);
    if (!charger) return null;

    if (!charger.rfidTokens) charger.rfidTokens = [];
    if (!charger.rfidTokens.includes(token.trim())) {
      charger.rfidTokens.push(token.trim());
      this.saveChargers();
    }
    return charger;
  }

  removeRfidTokenFromCharger(id, token) {
    const charger = this.getChargerById(id);
    if (!charger || !charger.rfidTokens) return null;

    charger.rfidTokens = charger.rfidTokens.filter(t => t !== token);
    this.saveChargers();
    return charger;
  }

  // --- Auth & Users ---

  authenticateUser(username, password) {
    const u = username.trim().toLowerCase();
    const p = password.trim();

    // Check Admin
    if (this.users.admin && this.users.admin.username.toLowerCase() === u && this.users.admin.password === p) {
      return {
        role: 'ADMIN',
        username: this.users.admin.username,
        name: this.users.admin.name || 'Administrator'
      };
    }

    // Check Chargers
    const charger = this.chargers.find(c =>
      c.credentials &&
      c.credentials.username.toLowerCase() === u &&
      c.credentials.password === p
    );

    if (charger) {
      return {
        role: 'CHARGER',
        username: charger.credentials.username,
        name: charger.name,
        chargerId: charger.id
      };
    }

    return null;
  }

  updateAdmin(username, password, name) {
    this.users.admin = {
      username: username.trim(),
      password: password.trim(),
      role: 'ADMIN',
      name: name ? name.trim() : 'Administrator'
    };
    this.saveUsers();
    return this.users.admin;
  }

  getAccountsList() {
    return [
      {
        id: 'admin',
        type: 'ADMIN',
        name: this.users.admin.name,
        username: this.users.admin.username,
        password: this.users.admin.password
      },
      ...this.chargers.map(c => ({
        id: c.id,
        type: 'CHARGER',
        name: c.name,
        chargerId: c.id,
        username: c.credentials ? c.credentials.username : `bay_${c.id}`,
        password: c.credentials ? c.credentials.password : 'password123',
        apiKey: c.apiKey
      }))
    ];
  }

  // --- Telemetry Recording ---

  recordTelemetry(apiKey, payload) {
    const charger = this.getChargerByApiKey(apiKey);
    if (!charger) return null;

    const now = Date.now();
    const prev = charger.telemetry || {};
    const isAc = charger.isAc === true || this.isAcConnector(charger.connectorType);

    const v = payload.charger_voltage !== undefined ? Number(payload.charger_voltage) : (payload.voltage !== undefined ? Number(payload.voltage) : (prev.charger_voltage || (isAc ? 230.0 : 418.5)));
    const a = payload.charger_current !== undefined ? Number(payload.charger_current) : (payload.current !== undefined ? Number(payload.current) : (prev.charger_current || (isAc ? 32.0 : 148.2)));
    const payloadSoc = payload.battery_soc !== undefined ? payload.battery_soc : payload.soc;
    const rawSoc = payloadSoc !== undefined ? payloadSoc : prev.battery_soc;
    let soc = rawSoc !== undefined ? Number(rawSoc) : 78.0;
    const reqV = payload.battery_req_voltage !== undefined ? Number(payload.battery_req_voltage) : (prev.battery_req_voltage || (isAc ? 230.0 : 425.0));
    const reqA = payload.battery_req_current !== undefined ? Number(payload.battery_req_current) : (prev.battery_req_current || (isAc ? 32.0 : 160.0));

    // Automatically calculate power in kW for AC or DC
    const pKw = payload.power_kw !== undefined ? Number(payload.power_kw) : this.calculatePowerKw(v, a, isAc, charger.connectorType);
    const targetPKw = payload.target_power_kw !== undefined ? Number(payload.target_power_kw) : this.calculatePowerKw(reqV, reqA, isAc, charger.connectorType);

    let currentEnergy = prev.session_energy_kwh || 0.0;
    let duration = prev.session_duration_min || 0.0;

    const payloadStatus = payload.status ? String(payload.status).toUpperCase() : '';
    const payloadSaysFull = payloadStatus === 'CHARGED' || payloadStatus === 'COMPLETED';

    // =========================================================================
    // AC SESSION LIFECYCLE
    //   1. ACTIVE  -> kWh accumulates from V x A x time
    //   2. HELD    -> battery full: delivered kWh is frozen (stays constant)
    //   3. NEW     -> next session starts: kWh resets to 0 and counts again
    // `sessionPendingReset` === true means the last session is complete & HELD.
    // =========================================================================
    let sessionHeld = isAc && charger.sessionPendingReset === true;

    if (sessionHeld) {
      const payloadSocBelowFull = payloadSoc === undefined || Number(payloadSoc) < 100;
      const isNewSessionStarting = v > 10 && a > 0.5 && !payloadSaysFull && payloadSocBelowFull;

      if (isNewSessionStarting) {
        // NEW session: start delivered energy & timer fresh from 0
        currentEnergy = 0.0;
        duration = 0.0;
        charger.sessionPendingReset = false;
        sessionHeld = false;
        // AC PCBs often don't report SoC; don't let the previous 100% re-trigger "full"
        if (payloadSoc === undefined && soc >= 100) soc = 0.0;
      }
    } else if (!isAc && charger.sessionPendingReset && soc < 100 && (v > 10 && a > 0.5)) {
      // Legacy DC behaviour: reset values for a fresh session
      currentEnergy = 0.0;
      duration = 0.0;
      charger.sessionPendingReset = false;
    }

    if (sessionHeld) {
      // HELD: keep the last delivered kWh & duration constant until next session
      currentEnergy = Number(prev.session_energy_kwh) || 0.0;
      duration = Number(prev.session_duration_min) || 0.0;
    } else if (payload.session_energy_kwh !== undefined) {
      currentEnergy = Number(payload.session_energy_kwh);
    } else if (charger.lastSeen && v > 10 && a > 0.5) {
      // Convert live charging voltage & current into delivered energy (kWh)
      const elapsedHours = (now - charger.lastSeen) / (1000 * 3600);
      if (elapsedHours > 0 && elapsedHours < 0.1) {
        currentEnergy = +(currentEnergy + pKw * elapsedHours).toFixed(3);
        duration = +(duration + (elapsedHours * 60)).toFixed(1);
      }
    }

    let resolvedStatus = payload.status || (v > 20 && a > 0.5 ? 'CHARGING' : 'ONLINE');

    // =========================================================================
    // AC CHARGER FULLY CHARGED AUTOMATIC LOGIC & DATABASE ACCUMULATION
    // =========================================================================
    const isFullyCharged = soc >= 100 || payloadSaysFull;

    if (isAc && sessionHeld) {
      // Session already committed - just remain in CHARGED state with held kWh
      resolvedStatus = 'CHARGED';
    } else if (isAc && isFullyCharged) {
      resolvedStatus = 'CHARGED';

      // If active session delivered energy, commit calculation to database (once)!
      if (currentEnergy > 0) {
        const completedEnergy = +currentEnergy.toFixed(3);
        const completedDuration = +duration.toFixed(1);

        const rate = charger.tariff ? (Number(charger.tariff.ratePerKwh) || 18.0) : 18.0;
        const sessionFee = charger.tariff ? (Number(charger.tariff.sessionFee) || 0.0) : 0.0;
        const sessionRevenue = +((completedEnergy * rate) + sessionFee).toFixed(2);

        // 1. Add calculation to database stats accordingly
        if (!charger.stats) charger.stats = { totalEnergyKwh: 0, totalRevenue: 0, totalSessions: 0 };
        charger.stats.totalSessions = (charger.stats.totalSessions || 0) + 1;
        charger.stats.totalEnergyKwh = +((charger.stats.totalEnergyKwh || 0) + completedEnergy).toFixed(2);
        charger.stats.totalRevenue = +((charger.stats.totalRevenue || 0) + sessionRevenue).toFixed(2);

        // 2. Add completed session log in database
        if (!charger.completedSessions) charger.completedSessions = [];
        const sessionRecord = {
          sessionId: 'sess_' + Date.now().toString(36),
          chargerId: charger.id,
          chargerName: charger.name,
          connectorType: charger.connectorType,
          energyKwh: completedEnergy,
          durationMin: completedDuration,
          revenue: sessionRevenue,
          batterySocEnd: 100,
          completedAt: new Date().toISOString()
        };
        charger.completedSessions.push(sessionRecord);
        charger.lastCompletedSession = sessionRecord;

        // 3. HOLD delivered kWh constant; it resets to 0 when the next session starts
        currentEnergy = completedEnergy;
        duration = completedDuration;
        charger.sessionPendingReset = true;
      }
    }

    charger.status = resolvedStatus;
    charger.lastSeen = now;

    charger.telemetry = {
      charger_voltage: +v.toFixed(1),
      charger_current: +a.toFixed(1),
      battery_soc: +Math.min(100, Math.max(0, soc)).toFixed(1),
      battery_req_voltage: +reqV.toFixed(1),
      battery_req_current: +reqA.toFixed(1),
      battery_temp: payload.battery_temp !== undefined ? +Number(payload.battery_temp).toFixed(1) : (prev.battery_temp || 34.2),
      charger_temp: payload.charger_temp !== undefined ? +Number(payload.charger_temp).toFixed(1) : (prev.charger_temp || 41.5),
      status: resolvedStatus,
      charging_mode: payload.charging_mode || prev.charging_mode || (isAc ? 'AC SMART // LEVEL 2' : 'SPORT PLUS // CC FAST'),
      fault_code: payload.fault_code || prev.fault_code || 'NONE',
      session_energy_kwh: currentEnergy,
      session_duration_min: duration,
      power_kw: resolvedStatus === 'CHARGED' ? 0.0 : pKw,
      target_power_kw: targetPKw,
      timestamp: now
    };

    if (!charger.history) charger.history = [];
    charger.history.push({
      timestamp: now,
      charger_voltage: charger.telemetry.charger_voltage,
      charger_current: charger.telemetry.charger_current,
      battery_soc: charger.telemetry.battery_soc,
      battery_req_voltage: charger.telemetry.battery_req_voltage,
      battery_req_current: charger.telemetry.battery_req_current,
      power_kw: charger.telemetry.power_kw
    });
    if (charger.history.length > 50) charger.history.shift();

    this.saveChargers();

    return charger;
  }
}

module.exports = new Database();
