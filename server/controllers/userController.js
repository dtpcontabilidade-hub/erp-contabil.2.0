// server/controllers/userController.js
const User   = require('../models/User');
const bcrypt = require('bcryptjs');

exports.list = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('company', 'legalName tradeName')
      .sort({ name: 1 });
    res.json({ success: true, users });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.get = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('company', 'legalName tradeName');
    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    res.json({ success: true, user });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { name, email, password, role, company, active } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Nome, email e senha são obrigatórios' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Senha deve ter pelo menos 6 caracteres' });

    const existe = await User.findOne({ email: email.toLowerCase().trim() });
    if (existe) return res.status(400).json({ success: false, message: 'E-mail já cadastrado' });

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role || 'contador',
      company: company || undefined,
      active: active !== false,
    });

    const u = user.toJSON(); delete u.password;
    res.status(201).json({ success: true, message: 'Usuário criado com sucesso', user: u });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const { name, email, password, role, company, active } = req.body;
    const upd = {};
    if (name)    upd.name   = name.trim();
    if (email)   upd.email  = email.toLowerCase().trim();
    if (role)    upd.role   = role;
    if (company !== undefined) upd.company = company || null;
    if (active  !== undefined) upd.active  = active;

    // Se enviou nova senha, hasheia
    if (password) {
      if (password.length < 6)
        return res.status(400).json({ success: false, message: 'Senha deve ter pelo menos 6 caracteres' });
      upd.password = await bcrypt.hash(password, 12);
    }

    const user = await User.findByIdAndUpdate(req.params.id, upd, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    res.json({ success: true, message: 'Usuário atualizado', user });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    // Não deixa remover o próprio usuário logado
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'Não é possível remover seu próprio usuário' });
    await User.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true, message: 'Usuário desativado' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};
