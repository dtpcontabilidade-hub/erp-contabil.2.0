// server/config/seed-centros-custo.js
// Popula Centros de Custo padrão no banco
// Comando: node server/config/seed-centros-custo.js

require('dotenv').config();
const mongoose = require('mongoose');

const CENTROS_PADRAO = [
  // Administrativo
  { codigo: '1',     descricao: 'ADMINISTRATIVO',            departamento: 'Administração',  nivel: 1, ativo: true },
  { codigo: '1.1',   descricao: 'Diretoria',                 departamento: 'Administração',  nivel: 2, ativo: true },
  { codigo: '1.2',   descricao: 'RH — Recursos Humanos',     departamento: 'Administração',  nivel: 2, ativo: true },
  { codigo: '1.3',   descricao: 'TI — Tecnologia',           departamento: 'Administração',  nivel: 2, ativo: true },
  { codigo: '1.4',   descricao: 'Jurídico',                  departamento: 'Administração',  nivel: 2, ativo: true },
  { codigo: '1.5',   descricao: 'Contabilidade Interna',     departamento: 'Administração',  nivel: 2, ativo: true },
  // Comercial
  { codigo: '2',     descricao: 'COMERCIAL',                 departamento: 'Comercial',      nivel: 1, ativo: true },
  { codigo: '2.1',   descricao: 'Vendas',                    departamento: 'Comercial',      nivel: 2, ativo: true },
  { codigo: '2.2',   descricao: 'Marketing',                 departamento: 'Comercial',      nivel: 2, ativo: true },
  { codigo: '2.3',   descricao: 'Atendimento ao Cliente',    departamento: 'Comercial',      nivel: 2, ativo: true },
  // Operacional
  { codigo: '3',     descricao: 'OPERACIONAL',               departamento: 'Operações',      nivel: 1, ativo: true },
  { codigo: '3.1',   descricao: 'Produção',                  departamento: 'Operações',      nivel: 2, ativo: true },
  { codigo: '3.2',   descricao: 'Logística',                 departamento: 'Operações',      nivel: 2, ativo: true },
  { codigo: '3.3',   descricao: 'Compras',                   departamento: 'Operações',      nivel: 2, ativo: true },
  { codigo: '3.4',   descricao: 'Qualidade',                 departamento: 'Operações',      nivel: 2, ativo: true },
  // Financeiro
  { codigo: '4',     descricao: 'FINANCEIRO',                departamento: 'Financeiro',     nivel: 1, ativo: true },
  { codigo: '4.1',   descricao: 'Contas a Pagar',            departamento: 'Financeiro',     nivel: 2, ativo: true },
  { codigo: '4.2',   descricao: 'Contas a Receber',          departamento: 'Financeiro',     nivel: 2, ativo: true },
  { codigo: '4.3',   descricao: 'Tesouraria',                departamento: 'Financeiro',     nivel: 2, ativo: true },
  // Escritório Contábil (específico para DTP)
  { codigo: '5',     descricao: 'ESCRITÓRIO CONTÁBIL',       departamento: 'Contábil',       nivel: 1, ativo: true },
  { codigo: '5.1',   descricao: 'Departamento Contábil',     departamento: 'Contábil',       nivel: 2, ativo: true },
  { codigo: '5.2',   descricao: 'Departamento Fiscal',       departamento: 'Contábil',       nivel: 2, ativo: true },
  { codigo: '5.3',   descricao: 'Departamento Pessoal',      departamento: 'Contábil',       nivel: 2, ativo: true },
  { codigo: '5.4',   descricao: 'BPO Financeiro',            departamento: 'Contábil',       nivel: 2, ativo: true },
  { codigo: '5.5',   descricao: 'Consultoria Tributária',    departamento: 'Contábil',       nivel: 2, ativo: true },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado ao MongoDB');

  const CentroCusto = require('../models/CentroCusto');

  const exists = await CentroCusto.countDocuments({ company: null });
  if (exists > 0) {
    console.log(`ℹ️  Centros de Custo já existem (${exists}). Nada a fazer.`);
    process.exit(0);
  }

  await CentroCusto.insertMany(CENTROS_PADRAO.map(c => ({ ...c, company: null })));
  console.log(`✅ ${CENTROS_PADRAO.length} Centros de Custo inseridos!`);
  process.exit(0);
}

seed().catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });
