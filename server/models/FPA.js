const mongoose = require('mongoose');

const linhaSchema = new mongoose.Schema({
  categoria: { type: String, required: true },
  descricao:  String,
  orcado:     { type: Number, default: 0 },
  realizado:  { type: Number, default: 0 },
  projetado:  { type: Number, default: 0 },
  tipo:       { type: String, enum: ['receita','despesa'], required: true },
}, { _id: true });

const schema = new mongoose.Schema({
  company:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  competence: { type: String, required: true },
  tipo:       { type: String, enum: ['orcamento','projecao','cenario'], default: 'orcamento' },
  cenario:    { type: String, enum: ['base','otimista','pessimista'], default: 'base' },
  titulo:     String,
  linhas:     [linhaSchema],
  notas:      String,
  status:     { type: String, enum: ['rascunho','aprovado','revisao'], default: 'rascunho' },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.set('toJSON', { transform(_, ret) { delete ret.__v; return ret; } });
module.exports = mongoose.model('FPA', schema);
