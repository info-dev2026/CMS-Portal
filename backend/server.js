const express = require('express');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const cors = require('cors');

const db = require('../database/db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wss.on('error', (err) => {
  // Prevent unhandled error event crash during port re-binding
});

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['text/*', 'application/javascript'], limit: '10mb' }));

// Global JSON error handler (returns pure JSON instead of HTML on body-parser syntax errors)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload received.',
      message: err.message,
      hint: 'Ensure your JSON body is valid RFC 8259 JSON (double-quoted keys and string values, no trailing commas).'
    });
  }
  next(err);
});

app.use((req, res, next) => {
  if (req.url) {
    req.url = req.url.replace(/[\r\n]+/g, '').trim();
  }
  next();
});

app.use(express.static(FRONTEND_DIR));

function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

// Hardware PCB Heartbeat Watchdog:
// Verifies whether a PCB authorizing the charger's auth key is actively streaming.
// 90-second timeout window accommodates standard IoT/microcontroller intervals (30s, 60s) and network latency.
setInterval(() => {
  try {
    const now = Date.now();
    const pcbHeartbeatTimeout = 90000;
    let hasChanges = false;
    db.getAllChargers().forEach(charger => {
      const isOnline = Boolean(charger.lastSeen && (now - charger.lastSeen <= pcbHeartbeatTimeout));
      if (!isOnline && charger.status !== 'OFFLINE') {
        charger.status = 'OFFLINE';
        if (!charger.telemetry) charger.telemetry = {};
        charger.telemetry.status = 'OFFLINE';
        charger.telemetry.power_kw = 0.0;
        charger.telemetry.charger_current = 0.0;
        hasChanges = true;

        broadcast({
          type: 'CHARGER_UPDATED',
          charger
        });
        broadcast({
          type: 'TELEMETRY_UPDATE',
          chargerId: charger.id,
          telemetry: charger.telemetry,
          status: charger.status
        });
      }
    });

    if (hasChanges) {
      db.saveChargers();
    }
  } catch (err) {
    console.error('Error in PCB watchdog interval:', err);
  }
}, 5000);

// Mount modular routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/postgres', require('./routes/postgresRoutes'));
app.use('/api/chargers', require('./routes/chargerRoutes')(broadcast));

const telemetryRouter = require('./routes/telemetryRoutes')(broadcast);
app.use('/api/telemetry', telemetryRouter);
app.use('/telemetry', telemetryRouter);
app.use('/api/data', telemetryRouter);
app.use('/data', telemetryRouter);

app.use('/api/tariffs', require('./routes/tariffRoutes')(broadcast));
app.use('/api/tokens', require('./routes/tokenRoutes')(broadcast));
app.use('/api/reports', require('./routes/reportRoutes'));

// Network stats endpoint matching CSMS overview screenshot
app.get('/api/network/stats', (req, res) => {
  const chargers = db.getAllChargers();
  const totalChargePoints = chargers.length;
  const onlineCount = chargers.filter(c => c.status === 'CHARGING' || c.status === 'ONLINE').length;
  const activeSessions = chargers.filter(c => c.status === 'CHARGING').length;

  let totalEnergy = 0;
  let totalRevenue = 0;
  let totalSessions = 0;

  chargers.forEach(c => {
    if (c.stats) {
      totalEnergy += c.stats.totalEnergyKwh || 0;
      totalRevenue += c.stats.totalRevenue || 0;
      totalSessions += c.stats.totalSessions || 0;
    }
  });

  res.json({
    success: true,
    stats: {
      chargePoints: totalChargePoints,
      onlineNow: `${onlineCount}/${totalChargePoints}`,
      activeSessions: activeSessions,
      energyDelivered: totalEnergy.toFixed(1),
      revenue: Math.round(totalRevenue).toLocaleString('en-IN'),
      totalSessions: totalSessions,
      energyLast7Days: [
        { day: 'Thu', kwh: 120 },
        { day: 'Fri', kwh: 310 },
        { day: 'Sat', kwh: 25 },
        { day: 'Sun', kwh: 65 },
        { day: 'Mon', kwh: 140 },
        { day: 'Tue', kwh: 115 },
        { day: 'Wed', kwh: 72 }
      ]
    }
  });
});

// Fallback to frontend index.html ONLY for GET browser page navigation
// NEVER return HTML for API calls, POST requests, or non-HTML requests
app.use((req, res) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/telemetry') ||
    req.path.startsWith('/data') ||
    req.method !== 'GET' ||
    !req.accepts('html')
  ) {
    return res.status(404).json({
      success: false,
      error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
      hint: 'To ingest EV telemetry, send a POST request to /api/telemetry or /telemetry with your charger API key.'
    });
  }
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// WebSocket Lifecycle
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'INIT',
    chargers: db.getAllChargers(),
    timestamp: Date.now()
  }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (e) { }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.warn(`⚠️ Port ${PORT} is in use (server already active). Starting on port ${nextPort}...`);
    server.listen(nextPort, () => {
      console.log(`====================================================`);
      console.log(`⚡ SAAPHZONE CSMS CONTROL SERVER RUNNING`);
      console.log(`🌐 Dashboard URL: http://localhost:${nextPort}`);
      console.log(`📡 Telemetry API: http://localhost:${nextPort}/api/telemetry`);
      console.log(`🔌 WebSocket URL: ws://localhost:${nextPort}`);
      console.log(`====================================================`);
    });
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`⚡ SAAPHZONE CSMS CONTROL SERVER RUNNING`);
  console.log(`🌐 Dashboard URL: http://localhost:${PORT}`);
  console.log(`📡 Telemetry API: http://localhost:${PORT}/api/telemetry`);
  console.log(`🔌 WebSocket URL: ws://localhost:${PORT}`);
  console.log(`====================================================`);
});

module.exports = { app, server };
