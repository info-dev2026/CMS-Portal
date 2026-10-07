const express = require('express');
const router = express.Router();
const db = require('../../database/db');

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }

  const user = db.authenticateUser(username, password);
  if (user) {
    return res.json({ success: true, user });
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid username or password. Check credentials configured in SAAPHZONE CSMS.'
  });
});

// Update Admin Credentials
router.post('/update-admin', (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }

  const admin = db.updateAdmin(username, password, name);
  res.json({
    success: true,
    message: 'Admin credentials updated successfully.',
    admin: { username: admin.username, name: admin.name }
  });
});

// List all accounts for user management
router.get('/accounts', (req, res) => {
  res.json({ success: true, accounts: db.getAccountsList() });
});

module.exports = router;
