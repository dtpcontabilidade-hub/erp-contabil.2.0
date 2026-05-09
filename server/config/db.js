const mongoose = require('mongoose');

module.exports = async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Atlas conectado');
  } catch (err) {
    console.error('❌ Erro MongoDB:', err.message);
    process.exit(1);
  }
};
