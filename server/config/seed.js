require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado ao MongoDB');

  const User = require('../models/User');
  const exists = await User.findOne({ email: 'daniel@dtpcontabil.com.br' });
  if (exists) { console.log('ℹ️  Admin já existe.'); process.exit(0); }

  await User.create({
    name:     'Daniel Teotonio Pinto',
    email:    'daniel@dtpcontabil.com.br',
    password: await bcrypt.hash('dtp@2025', 12),
    role:     'admin',
    crc:      'CRC-SC 12345',
  });

  console.log('\n🎉 Admin criado!\n   Email : daniel@dtpcontabil.com.br\n   Senha : dtp@2025\n');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });

// Seed cliente de exemplo (só se não existir)
async function seedCliente() {
  const User    = require('../models/User');
  const Company = require('../models/Company');
  const exists = await User.findOne({ role: 'cliente' });
  if (exists) { console.log('ℹ️  Usuário cliente já existe.'); return; }
  const company = await Company.findOne({});
  if (!company) { console.log('⚠️  Nenhuma empresa para vincular ao cliente.'); return; }
  await User.create({
    name: company.legalName || 'Cliente DTP',
    email: 'cliente@dtpcontabil.com.br',
    password: 'cliente@2025',
    role: 'cliente',
    company: company._id,
  });
  console.log('✅ Usuário cliente criado: cliente@dtpcontabil.com.br / cliente@2025');
}
seedCliente().catch(console.error);
