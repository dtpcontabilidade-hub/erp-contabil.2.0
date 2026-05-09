const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  date:        { type: Date, required: true, default: Date.now },
  competence:  { type: String, required: true },
  type:        { type: String, enum: ['receita','despesa'], required: true },
  category:    { type: String, required: true },
  description: { type: String, required: true },
  amount:      { type: Number, required: true, min: 0.01 },
  dueDate:     { type: Date, required: true },
  paidDate:    { type: Date },
  status:      { type: String, enum: ['pendente','pago','atrasado','cancelado'], default: 'pendente' },
  paymentMethod: { type: String },
  bankAccount:   { type: String },
  document:      { type: String },
  notes:         { type: String },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.pre('save', function(next) {
  if (!this.competence && this.date) {
    const d = new Date(this.date);
    this.competence = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  next();
});

schema.set('toJSON', { transform(_, ret) { delete ret.__v; return ret; } });
module.exports = mongoose.model('BPO', schema);
