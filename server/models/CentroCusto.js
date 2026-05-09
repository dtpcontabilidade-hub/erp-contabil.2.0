const mongoose = require('mongoose');

const ratioSchema = new mongoose.Schema({
  centro:      { type: mongoose.Schema.Types.ObjectId, ref: 'CentroCusto' },
  percentual:  { type: Number, min: 0, max: 100, default: 100 },
}, { _id: false });

const schema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  codigo:      { type: String, required: true },
  descricao:   { type: String, required: true },
  departamento: String,
  setor:       String,
  subsetor:    String,
  nivel:       { type: Number, default: 1 },
  parent:      { type: mongoose.Schema.Types.ObjectId, ref: 'CentroCusto' },
  responsavel: String,
  orcamento:   { type: Number, default: 0 },
  ratios:      [ratioSchema], // rateio entre centros
  ativo:       { type: Boolean, default: true },
  notas:       String,
}, { timestamps: true });

schema.set('toJSON', { transform(_, ret) { delete ret.__v; return ret; } });
module.exports = mongoose.model('CentroCusto', schema);
