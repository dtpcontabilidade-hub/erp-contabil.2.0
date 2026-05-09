// server/models/AuditLog.js
// Registra toda ação crítica no sistema para rastreabilidade
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  // Quem fez
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName:   String,
  userRole:   String,
  userIP:     String,

  // O que fez
  action:     { type: String, required: true }, // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
  module:     { type: String, required: true }, // companies, payroll, transactions, etc.
  targetId:   String,   // ID do registro afetado
  targetName: String,   // Nome legível do registro

  // Dados da mudança
  before:     mongoose.Schema.Types.Mixed, // estado antes
  after:      mongoose.Schema.Types.Mixed, // estado depois
  changes:    [{ field: String, before: mongoose.Schema.Types.Mixed, after: mongoose.Schema.Types.Mixed }],

  // Contexto
  company:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  success:    { type: Boolean, default: true },
  message:    String,
  userAgent:  String,
  duration:   Number, // ms

}, { timestamps: true });

// Índices para consultas rápidas
schema.index({ user: 1, createdAt: -1 });
schema.index({ module: 1, action: 1, createdAt: -1 });
schema.index({ company: 1, createdAt: -1 });
schema.index({ createdAt: -1 });

// TTL: remove logs com mais de 2 anos automaticamente
schema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 3600 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', schema);
