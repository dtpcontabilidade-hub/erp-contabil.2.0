const mongoose = require('mongoose');

const acaoSchema = new mongoose.Schema({
  descricao:   { type: String, required: true },
  responsavel: String,
  prazo:       Date,
  status:      { type: String, enum: ['pendente','em_andamento','concluida'], default: 'pendente' },
  resultado:   String,
}, { _id: true });

const schema = new mongoose.Schema({
  company:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  tipo:       { type: String, enum: ['tributaria','empresarial'], required: true },
  titulo:     { type: String, required: true },
  descricao:  String,
  status:     { type: String, enum: ['aberta','em_andamento','concluida','cancelada'], default: 'aberta' },
  prioridade: { type: String, enum: ['alta','media','baixa'], default: 'media' },
  dataInicio: Date,
  dataFim:    Date,
  honorario:  { type: Number, default: 0 },
  economiaEstimada: { type: Number, default: 0 },
  diagnostico: String,
  parecer:    String,
  acoes:      [acaoSchema],
  tags:       [String],
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.set('toJSON', { transform(_, ret) { delete ret.__v; return ret; } });
module.exports = mongoose.model('Consultoria', schema);
