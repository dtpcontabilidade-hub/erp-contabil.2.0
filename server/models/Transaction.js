// server/models/Transaction.js — versão completa DTP Contábil
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  company:       { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  date:          { type: Date, required: true, default: Date.now },
  description:   { type: String, required: true, trim: true },
  amount:        { type: Number, required: true, min: 0.01 },
  type:          { type: String, enum: ['debit','credit'], required: true },
  category:      { type: String, default: 'Outros' },
  debitAccount:  { type: String, required: true },
  creditAccount: { type: String, required: true },
  // Campos adicionados
  centroCusto:   { type: mongoose.Schema.Types.ObjectId, ref: 'CentroCusto', default: null },
  lote:          { type: String, trim: true },        // agrupamento de partidas
  competence:    { type: String, trim: true },        // YYYY-MM
  document:      { type: String, trim: true },        // nº NF / recibo
  documentDate:  Date,
  notes:         String,
  status:        { type: String, enum: ['confirmado','rascunho','cancelado'], default: 'confirmado' },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Auto-preenche competência a partir da data
schema.pre('save', function(next) {
  if (!this.competence && this.date) {
    const d = new Date(this.date);
    this.competence = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  next();
});

schema.index({ company: 1, competence: 1 });
schema.index({ company: 1, date: -1 });
schema.index({ lote: 1 });
schema.set('toJSON', { transform(_, ret) { delete ret.__v; return ret; } });
module.exports = mongoose.model('Transaction', schema);
