const express = require('express');
const router = express.Router();
const db = require('../../database/db');

module.exports = function(broadcast) {
  // GET all tokens and PCB hardware keys for every charger
  router.get('/', (req, res) => {
    const chargers = db.getAllChargers();

    const tokenList = chargers.map(c => ({
      chargerId: c.id,
      chargerName: c.name,
      location: c.location,
      status: c.status,
      pcbApiKey: c.apiKey,
      rfidTokens: c.rfidTokens || [],
      lastSeen: c.lastSeen,
      totalTokens: (c.rfidTokens ? c.rfidTokens.length : 0) + 1 // RFID cards + PCB Key
    }));

    res.json({
      success: true,
      count: tokenList.length,
      tokens: tokenList
    });
  });

  // Assign RFID token to charger
  router.post('/:id', (req, res) => {
    const { token } = req.body;
    if (!token || token.trim() === '') {
      return res.status(400).json({ success: false, error: 'Token string is required' });
    }

    const charger = db.addRfidTokenToCharger(req.params.id, token);
    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }

    broadcast({
      type: 'CHARGER_UPDATED',
      charger
    });

    res.json({
      success: true,
      message: `Token added to ${charger.name}`,
      chargerId: charger.id,
      rfidTokens: charger.rfidTokens
    });
  });

  // Remove/revoke RFID token from charger
  router.delete('/:id/:token', (req, res) => {
    const charger = db.removeRfidTokenFromCharger(req.params.id, req.params.token);
    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }

    broadcast({
      type: 'CHARGER_UPDATED',
      charger
    });

    res.json({
      success: true,
      message: `Token revoked from ${charger.name}`,
      chargerId: charger.id,
      rfidTokens: charger.rfidTokens
    });
  });

  return router;
};
