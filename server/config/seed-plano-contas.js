// server/config/seed-plano-contas.js
// Popula o Plano de Contas NBC no banco
// Comando: node server/config/seed-plano-contas.js

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado ao MongoDB');

  const PlanoConta = require('../models/PlanoConta');
  const { PLANO_NBC } = require('../controllers/planoContaController');

  const exists = await PlanoConta.countDocuments({ padrao_nbc: true });
  if (exists > 0) {
    console.log(`ℹ️  Plano NBC já existe com ${exists} contas. Nada a fazer.`);
    process.exit(0);
  }

  await PlanoConta.insertMany(PLANO_NBC.map(p => ({ ...p, company: null })));
  console.log(`✅ Plano de Contas NBC inserido com ${PLANO_NBC.length} contas!`);
  process.exit(0);
}

seed().catch(e => { console.error('❌ Erro:', e.message); process.exit(1); });
