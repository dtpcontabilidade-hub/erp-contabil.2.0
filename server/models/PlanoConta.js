const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }, // null = padrão NBC
  codigo:      { type: String, required: true },
  descricao:   { type: String, required: true },
  tipo:        { type: String, enum: ['ativo','passivo','patrimonio','receita','despesa','custo','resultado'], required: true },
  natureza:    { type: String, enum: ['devedora','credora'], required: true },
  nivel:       { type: Number, default: 1 }, // 1=grupo, 2=subgrupo, 3=conta, 4=subconta
  parent:      { type: mongoose.Schema.Types.ObjectId, ref: 'PlanoConta' },
  aceita_lancamento: { type: Boolean, default: true },
  ativo:       { type: Boolean, default: true },
  padrao_nbc:  { type: Boolean, default: false },
  notas:       String,
}, { timestamps: true });

schema.index({ company: 1, codigo: 1 }, { unique: false });
schema.set('toJSON', { transform(_, ret) { delete ret.__v; return ret; } });
module.exports = mongoose.model('PlanoConta', schema);
