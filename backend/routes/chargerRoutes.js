const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Initialize connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
// Middleware to verify API secret
function verifyApiKey(req, res, next) {
  const key = req.header('8a8980bf460ad644e86543c05db70579cfc4992cc939a76e451934b18dbb551d');
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
router.get('/chargers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM chargers');
    res.json({ success: true, chargers: result.rows });
  } catch (err) {
    console.error('Error querying PostgreSQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
