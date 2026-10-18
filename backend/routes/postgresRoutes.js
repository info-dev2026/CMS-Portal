const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Initialize connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/cms_backend',
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1')
    ? { rejectUnauthorized: false }
    : false,
});

// Create tables on startup if they don't exist yet
const initDb = (async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chargers (
        id             VARCHAR(100) PRIMARY KEY,
        name           TEXT NOT NULL,
        location       TEXT,
        max_power_kw   NUMERIC,
        connector_type TEXT,
        status         TEXT DEFAULT 'OFFLINE',
        api_key        TEXT,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS telemetry (
        id                   SERIAL PRIMARY KEY,
        charger_id           VARCHAR(100) REFERENCES chargers(id) ON DELETE CASCADE,
        charger_name         TEXT,
        charger_voltage      NUMERIC,
        charger_current      NUMERIC,
        charger_status       TEXT,
        battery_soc          NUMERIC,
        battery_req_voltage  NUMERIC,
        battery_req_current  NUMERIC,
        battery_temp         NUMERIC,
        charger_temp         NUMERIC,
        status               TEXT,
        charging_mode        TEXT,
        fault_code           TEXT,
        session_energy_kwh   NUMERIC,
        session_duration_min NUMERIC,
        power_kw             NUMERIC,
        target_power_kw      NUMERIC,
        voltage              NUMERIC,
        current              NUMERIC,
        energy_kwh           NUMERIC,
        timestamp            BIGINT,
        recorded_at          TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ PostgreSQL tables (chargers, telemetry) ready');

    // Auto seed chargers from chargers.json if chargers table is empty
    const checkCount = await pool.query('SELECT COUNT(*) FROM chargers');
    if (parseInt(checkCount.rows[0].count, 10) === 0) {
      const chargersJsonPath = path.join(__dirname, '..', '..', 'database', 'chargers.json');
      if (fs.existsSync(chargersJsonPath)) {
        const chargers = JSON.parse(fs.readFileSync(chargersJsonPath, 'utf8'));
        for (const c of chargers) {
          await pool.query(
            `INSERT INTO chargers (id, name, location, max_power_kw, connector_type, status, api_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               location = EXCLUDED.location,
               status = EXCLUDED.status`,
            [
              c.id,
              c.name || 'Charger ' + c.id,
              c.location || 'Default Location',
              c.maxVoltage && c.maxCurrent ? ((c.maxVoltage * c.maxCurrent) / 1000) : 60,
              c.connectorType || 'CCS2',
              c.status || 'OFFLINE',
              c.apiKey || null
            ]
          );

          if (c.telemetry) {
            const t = c.telemetry;
            await pool.query(
              `INSERT INTO telemetry (
                charger_id, charger_name, charger_voltage, charger_current, charger_status,
                battery_soc, battery_req_voltage, battery_req_current, battery_temp, charger_temp,
                status, charging_mode, fault_code, session_energy_kwh, session_duration_min,
                power_kw, target_power_kw, voltage, current, energy_kwh, timestamp
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
              [
                c.id,
                c.name || c.id,
                t.charger_voltage || null,
                t.charger_current || null,
                t.status || c.status || null,
                t.battery_soc || null,
                t.battery_req_voltage || null,
                t.battery_req_current || null,
                t.battery_temp || null,
                t.charger_temp || null,
                t.status || null,
                t.charging_mode || null,
                t.fault_code || null,
                t.session_energy_kwh || null,
                t.session_duration_min || null,
                t.power_kw || null,
                t.target_power_kw || null,
                t.charger_voltage || null,
                t.charger_current || null,
                t.session_energy_kwh || null,
                t.timestamp || Date.now()
              ]
            );
          }
        }
        console.log(`✅ Seeded ${chargers.length} chargers into PostgreSQL database`);
      }
    }
  } catch (err) {
    console.error('⚠️ PostgreSQL init failed:', err.message);
  }
})();

// Helper to record telemetry to PostgreSQL
async function recordTelemetryToPg(charger, t) {
  try {
    await initDb;
    if (!charger || !charger.id) return;

    // Ensure charger exists with up-to-date stats
    const stats = charger.stats || {};
    await pool.query(
      `INSERT INTO chargers (id, name, location, max_power_kw, connector_type, status, api_key, is_ac, total_sessions, total_energy_kwh, total_revenue)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         max_power_kw = COALESCE(EXCLUDED.max_power_kw, chargers.max_power_kw),
         is_ac = EXCLUDED.is_ac,
         total_sessions = EXCLUDED.total_sessions,
         total_energy_kwh = EXCLUDED.total_energy_kwh,
         total_revenue = EXCLUDED.total_revenue`,
      [
        charger.id,
        charger.name || 'Charger ' + charger.id,
        charger.location || '',
        charger.maxPowerKw || ((charger.maxVoltage && charger.maxCurrent) ? (charger.maxVoltage * charger.maxCurrent / 1000) : 7.4),
        charger.connectorType || 'Type 2 AC',
        charger.status || 'CHARGING',
        charger.apiKey || null,
        Boolean(charger.isAc),
        stats.totalSessions || 0,
        stats.totalEnergyKwh || 0,
        stats.totalRevenue || 0
      ]
    );

    // If a session just completed (e.g. AC battery reached 100%), save completed session row in PostgreSQL
    if (charger.lastCompletedSession && !charger.lastCompletedSession.savedToPg) {
      const s = charger.lastCompletedSession;
      await pool.query(
        `INSERT INTO charging_sessions (session_id, charger_id, charger_name, connector_type, energy_kwh, duration_min, revenue, battery_soc_end, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          s.sessionId || 'sess_' + Date.now(),
          charger.id,
          charger.name || charger.id,
          charger.connectorType || 'AC',
          s.energyKwh || 0,
          s.durationMin || 0,
          s.revenue || 0,
          s.batterySocEnd || 100
        ]
      );
      charger.lastCompletedSession.savedToPg = true;
    }

    const data = t || {};
    await pool.query(
      `INSERT INTO telemetry (
        charger_id, charger_name, charger_voltage, charger_current, charger_status,
        battery_soc, battery_req_voltage, battery_req_current, battery_temp, charger_temp,
        status, charging_mode, fault_code, session_energy_kwh, session_duration_min,
        power_kw, target_power_kw, voltage, current, energy_kwh, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        charger.id,
        charger.name || charger.id,
        data.charger_voltage || null,
        data.charger_current || null,
        data.status || charger.status || null,
        data.battery_soc || null,
        data.battery_req_voltage || null,
        data.battery_req_current || null,
        data.battery_temp || null,
        data.charger_temp || null,
        data.status || charger.status || null,
        data.charging_mode || null,
        data.fault_code || null,
        data.session_energy_kwh || null,
        data.session_duration_min || null,
        data.power_kw || null,
        data.target_power_kw || null,
        data.charger_voltage || null,
        data.charger_current || null,
        data.session_energy_kwh || null,
        data.timestamp || Date.now()
      ]
    );
  } catch (err) {
    console.error('Failed to write telemetry to PostgreSQL:', err.message);
  }
}

// Middleware to verify API secret (optional for public read)
function verifyApiKey(req, res, next) {
  const rawKey = req.header('x-api-key') || req.query['x-api-key'] || req.query.apiKey || (req.body && req.body.apiKey);
  const key = rawKey ? String(rawKey).trim() : null;
  if (!process.env.API_SECRET || (key && key === process.env.API_SECRET.trim())) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Invalid API key' });
}

// Simple health check
router.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, current_database() as database');
    res.json({
      success: true,
      message: 'PostgreSQL connection operational',
      database: result.rows[0].database,
      serverTime: result.rows[0].current_time
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch all chargers
router.get('/chargers', async (req, res) => {
  try {
    await initDb;
    const result = await pool.query('SELECT * FROM chargers ORDER BY created_at DESC');
    res.json({ success: true, count: result.rowCount, chargers: result.rows });
  } catch (err) {
    console.error('Error querying PostgreSQL chargers:', err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Read telemetry (ordered by recorded_at descending)
router.get('/telemetry', async (req, res) => {
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
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Tabular view endpoint - returns all tables formatted with headers and rows
router.get('/table-data', async (req, res) => {
  try {
    await initDb;
    const chargersRes = await pool.query('SELECT * FROM chargers ORDER BY created_at DESC');
    const telemetryRes = await pool.query('SELECT * FROM telemetry ORDER BY recorded_at DESC LIMIT 100');
    const sessionsRes = await pool.query('SELECT * FROM charging_sessions ORDER BY completed_at DESC LIMIT 100');

    res.json({
      success: true,
      tables: {
        chargers: {
          columns: chargersRes.fields.map(f => f.name),
          rows: chargersRes.rows,
          total: chargersRes.rowCount
        },
        telemetry: {
          columns: telemetryRes.fields.map(f => f.name),
          rows: telemetryRes.rows,
          total: telemetryRes.rowCount
        },
        sessions: {
          columns: sessionsRes.fields.map(f => f.name),
          rows: sessionsRes.rows,
          total: sessionsRes.rowCount
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manual sync from chargers.json to PostgreSQL
router.post('/sync', async (req, res) => {
  try {
    await initDb;
    const chargersJsonPath = path.join(__dirname, '..', '..', 'database', 'chargers.json');
    if (!fs.existsSync(chargersJsonPath)) {
      return res.status(404).json({ success: false, error: 'chargers.json not found' });
    }
    const chargers = JSON.parse(fs.readFileSync(chargersJsonPath, 'utf8'));
    let synced = 0;
    for (const c of chargers) {
      await pool.query(
        `INSERT INTO chargers (id, name, location, max_power_kw, connector_type, status, api_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           location = EXCLUDED.location,
           status = EXCLUDED.status`,
        [
          c.id,
          c.name || 'Charger ' + c.id,
          c.location || 'Default Location',
          c.maxVoltage && c.maxCurrent ? ((c.maxVoltage * c.maxCurrent) / 1000) : 60,
          c.connectorType || 'CCS2',
          c.status || 'OFFLINE',
          c.apiKey || null
        ]
      );
      if (c.telemetry) {
        await recordTelemetryToPg(c, c.telemetry);
      }
      synced++;
    }
    res.json({ success: true, message: `Successfully synced ${synced} chargers to PostgreSQL` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.recordTelemetryToPg = recordTelemetryToPg;
module.exports.pool = pool;