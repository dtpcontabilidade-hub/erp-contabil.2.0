// server/controllers/authController.js — com bloqueio anti-bruteforce
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User   = require('../models/User');

const sign = id => jwt.sign(
  { id },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES || '7d' }
);

// Validação básica de input
function validarLogin(email, password) {
  if (!email || !password) return 'Preencha e-mail e senha';
  if (typeof email !== 'string' || typeof password !== 'string') return 'Dados inválidos';
  if (email.length > 100 || password.length > 100) return 'Dados muito longos';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido';
  return null;
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const erroValid = validarLogin(email, password);
    if (erroValid) return res.status(400).json({ success: false, message: erroValid });

    const emailLower = email.toLowerCase().trim();
    const user = await User.findOne({ email: emailLower })
      .select('+password +loginAttempts +lockUntil')
      .populate('company', 'legalName tradeName cnpj taxRegime fee dueDay status paymentMethod');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }

    // Verifica bloqueio
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutos = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(401).json({
        success: false,
        message: `Conta bloqueada. Tente novamente em ${minutos} minuto(s).`,
      });
    }

    if (user.active === false) {
      return res.status(401).json({ success: false, message: 'Usuário inativo' });
    }

    const ok = await user.matchPassword(password);
    if (!ok) {
      // Incrementa tentativas
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.loginAttempts = 0;
        await user.save({ validateBeforeSave: false });
        return res.status(401).json({
          success: false,
          message: 'Muitas tentativas. Conta bloqueada por 15 minutos.',
        });
      }
      await user.save({ validateBeforeSave: false });
      return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }

    // Sucesso — reseta contadores
    user.loginAttempts = 0;
    user.lockUntil     = undefined;
    user.lastLogin     = new Date();
    await user.save({ validateBeforeSave: false });

    const userData = user.toObject();
    delete userData.password;
    delete userData.loginAttempts;
    delete userData.lockUntil;

    const redirectTo = userData.role === 'cliente' ? '/cliente/dashboard.html' : '/welcome.html';

    res.json({
      success: true,
      token: sign(user._id),
      user: userData,
      redirectTo,
    });
  } catch (e) {
    console.error('[LOGIN]', e.message);
    res.status(500).json({ success: false, message: 'Erro ao fazer login' });
  }
};

exports.me = async (req, res) => {
  res.json({ success: true, user: req.user });
};

exports.changePassword = async (req, res) => {
  try {
    const { current, currentPassword, newPassword } = req.body;
    const senhaAtual = current || currentPassword;
    if (!senhaAtual || !newPassword) {
      return res.status(400).json({ success: false, message: 'Preencha todos os campos' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Nova senha deve ter ao menos 8 caracteres' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(senhaAtual))) {
      return res.status(400).json({ success: false, message: 'Senha atual incorreta' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
