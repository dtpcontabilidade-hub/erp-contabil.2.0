const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  cpf:   String, share: Number, role: String, email: String,
}, { _id: true });

const addressSchema = new mongoose.Schema({
  cep: String, street: String, number: String, complement: String,
  neighborhood: String, city: String, state: String, country: { type: String, default: 'Brasil' },
}, { _id: false });

const schema = new mongoose.Schema({
  // Identificação
  legalName:   { type: String, required: true, trim: true },
  tradeName:   { type: String, trim: true },
  cnpj:        { type: String, required: true, trim: true },
  stateReg:    String, cityReg: String,
  cnae:        String, cnaesSecondary: String,
  legalNature: String,
  taxRegime:   { type: String, enum: ['simples','presumido','real','mei','imune'], default: 'simples' },
  companySize: { type: String, enum: ['mei','me','epp','medio','grande'], default: 'me' },
  sector:      String, foundedAt: Date,
  employees:   { type: Number, default: 0 },
  annualRevenue: { type: Number, default: 0 },
  businessObject: String,
  // Endereço
  address: addressSchema,
  // Contato
  contactName: String, contactCpf: String, contactRole: String,
  contactEmail: String, contactPhone: String, contactMobile: String,
  website: String, instagram: String,
  financeContact: String, financeEmail: String, financePhone: String,
  // Banco
  bankName: String, bankAgency: String, bankAccount: String,
  pixKey: String, bankName2: String, bankAccount2: String,
  // Contrato
  fee:           { type: Number, default: 0 },
  dueDay:        { type: Number, default: 10 },
  paymentMethod: { type: String, default: 'PIX' },
  lateFee:       { type: Number, default: 2 },
  interestRate:  { type: Number, default: 1 },
  contractStart: Date,
  contractTerm:  { type: String, default: 'Indeterminado' },
  contractAdjust:{ type: String, default: 'IGPM' },
  internalResponsible: String,
  status:        { type: String, enum: ['pago','pendente','atrasado','inativo'], default: 'pendente' },
  contractNotes: String, notes: String,
  services:      [String],
  partners:      [partnerSchema],
}, { timestamps: true });

schema.set('toJSON', { transform(_, ret) { delete ret.__v; return ret; } });
module.exports = mongoose.model('Company', schema);
