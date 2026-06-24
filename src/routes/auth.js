const express  = require('express');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const router   = express.Router();
const auth     = require('../middleware/auth');

// Hardcoded admin — in production use a DB
const ADMIN = {
  username: process.env.ADMIN_USERNAME || 'griffinadmin',
  // Store hashed version of Griffin@2026
  passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Griffin@2026', 10),
};

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  if (username !== ADMIN.username)
    return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, ADMIN.passwordHash);
  if (!valid)
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({
    success: true,
    token,
    admin: { username, role: 'admin' },
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
});

// GET /api/auth/verify  — check if token is still valid
router.get('/verify', auth, (req, res) => {
  res.json({ valid: true, admin: req.admin });
});

// POST /api/auth/logout  — client just discards token; this is a confirmation
router.post('/logout', auth, (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
