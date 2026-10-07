const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const cors = require('cors');

const db = require('../database/db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

app.use(cors());
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

// WebSocket broadcast helper
function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

// Mount modular routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/chargers', require('./routes/chargerRoutes')(broadcast));
app.use('/api/telemetry', require('./routes/telemetryRoutes')(broadcast));
app.use('/api/tariffs', require('./routes/tariffRoutes')(broadcast));
app.use('/api/tokens', require('./routes/tokenRoutes')(broadcast));

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

// Fallback to frontend index.html for client-side routing
app.use((req, res) => {
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
    } catch (e) {}
  });
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
