// server/models/User.js — Permissões granulares universais
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const TODOS_MODULOS = [
  'dashboard','empresas','lancamentos','obrigacoes','honorarios',
  'folha','bpo','controladoria','fpa','auditoria','consultorias',
  'escrituracao','obrigacoesFederais','demonstrativos','planoContas',
  'centralGestao','mensagens','documentos'
];

const permSchema = {
  // Quais módulos aparecem no menu
  modulosVisiveis: {
    dashboard:         { type: Boolean, default: true  },
    empresas:          { type: Boolean, default: true  },
    lancamentos:       { type: Boolean, default: true  },
    obrigacoes:        { type: Boolean, default: true  },
    honorarios:        { type: Boolean, default: true  },
    folha:             { type: Boolean, default: true  },
    bpo:               { type: Boolean, default: true  },
    controladoria:     { type: Boolean, default: true  },
    fpa:               { type: Boolean, default: true  },
    auditoria:         { type: Boolean, default: true  },
    consultorias:      { type: Boolean, default: true  },
    escrituracao:      { type: Boolean, default: true  },
    obrigacoesFederais:{ type: Boolean, default: true  },
    demonstrativos:    { type: Boolean, default: true  },
    planoContas:       { type: Boolean, default: true  },
    centralGestao:     { type: Boolean, default: true  },
    mensagens:         { type: Boolean, default: true  },
    documentos:        { type: Boolean, default: true  },
  },
  // Quais módulos pode editar (criar, alterar, excluir)
  podeEditar: {
    dashboard:         { type: Boolean, default: true  },
    empresas:          { type: Boolean, default: true  },
    lancamentos:       { type: Boolean, default: true  },
    obrigacoes:        { type: Boolean, default: true  },
    honorarios:        { type: Boolean, default: true  },
    folha:             { type: Boolean, default: true  },
    bpo:               { type: Boolean, default: true  },
    controladoria:     { type: Boolean, default: true  },
    fpa:               { type: Boolean, default: true  },
    auditoria:         { type: Boolean, default: true  },
    consultorias:      { type: Boolean, default: true  },
    escrituracao:      { type: Boolean, default: true  },
    obrigacoesFederais:{ type: Boolean, default: true  },
    demonstrativos:    { type: Boolean, default: true  },
    planoContas:       { type: Boolean, default: true  },
    centralGestao:     { type: Boolean, default: false },
    mensagens:         { type: Boolean, default: true  },
    documentos:        { type: Boolean, default: true  },
  },
  // Permissões especiais
  especiais: {
    verValoresFinanceiros: { type: Boolean, default: true  },
    baixarRelatorios:      { type: Boolean, default: true  },
    enviarMensagens:       { type: Boolean, default: true  },
    verHolerites:          { type: Boolean, default: true  },
    aprovarLancamentos:    { type: Boolean, default: false },
    gerenciarUsuarios:     { type: Boolean, default: false },
  },
};

const schema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role:     { type: String, enum: ['admin','contador','auxiliar','cliente'], default: 'contador' },
  cargo:    { type: String, trim: true },
  cpf:      { type: String, trim: true },
  telefone: { type: String, trim: true },
  crc:      { type: String },
  active:   { type: Boolean, default: true },

  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
  },

  // ── PERMISSÕES (universais — ERP e Portal) ──
  // Quem define: o admin (Daniel), manualmente, via Central de Gestão
  // NÃO é amarrado ao role — role só identifica tipo de acesso (ERP vs Portal)
  acessos: permSchema,

  // Compatibilidade com versão anterior
  clienteConfig: {
    modulosVisiveis: { type: mongoose.Schema.Types.Mixed, default: {} },
    podeEditar:      { type: mongoose.Schema.Types.Mixed, default: {} },
    permissoes:      { type: mongoose.Schema.Types.Mixed, default: {} },
    mensagemBemVindo:  { type: String,  default: '' },
    alertasVencimento: { type: Boolean, default: true  },
    notificacaoEmail:  { type: Boolean, default: true  },
  },

  // Mensagem personalizada
  mensagemBemVindo: { type: String, default: '' },

  // Super admin — NUNCA tem restrição
  isSuperAdmin: { type: Boolean, default: false },

  // ── SEGURANÇA ──
  loginAttempts:    { type: Number, default: 0, select: false },
  lockUntil:        { type: Date, select: false },
  passwordChangedAt:{ type: Date },
  lastLogin:        { type: Date },
}, { timestamps: true });

// Hash automático da senha
schema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

schema.methods.matchPassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

// Helper: pode ver módulo?
schema.methods.podeVer = function(modulo) {
  if (this.isSuperAdmin || this.email === 'daniel@dtpcontabil.com.br') return true;
  return this.acessos?.modulosVisiveis?.[modulo] !== false;
};

// Helper: pode editar módulo?
schema.methods.podeEditarMod = function(modulo) {
  if (this.isSuperAdmin || this.email === 'daniel@dtpcontabil.com.br') return true;
  return this.acessos?.podeEditar?.[modulo] === true;
};

module.exports = mongoose.model('User', schema);
module.exports.TODOS_MODULOS = TODOS_MODULOS;
