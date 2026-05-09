// server/index.js — DTP Contábil ERP v4.1 com segurança
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const compression = require('compression');
const path        = require('path');
const connectDB   = require('./config/db');

const app = express();
app.set('trust proxy', 1);
connectDB();

// ── CORS ─────────────────────────────────────────────────────
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// ── SEGURANÇA: Rate Limiting (login) ─────────────────────────
try {
  const rateLimit = require('express-rate-limit');
  // Login: máximo 10 tentativas por 15 minutos por IP
  app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  }));
  console.log('   🛡️  Rate limit ativo no login');
} catch(e) {}

// ── SEGURANÇA: Sanitização contra injeção MongoDB ────────────
try {
  const mongoSanitize = require('express-mongo-sanitize');
  app.use(mongoSanitize({ replaceWith: '_' }));
  console.log('   🛡️  Sanitização MongoDB ativa');
} catch(e) {}

// ── HEADERS DE SEGURANÇA (sem CSP que bloqueia onclick) ──────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ── ARQUIVOS ESTÁTICOS ───────────────────────────────────────
app.use(express.static(path.join(__dirname, '../client')));

// ── API ──────────────────────────────────────────────────────
app.use('/api', require('./routes/index'));

// ── FALLBACK ─────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Rota não encontrada' });
  }
  res.sendFile(path.join(__dirname, '../client/login.html'));
});

// ── HANDLER GLOBAL DE ERROS ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Erro interno' : err.message,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ DTP ERP rodando em http://localhost:' + PORT);
  console.log('   MongoDB: ' + (process.env.MONGODB_URI ? '✅ OK' : '❌ FALTA'));
});
