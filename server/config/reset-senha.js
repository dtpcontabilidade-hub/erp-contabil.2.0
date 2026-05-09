// server/config/reset-senha.js
// Roda UMA VEZ para corrigir a senha do admin no banco
// Comando: node server/config/reset-senha.js

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

async function reset() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado ao MongoDB');

  // Busca o admin diretamente pela collection sem o model (evita qualquer hook problemático)
  const db   = mongoose.connection.db;
  const col  = db.collection('users');

  const hash = await bcrypt.hash('dtp@2025', 12);

  const result = await col.updateOne(
    { email: 'daniel@dtpcontabil.com.br' },
    { $set: { password: hash, active: true } }
  );

  if (result.modifiedCount > 0) {
    console.log('✅ Senha do admin resetada com sucesso!');
    console.log('   Email : daniel@dtpcontabil.com.br');
    console.log('   Senha : dtp@2025');
  } else {
    console.log('⚠️  Admin não encontrado no banco.');
  }

  process.exit(0);
}

reset().catch(e => { console.error(e); process.exit(1); });
