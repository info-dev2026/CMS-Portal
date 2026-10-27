const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const { recordTelemetryToPg } = require('./postgresRoutes');

module.exports = function(broadcast) {
  // Helpful GET endpoint so developers testing in Postman or browser get JSON instructions
  const handleGetInfo = (req, res) => {
    const chargers = db.getAllChargers();
    res.json({
      success: true,
      message: 'SAAPHZONE EV Telemetry Ingestion API is ONLINE.',
      method: 'POST',
      endpoints: [
        'POST /api/telemetry',
        'POST /telemetry',
        'POST /api/data',
        'POST /data'
      ],
      authenticationMethods: {
        header: 'x-api-key: <charger_api_key>',
        queryParam: '?apiKey=<charger_api_key>',
        bodyField: '"apiKey": "<charger_api_key>" (or "chargerId", "name")'
      },
      registeredChargers: chargers.map(c => ({
        id: c.id,
        name: c.name,
        apiKey: c.apiKey,
        status: c.status
      })),
      samplePayload: {
        charger_voltage: 418.5,
        charger_current: 148.2,
        battery_soc: 78.0,
        battery_req_voltage: 425.0,
        battery_req_current: 160.0,
        power_kw: 62.0,
        battery_temp: 34.2,
        charger_temp: 28.5,
        battery_connected: true
      }
    });
  };

  const handlePostTelemetry = (req, res) => {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const rawKey = req.headers['x-api-key'] ||
      req.headers['api-key'] ||
      req.headers['apikey'] ||
      req.headers['key'] ||
      req.headers['x-charger-id'] ||
      req.query['x-api-key'] ||
      req.query['api-key'] ||
      req.query.apiKey ||
      req.query.api_key ||
      req.query.key ||
      req.query.chargerId ||
      req.query.charger_id ||
      req.query.id ||
      (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null) ||
      body.apiKey ||
      body.api_key ||
      body.key ||
      body['x-api-key'] ||
      body.chargerId ||
      body.charger_id ||
      body.id ||
      body.chargerName ||
      body.charger_name ||
      body.name;

    let apiKey = rawKey ? String(rawKey).trim() : null;

    if (!apiKey) {
      const chargers = db.getAllChargers();
      // If only 1 charger exists in fleet, conveniently auto-route to it
      if (chargers.length === 1) {
        apiKey = chargers[0].apiKey;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Missing charger API key or Charger ID in request.',
          hint: 'Provide your charger API key in the x-api-key header, query parameter ?apiKey=..., or {"apiKey": "..."} in the JSON body.',
          registeredChargers: chargers.map(c => ({ id: c.id, name: c.name, apiKey: c.apiKey }))
        });
      }
    }

    const charger = db.recordTelemetry(apiKey, body);
    if (!charger) {
      const chargers = db.getAllChargers();
      return res.status(403).json({
        success: false,
        error: `Invalid or unauthorized API key / Charger identifier: "${apiKey}".`,
        hint: 'Use one of the registered charger API keys or charger IDs below.',
        registeredChargers: chargers.map(c => ({ id: c.id, name: c.name, apiKey: c.apiKey }))
      });
    }

    broadcast({
      type: 'TELEMETRY_UPDATE',
      chargerId: charger.id,
      telemetry: charger.telemetry,
      status: charger.status,
      lastSeen: charger.lastSeen,
      stats: charger.stats,
      sessionPendingReset: charger.sessionPendingReset === true
    });

    // Also persist to PostgreSQL
    recordTelemetryToPg(charger, charger.telemetry).catch(e => console.error('PG write error:', e.message));

    // Deliver pending hardware commands (e.g. AUTHENTICATE_BATTERY_CONNECT, START_CHARGING, STOP)
    const pendingCommands = db.getPendingCommands(charger.id);

    return res.status(200).json({
      success: true,
      message: 'Telemetry ingested successfully.',
      chargerId: charger.id,
      chargerName: charger.name,
      batteryConnected: charger.batteryConnected !== false,
      power_kw: charger.telemetry.power_kw,
      battery_soc: charger.telemetry.battery_soc,
      charger_voltage: charger.telemetry.charger_voltage,
      charger_current: charger.telemetry.charger_current,
      session_energy_kwh: charger.telemetry.session_energy_kwh,
      timestamp: charger.telemetry.timestamp,
      lastSeen: charger.lastSeen,
      receivedAt: new Date(charger.lastSeen).toISOString(),
      pendingCommands: pendingCommands
    });
  };

  // Hardware PCB commands query endpoint (?apiKey=...)
  router.get('/commands', (req, res) => {
    const rawKey = req.headers['x-api-key'] || req.query.apiKey || req.query.key || req.query.chargerId;
    const charger = db.getChargerByApiKey(rawKey);
    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found for given key' });
    }
    const commands = db.getPendingCommands(charger.id);
    res.json({
      success: true,
      chargerId: charger.id,
      batteryConnected: charger.batteryConnected !== false,
      commands
    });
  });

  // Mount on root and multiple sub-paths to avoid Postman 404s
  router.get(['/', '/data', '/ingest', '/record'], handleGetInfo);
  router.post(['/', '/data', '/ingest', '/record'], handlePostTelemetry);

  return router;
};

