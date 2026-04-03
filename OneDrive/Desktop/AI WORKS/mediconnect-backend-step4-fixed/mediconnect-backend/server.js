require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const routes = require('./src/routes/index');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────
// Helmet adds security headers
app.use(helmet());

// CORS — allows frontend to talk to backend
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // Set this to your Vercel URL in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting — max 100 requests per 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use('/api/', limiter);

// Stricter rate limit for login/signup routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' }
});
app.use('/api/clinic/login', authLimiter);
app.use('/api/clinic/signup', authLimiter);
app.use('/api/patient/login', authLimiter);
app.use('/api/patient/signup', authLimiter);

// ─── BODY PARSER ─────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── ROUTES ──────────────────────────────────────────────────────
app.use('/api', routes);

// ─── HEALTH CHECK ─────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: '🏥 MediConnect API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ─── 404 HANDLER ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── START SERVER ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 MediConnect Backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/`);
  console.log(`📡 API base: http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
