const express = require('express');
const router = express.Router();
const db = require('../../database/db');

module.exports = function(broadcast) {
  router.post('/', (req, res) => {
    const apiKey = req.headers['x-api-key'] ||
      (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null) ||
      req.body.apiKey;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing API key. Please provide x-api-key header or apiKey in payload.'
      });
    }

    const charger = db.recordTelemetry(apiKey, req.body);
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
      stats: charger.stats
    });

    res.json({
      success: true,
      message: 'Telemetry ingested successfully.',
      chargerId: charger.id,
      power_kw: charger.telemetry.power_kw,
      battery_soc: charger.telemetry.battery_soc,
      timestamp: charger.telemetry.timestamp
    });
  });

  return router;
};
