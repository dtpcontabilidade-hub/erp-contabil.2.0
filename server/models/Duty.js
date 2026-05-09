// server/models/Duty.js — versão completa
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name:        { type: String, required: true, trim: true },
  type:        { type: String, required: true, default: 'Outros' },
  competence:  { type: String, required: true },
  dueDate:     { type: Date, required: true },
  status:      { type: String, enum: ['pendente','em_andamento','entregue','pago','atrasado','dispensado'], default: 'pendente' },
  amount:      { type: Number, default: 0 },
  multa:       { type: Number, default: 0 },
  juros:       { type: Number, default: 0 },
  responsavel: String,
  protocol:    String,
  deliveredAt: Date,
  paidAt:      Date,
  notes:       String,
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Auto-marca como atrasado se passou do vencimento e ainda está pendente
schema.pre('save', function(next) {
  if (['pendente','em_andamento'].includes(this.status)) {
    const now = new Date(); now.setHours(0,0,0,0);
    const due = new Date(this.dueDate); due.setHours(0,0,0,0);
    if (due < now) this.status = 'atrasado';
  }
  next();
});

schema.index({ company:1, competence:1 });
schema.index({ dueDate:1, status:1 });
schema.set('toJSON', { transform(_,ret){ delete ret.__v; return ret; } });
module.exports = mongoose.model('Duty', schema);
