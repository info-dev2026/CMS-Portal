const express = require('express');
const router = express.Router();
const db = require('../../database/db');

module.exports = function(broadcast) {
  // GET all tariffs with revenue and sessions per charger separately
  router.get('/', (req, res) => {
    const chargers = db.getAllChargers();

    let totalNetworkRevenue = 0;
    let totalNetworkSessions = 0;
    let totalNetworkEnergy = 0;

    const breakdown = chargers.map(c => {
      const stats = c.stats || { totalSessions: 0, totalEnergyKwh: 0, totalRevenue: 0 };
      const tariff = c.tariff || { ratePerKwh: 18.0, currency: '₹', sessionFee: 40.0 };

      totalNetworkRevenue += stats.totalRevenue || 0;
      totalNetworkSessions += stats.totalSessions || 0;
      totalNetworkEnergy += stats.totalEnergyKwh || 0;

      const avgPerSession = stats.totalSessions > 0
        ? +(stats.totalRevenue / stats.totalSessions).toFixed(2)
        : 0;

      return {
        chargerId: c.id,
        chargerName: c.name,
        location: c.location,
        status: c.status,
        ratePerKwh: tariff.ratePerKwh,
        sessionFee: tariff.sessionFee,
        currency: tariff.currency || '₹',
        totalSessions: stats.totalSessions,
        totalEnergyKwh: stats.totalEnergyKwh,
        totalRevenue: stats.totalRevenue,
        avgPerSession: avgPerSession
      };
    });

    res.json({
      success: true,
      summary: {
        totalRevenue: +totalNetworkRevenue.toFixed(2),
        totalSessions: totalNetworkSessions,
        totalEnergyKwh: +totalNetworkEnergy.toFixed(2),
        currency: '₹'
      },
      chargersTariffs: breakdown
    });
  });

  // Update tariff for a specific charger
  router.post('/:id', (req, res) => {
    const { ratePerKwh, sessionFee } = req.body;
    const charger = db.updateChargerTariff(req.params.id, ratePerKwh, sessionFee);

    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }

    broadcast({
      type: 'CHARGER_UPDATED',
      charger
    });

    res.json({
      success: true,
      message: `Tariff updated for ${charger.name}`,
      chargerId: charger.id,
      tariff: charger.tariff
    });
  });

  return router;
};
