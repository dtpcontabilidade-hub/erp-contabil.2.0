// server/models/SPEDTransmissao.js
// Histórico de transmissões SPED (ECD, EFD, EFD-Contribuições, ECF)
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  company:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  tipo:       { type: String, enum: ['ECD','EFD','EFD-Contrib','ECF'], required: true },
  competence: { type: String },          // YYYY-MM
  exercicio:  { type: String },          // YYYY (ECD/ECF são anuais)

  // ── Status do ciclo de transmissão ─────
  status: {
    type: String,
    enum: ['gerado','validado','transmitido','aceito','rejeitado','retificado'],
    default: 'gerado',
  },

  // ── Validação ─────
  validacao: {
    valido:     { type: Boolean, default: null },
    erros:      [{ tipo: String, mensagem: String, registro: String, linha: Number }],
    avisos:     [{ tipo: String, mensagem: String, registro: String }],
    totalRegistros: { type: Number, default: 0 },
    dataValidacao: Date,
  },

  // ── Arquivo gerado ─────
  arquivo: {
    nome:      String,                   // ECD_12345678_2025.txt
    tamanho:   Number,                   // bytes
    hash:      String,                   // SHA256 para verificar integridade
    dataGeracao: Date,
  },

  // ── Transmissão (preenchido pelo contador) ─────
  transmissao: {
    dataTransmissao: Date,
    protocolo:       String,             // recibo de entrega da Receita
    receibido:       String,              // alias antigo
    transmitidoPor:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transmitidoPorNome: String,
    observacoes:     String,
  },

  // ── Retificação ─────
  retificacao: {
    isRetificacao:    { type: Boolean, default: false },
    transmissaoOriginal: { type: mongoose.Schema.Types.ObjectId, ref: 'SPEDTransmissao' },
    motivo:           String,
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.index({ company: 1, tipo: 1, competence: 1 });
schema.index({ company: 1, tipo: 1, exercicio: 1 });
schema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.SPEDTransmissao || mongoose.model('SPEDTransmissao', schema);
