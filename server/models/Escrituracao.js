const mongoose = require('mongoose');

// Escrituração Fiscal — registro de notas e apuração
const itemFiscalSchema = new mongoose.Schema({
  tipo:        { type: String, enum: ['entrada','saida'], required: true },
  numero:      String,
  serie:       String,
  dataEmissao: Date,
  dataEntrada: Date,
  fornecedor:  String,
  cnpjFornec:  String,
  cfop:        String,
  cst:         String,
  baseCalculo: { type: Number, default: 0 },
  aliquota:    { type: Number, default: 0 },
  valorImposto:{ type: Number, default: 0 },
  valorTotal:  { type: Number, default: 0 },
  icms:        { type: Number, default: 0 },
  pis:         { type: Number, default: 0 },
  cofins:      { type: Number, default: 0 },
  ipi:         { type: Number, default: 0 },
  iss:         { type: Number, default: 0 },
  descricao:   String,
}, { _id: true });

const apuracaoSchema = new mongoose.Schema({
  imposto:     String,
  debitos:     { type: Number, default: 0 },
  creditos:    { type: Number, default: 0 },
  saldo:       { type: Number, default: 0 },
  valorRecolher:{ type: Number, default: 0 },
  vencimento:  Date,
}, { _id: true });

const schema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  competence:  { type: String, required: true },
  tipo:        { type: String, enum: ['contabil','fiscal'], required: true },
  status:      { type: String, enum: ['aberta','fechada','retificada'], default: 'aberta' },
  // Escrituração Contábil
  livro:       { type: String, enum: ['diario','razao','balancete','balanco','dre'] },
  // Escrituração Fiscal
  itens:       [itemFiscalSchema],
  apuracoes:   [apuracaoSchema],
  // Totais
  totalEntradas: { type: Number, default: 0 },
  totalSaidas:   { type: Number, default: 0 },
  totalImpostos: { type: Number, default: 0 },
  notas:       String,
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.index({ company: 1, competence: 1, tipo: 1 });
schema.set('toJSON', { transform(_, ret) { delete ret.__v; return ret; } });
module.exports = mongoose.model('Escrituracao', schema);
