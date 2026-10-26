const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('../database/db');

const app = express();

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

// Serverless WebSocket broadcast stub (safe no-op)
const broadcast = (data) => {
  // Long-lived WebSockets are managed in server.js for standalone Node environments.
};

// Health & Root API
app.get(['/api', '/api/health'], (req, res) => {
  res.json({
    status: 'online',
    system: 'SAAPHZONE CSMS Control API',
    version: '3.0.0',
    timestamp: Date.now()
  });
});

// Mount API routes
app.use('/api/auth', require('../backend/routes/authRoutes'));
app.use('/api/postgres', require('../backend/routes/postgresRoutes'));
app.use('/api/chargers', require('../backend/routes/chargerRoutes')(broadcast));

const telemetryRouter = require('../backend/routes/telemetryRoutes')(broadcast);
app.use('/api/telemetry', telemetryRouter);
app.use('/telemetry', telemetryRouter);
app.use('/api/data', telemetryRouter);
app.use('/data', telemetryRouter);

app.use('/api/tariffs', require('../backend/routes/tariffRoutes')(broadcast));
app.use('/api/tokens', require('../backend/routes/tokenRoutes')(broadcast));
app.use('/api/reports', require('../backend/routes/reportRoutes'));

// Network stats endpoint matching CSMS overview
app.get('/api/network/stats', (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all for serverless API: never return HTML
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    hint: 'To ingest EV telemetry, send a POST request to /api/telemetry or /telemetry.'
  });
});

module.exports = app;

