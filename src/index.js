require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { connectDB } = require('./db');
const authRoutes     = require('./routes/auth');
const productRoutes  = require('./routes/products');
const uploadRoutes   = require('./routes/upload');
const categoryRoutes = require('./routes/categories');

const app = express();

// ── Middleware ──────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://griffinbackend-1.onrender.com',
  'https://griffinsolutions26.netlify.app',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/upload',     uploadRoutes);
app.use('/api/categories', categoryRoutes);

// ── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Griffin Admin API running', time: new Date().toISOString() });
});

// ── 404 ─────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Error handler ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
connectDB().then(() => app.listen(PORT, () => {
  console.log(`\n🚀 Griffin Admin Backend running on http://localhost:${PORT}`);
  console.log(`📦 Products API  → http://localhost:${PORT}/api/products`);
  console.log(`🔐 Auth API      → http://localhost:${PORT}/api/auth/login`);
  console.log(`📁 Upload API    → http://localhost:${PORT}/api/upload`);
  console.log(`❤️  Health check  → http://localhost:${PORT}/api/health\n`);
})).catch(err => { console.error('Failed to connect to MongoDB:', err); process.exit(1); });
