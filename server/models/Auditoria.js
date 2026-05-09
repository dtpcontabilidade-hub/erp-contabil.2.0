const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  descricao: { type: String, required: true },
  status: { type: String, enum: ['conforme','nao_conforme','pendente','nao_aplicavel'], default: 'pendente' },
  observacao: String,
  evidencia: String,
  risco: { type: String, enum: ['alto','medio','baixo'], default: 'medio' },
}, { _id: true });

const schema = new mongoose.Schema({
  company:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }, // null = DTP
  tipo:       { type: String, enum: ['interna','cliente','fiscal','contabil','trabalhista','societaria'], required: true },
  titulo:     { type: String, required: true },
  competence: String,
  dataInicio: Date,
  dataFim:    Date,
  status:     { type: String, enum: ['planejada','em_andamento','concluida','cancelada'], default: 'planejada' },
  responsavel: String,
  itens:      [itemSchema],
  conclusao:  String,
  recomendacoes: String,
  riscoPonderado: { type: String, enum: ['alto','medio','baixo'] },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.set('toJSON', { transform(_, ret) { delete ret.__v; return ret; } });
module.exports = mongoose.model('Auditoria', schema);
