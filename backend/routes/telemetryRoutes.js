const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const { recordTelemetryToPg } = require('./postgresRoutes');

module.exports = function(broadcast) {
  router.post('/', (req, res) => {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const rawKey = req.headers['x-api-key'] ||
      req.headers['api-key'] ||
      req.headers['apikey'] ||
      req.query['x-api-key'] ||
      req.query['api-key'] ||
      req.query.apiKey ||
      req.query.api_key ||
      req.query.key ||
      (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null) ||
      body.apiKey ||
      body.api_key ||
      body.key ||
      body['x-api-key'];

    const apiKey = rawKey ? String(rawKey).trim() : null;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing API key. Please provide x-api-key header, query param (?x-api-key=...), or apiKey in body.'
      });
    }

    const charger = db.recordTelemetry(apiKey, body);
    if (!charger) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or unauthorized API key.'
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

    res.json({
      success: true,
      message: 'Telemetry ingested successfully.',
      chargerId: charger.id,
      power_kw: charger.telemetry.power_kw,
      battery_soc: charger.telemetry.battery_soc,
      timestamp: charger.telemetry.timestamp,
      lastSeen: charger.lastSeen,
      receivedAt: new Date(charger.lastSeen).toISOString()
    });
  });

  return router;
};
