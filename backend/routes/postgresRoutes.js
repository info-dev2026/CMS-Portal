const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Initialize connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create tables on startup if they don't exist yet
const initDb = pool.query(`
  CREATE TABLE IF NOT EXISTS chargers (
    id             SERIAL PRIMARY KEY,
    name           TEXT NOT NULL,
    location       TEXT,
    max_power_kw   NUMERIC,
    connector_type TEXT,
    status         TEXT DEFAULT 'OFFLINE',
    created_at     TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS telemetry (
    id           SERIAL PRIMARY KEY,
    charger_id   INTEGER REFERENCES chargers(id) ON DELETE CASCADE,
    voltage      NUMERIC,
    current      NUMERIC,
    power_kw     NUMERIC,
    energy_kwh   NUMERIC,
    battery_soc  NUMERIC,
    status       TEXT,
    recorded_at  TIMESTAMPTZ DEFAULT NOW()
  );
`).then(() => console.log('✅ PostgreSQL tables ready'))
  .catch(err => console.error('⚠️ PostgreSQL init failed:', err.message));

// Middleware to verify API secret
function verifyApiKey(req, res, next) {
  const key = req.header('x-api-key');
  if (key && key === process.env.API_SECRET) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Invalid API key' });
}

// Simple health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'PostgreSQL route is operational' });
});
// Protected test endpoint
router.get('/protected', verifyApiKey, (req, res) => {
  res.json({ success: true, message: 'Access granted to protected endpoint' });
});

// Example: fetch all chargers from a PostgreSQL table named "chargers"
router.get('/chargers', verifyApiKey, async (req, res) => {
  try {
    await initDb;
    const result = await pool.query('SELECT * FROM chargers ORDER BY id');
    res.json({ success: true, count: result.rowCount, chargers: result.rows });
  } catch (err) {
    console.error('Error querying PostgreSQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a charger
router.post('/chargers', verifyApiKey, async (req, res) => {
  const { name, location, max_power_kw, connector_type, status } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'Field "name" is required' });
  }
  try {
    await initDb;
    const result = await pool.query(
      `INSERT INTO chargers (name, location, max_power_kw, connector_type, status)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'OFFLINE')) RETURNING *`,
      [name, location || null, max_power_kw ?? null, connector_type || null, status || null]
    );
    res.status(201).json({ success: true, message: 'Charger created', charger: result.rows[0] });
  } catch (err) {
    console.error('Error inserting charger:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Push a telemetry reading for a charger
router.post('/telemetry', verifyApiKey, async (req, res) => {
  const { charger_id, voltage, current, power_kw, energy_kwh, battery_soc, status } = req.body || {};
  if (!charger_id) {
    return res.status(400).json({ success: false, error: 'Field "charger_id" is required' });
  }
  try {
    await initDb;
    const charger = await pool.query('SELECT id FROM chargers WHERE id = $1', [charger_id]);
    if (charger.rowCount === 0) {
      return res.status(404).json({ success: false, error: `Charger ${charger_id} not found` });
    }
    const result = await pool.query(
      `INSERT INTO telemetry (charger_id, voltage, current, power_kw, energy_kwh, battery_soc, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [charger_id, voltage ?? null, current ?? null, power_kw ?? null, energy_kwh ?? null, battery_soc ?? null, status || null]
    );
    if (status) {
      await pool.query('UPDATE chargers SET status = $1 WHERE id = $2', [status, charger_id]);
    }
    res.status(201).json({ success: true, message: 'Telemetry recorded', telemetry: result.rows[0] });
  } catch (err) {
    console.error('Error inserting telemetry:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Read telemetry (optionally filtered by ?charger_id=1, latest first)
router.get('/telemetry', verifyApiKey, async (req, res) => {
  try {
    await initDb;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const params = [limit];
    let where = '';
    if (req.query.charger_id) {
      params.push(req.query.charger_id);
      where = 'WHERE charger_id = $2';
    }
    const result = await pool.query(
      `SELECT * FROM telemetry ${where} ORDER BY recorded_at DESC LIMIT $1`,
      params
    );
    res.json({ success: true, count: result.rowCount, telemetry: result.rows });
  } catch (err) {
    console.error('Error querying telemetry:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
