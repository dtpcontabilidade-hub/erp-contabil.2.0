// server/models/Payroll.js — versão completa com dados pessoais do funcionário
const mongoose = require('mongoose');

const dependenteSchema = new mongoose.Schema({
  nome: String, parentesco: String, cpf: String, nascimento: Date,
}, { _id: true });

const empSchema = new mongoose.Schema({
  // Identificação pessoal
  name:        { type: String, required: true },
  cpf:         String,
  rg:          String,
  nascimento:  Date,
  sexo:        { type: String, enum: ['M','F','O',''] },
  estadoCivil: String,
  escolaridade:String,
  naturalidade:String,
  nacionalidade:{ type: String, default: 'Brasileiro(a)' },
  pis:         String,
  ctps:        String,
  ctpsSerie:   String,
  email:       String,
  telefone:    String,
  endereco:    String,
  // Contrato
  role:           String,
  depto:          String,
  cbo:            String,
  tipoContrato:   { type: String, default: 'CLT - Prazo Indeterminado' },
  jornada:        { type: String, default: '44h semanais' },
  turno:          String,
  nivel:          String,
  sindicato:      String,
  dataAdmissao:   Date,
  dataDemissao:   Date,
  motivoDemissao: String,
  status:         { type: String, enum: ['ativo','ferias','afastado','demitido'], default: 'ativo' },
  obs:            String,
  // Remuneração
  salaryBase:         { type: Number, default: 0 },
  extraHours:         { type: Number, default: 0 },
  bonuses:            { type: Number, default: 0 },
  commission:         { type: Number, default: 0 },
  mealAllowance:      { type: Number, default: 0 },
  transportAllowance: { type: Number, default: 0 },
  otherProvents:      { type: Number, default: 0 },
  insalubridade:      { type: Number, default: 0 },
  salarioFamilia:     { type: Number, default: 0 },
  healthPlan:         { type: Number, default: 0 },
  advance:            { type: Number, default: 0 },
  otherDiscount:      { type: Number, default: 0 },
  formaPgto:          String,
  // Bancário
  banco:     String, agencia: String, conta: String,
  tipoConta: String, pix: String, titular: String,
  // Dependentes
  dependentes:         { type: Number, default: 0 },
  filhos:              { type: Number, default: 0 },
  dependentesDetalhes: [dependenteSchema],
  // Calculados pelo servidor
  grossSalary: Number, netSalary: Number,
  inssEmployee: Number, irrf: Number,
  fgts: Number, fgtsEmployer: Number,
  inssEmployer: Number, totalCost: Number,
  notes: String,
}, { _id: true });

const schema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  competence:  { type: String, required: true },
  status:      { type: String, enum: ['rascunho','processando','fechada','paga'], default: 'rascunho' },
  paymentDate: Date,
  closeDate:   Date,
  notes:       String,
  employees:   [empSchema],
  // Totais calculados
  totalGross:        Number,
  totalNet:          Number,
  totalINSSEmployee: Number,
  totalIRRF:         Number,
  totalINSSEmployer: Number,
  totalFGTS:         Number,
  totalCost:         Number,
  headcount:         Number,
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.index({ company: 1, competence: 1 }, { unique: true });
schema.set('toJSON', { transform(_, ret) { delete ret.__v; return ret; } });
module.exports = mongoose.model('Payroll', schema);
