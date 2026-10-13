const express = require('express');
const router = express.Router();
const db = require('../../database/db');

module.exports = function(broadcast) {
  // Get all chargers
  router.get('/', (req, res) => {
    const chargers = db.getAllChargers();
    res.json({
      success: true,
      count: chargers.length,
      chargers: chargers
    });
  });

  // Add new charger (from dedicated Add Charger page)
  router.post('/', (req, res) => {
    const { name, location, maxVoltage, maxCurrent, connectorType, username, password, ratePerKwh, rfidToken } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Charger name is required.' });
    }

    const newCharger = db.addCharger({
      name,
      location,
      maxVoltage,
      maxCurrent,
      connectorType,
      username,
      password,
      ratePerKwh,
      rfidToken
    });

    broadcast({
      type: 'CHARGER_ADDED',
      charger: newCharger
    });

    res.status(201).json({
      success: true,
      message: 'Charger created successfully with unique PCB Key & Login credentials.',
      charger: newCharger
    });
  });

  // Get single charger
  router.get('/:id', (req, res) => {
    const charger = db.getChargerById(req.params.id);
    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }
    res.json({ success: true, charger });
  });

  // Delete charger handler (supports both DELETE and POST /delete)
  const handleDelete = (req, res) => {
    const chargerId = req.params.id;
    const charger = db.getChargerById(chargerId);
    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found or already deleted.' });
    }

    const success = db.deleteCharger(chargerId);
    if (success) {
      broadcast({
        type: 'CHARGER_DELETED',
        chargerId: chargerId
      });

      return res.json({
        success: true,
        message: 'Charger removed successfully.',
        chargerId: chargerId
      });
    } else {
      return res.status(500).json({ success: false, error: 'Failed to delete charger.' });
    }
  };

  router.delete('/:id', handleDelete);
  router.post('/:id/delete', handleDelete);

  // Portal Remote Control (Turn Charger ON / OFF directly through portal)
  router.post('/:id/control', (req, res) => {
    const { action } = req.body; // 'ON', 'OFF', 'START', 'STOP'
    const chargerId = req.params.id;
    const charger = db.getChargerById(chargerId);

    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }

    const isTurnOn = action === 'ON' || action === 'START';

    // Update charger operational state and live telemetry
    charger.status = isTurnOn ? 'CHARGING' : 'ONLINE';
    charger.lastSeen = Date.now();

    if (!charger.telemetry) charger.telemetry = {};

    if (isTurnOn) {
      charger.telemetry.status = 'CHARGING';
      charger.telemetry.charger_voltage = charger.telemetry.charger_voltage > 100 ? charger.telemetry.charger_voltage : 418.5;
      charger.telemetry.charger_current = charger.telemetry.charger_current > 10 ? charger.telemetry.charger_current : 148.2;
      const v = Number(charger.telemetry.charger_voltage);
      const a = Number(charger.telemetry.charger_current);
      charger.telemetry.power_kw = Number((v * a / 1000).toFixed(1));
      charger.telemetry.charging_mode = 'SPORT PLUS // CC FAST';
    } else {
      charger.telemetry.status = 'ONLINE';
      charger.telemetry.power_kw = 0.0;
      charger.telemetry.charger_current = 0.0;
      charger.telemetry.charging_mode = 'STANDBY // READY';
    }

    charger.telemetry.timestamp = Date.now();
    db.saveChargers();

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

    res.json({
      success: true,
      message: `Charger turned ${isTurnOn ? 'ON' : 'OFF'} successfully.`,
      status: charger.status,
      charger
    });
  });

  // Regenerate key
  router.post('/:id/regenerate-key', (req, res) => {
    const result = db.regenerateApiKey(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }

    broadcast({
      type: 'CHARGER_UPDATED',
      charger: result.charger
    });

    res.json({
      success: true,
      message: 'API key regenerated successfully.',
      oldKey: result.oldKey,
      apiKey: result.newKey,
      charger: result.charger
    });
  });

  // Update credentials
  router.post('/:id/credentials', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const charger = db.updateChargerCredentials(req.params.id, username, password);
    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }

    broadcast({
      type: 'CHARGER_UPDATED',
      charger
    });

    res.json({
      success: true,
      message: `Credentials updated for ${charger.name}`,
      chargerId: charger.id,
      username: charger.credentials.username
    });
  });

  return router;
};
