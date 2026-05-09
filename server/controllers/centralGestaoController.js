// server/controllers/centralGestaoController.js
// Gerencia permissões de TODOS os usuários (ERP + Portal)
const User    = require('../models/User');
const Company = require('../models/Company');

// ── LISTAR EMPRESAS COM USUÁRIOS ─────────────────────────────
exports.listarEmpresas = async (req, res) => {
  try {
    const empresas = await Company.find().lean();
    const usuarios = await User.find({ role:'cliente' })
      .select('-password')
      .populate('company', 'tradeName legalName cnpj')
      .lean();

    const usuariosPorEmpresa = {};
    usuarios.forEach(u => {
      const cid = u.company?._id?.toString() || u.company?.toString();
      if (!cid) return;
      if (!usuariosPorEmpresa[cid]) usuariosPorEmpresa[cid] = [];
      usuariosPorEmpresa[cid].push(u);
    });

    const dados = empresas.map(e => ({
      company: e,
      usuarios: usuariosPorEmpresa[e._id.toString()] || [],
      totalUsuarios: (usuariosPorEmpresa[e._id.toString()] || []).length,
      ativos: (usuariosPorEmpresa[e._id.toString()] || []).filter(u => u.active).length,
    }));

    res.json({ success: true, empresas: dados });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── LISTAR USUÁRIOS DO ESCRITÓRIO (ERP) ──────────────────────
exports.listarUsuariosERP = async (req, res) => {
  try {
    const usuarios = await User.find({ role: { $in: ['admin','contador','auxiliar'] } })
      .select('-password')
      .sort({ name: 1 });
    res.json({ success: true, usuarios });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── DETALHE DE UMA EMPRESA + USUÁRIOS ─────────────────────────
exports.getEmpresa = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Empresa não encontrada' });
    const usuarios = await User.find({ role:'cliente', company: req.params.id })
      .select('-password').sort({ createdAt: -1 });
    res.json({ success: true, company, usuarios });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── CRIAR / EDITAR QUALQUER USUÁRIO ───────────────────────────
exports.gerenciarUsuario = async (req, res) => {
  try {
    const { _id, name, email, password, cargo, cpf, telefone, role, company, acessos, clienteConfig, active, mensagemBemVindo } = req.body;

    if (_id) {
      const user = await User.findById(_id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });

      if (name) user.name = name;
      if (email) user.email = email.toLowerCase().trim();
      if (cargo !== undefined) user.cargo = cargo;
      if (cpf !== undefined) user.cpf = cpf;
      if (telefone !== undefined) user.telefone = telefone;
      if (role) user.role = role;
      if (active !== undefined) user.active = active;
      if (mensagemBemVindo !== undefined) user.mensagemBemVindo = mensagemBemVindo;
      if (password && password.length >= 6) user.password = password;

      // Salvar permissões no campo 'acessos' (novo) E no 'clienteConfig' (compatibilidade)
      if (acessos) {
        user.acessos = { ...user.acessos?.toObject?.() || {}, ...acessos };
      }
      if (clienteConfig) {
        user.clienteConfig = { ...user.clienteConfig?.toObject?.() || {}, ...clienteConfig };
      }

      // Sincronizar: se veio acessos, copiar para clienteConfig também
      if (acessos && !clienteConfig) {
        user.clienteConfig = {
          ...(user.clienteConfig?.toObject?.() || {}),
          modulosVisiveis: acessos.modulosVisiveis || user.clienteConfig?.modulosVisiveis,
          podeEditar: acessos.podeEditar || user.clienteConfig?.podeEditar,
          permissoes: acessos.especiais || user.clienteConfig?.permissoes,
        };
      }

      await user.save();
      const u = user.toObject(); delete u.password;
      return res.json({ success: true, message: 'Usuário atualizado', user: u });
    }

    // Criar novo
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nome, email e senha obrigatórios' });
    }

    const existe = await User.findOne({ email: email.toLowerCase().trim() });
    if (existe) return res.status(400).json({ success: false, message: 'E-mail já cadastrado' });

    const novoUser = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password,
      role: role || (company ? 'cliente' : 'auxiliar'),
      cargo,
      cpf,
      telefone,
      company: company || null,
      acessos: acessos || {},
      clienteConfig: clienteConfig || {},
      mensagemBemVindo: mensagemBemVindo || '',
      active: true,
    });

    const u = novoUser.toObject(); delete u.password;
    res.status(201).json({ success: true, message: 'Usuário criado', user: u });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── REMOVER USUÁRIO ───────────────────────────────────────────
exports.removerUsuario = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Não encontrado' });
    if (user.isSuperAdmin || user.email === 'daniel@dtpcontabil.com.br') {
      return res.status(403).json({ success: false, message: 'Não é possível remover o super admin' });
    }
    await user.deleteOne();
    res.json({ success: true, message: 'Usuário removido' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── RESETAR SENHA ─────────────────────────────────────────────
exports.resetarSenha = async (req, res) => {
  try {
    const { novaSenha } = req.body;
    if (!novaSenha || novaSenha.length < 6) {
      return res.status(400).json({ success: false, message: 'Senha deve ter ao menos 6 caracteres' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Não encontrado' });
    user.password = novaSenha;
    await user.save();
    res.json({ success: true, message: 'Senha resetada com sucesso' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── SALVAR CONFIG ─────────────────────────────────────────────
exports.salvarConfig = async (req, res) => {
  try {
    res.json({ success: true, message: 'Configurações salvas' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── MINHAS PERMISSÕES (ERP ou Portal) ─────────────────────────
exports.minhasPermissoes = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('company');

    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });

    // Super admin = tudo liberado
    if (user.isSuperAdmin || user.email === 'daniel@dtpcontabil.com.br') {
      return res.json({
        success: true,
        user,
        permissoes: 'admin',
        modulosVisiveis: 'todos',
        podeEditar: 'todos',
        especiais: {verValoresFinanceiros:true,baixarRelatorios:true,enviarMensagens:true,verHolerites:true,aprovarLancamentos:true,gerenciarUsuarios:true},
      });
    }

    // Retorna permissões do campo 'acessos' (novo) ou do 'clienteConfig' (legado)
    const acessos = user.acessos || {};
    const clienteCfg = user.clienteConfig || {};

    res.json({
      success: true,
      user,
      modulosVisiveis: acessos.modulosVisiveis || clienteCfg.modulosVisiveis || {},
      podeEditar:      acessos.podeEditar      || clienteCfg.podeEditar      || {},
      permissoes:      acessos.especiais        || clienteCfg.permissoes      || {},
      especiais:       acessos.especiais        || {},
      mensagemBemVindo: user.mensagemBemVindo || clienteCfg.mensagemBemVindo || '',
    });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── PRESETS ──────────────────────────────────────────────────
exports.presets = (req, res) => {
  const allTrue = {dashboard:true,empresas:true,lancamentos:true,obrigacoes:true,honorarios:true,folha:true,bpo:true,controladoria:true,fpa:true,auditoria:true,consultorias:true,escrituracao:true,obrigacoesFederais:true,demonstrativos:true,planoContas:true,centralGestao:true,mensagens:true,documentos:true};
  const allFalse = Object.fromEntries(Object.keys(allTrue).map(k=>[k,false]));

  res.json({
    success: true,
    presets: {
      superAdmin: {
        nome: 'Super Admin',
        descricao: 'Acesso total — vê e edita tudo',
        modulosVisiveis: {...allTrue},
        podeEditar: {...allTrue},
        especiais: {verValoresFinanceiros:true,baixarRelatorios:true,enviarMensagens:true,verHolerites:true,aprovarLancamentos:true,gerenciarUsuarios:true},
      },
      contador: {
        nome: 'Contador',
        descricao: 'Acesso operacional completo, sem Central de Gestão',
        modulosVisiveis: {...allTrue, centralGestao:false},
        podeEditar: {...allTrue, centralGestao:false},
        especiais: {verValoresFinanceiros:true,baixarRelatorios:true,enviarMensagens:true,verHolerites:true,aprovarLancamentos:true,gerenciarUsuarios:false},
      },
      auxiliar: {
        nome: 'Auxiliar Contábil',
        descricao: 'Operacional — sem gestão/controladoria',
        modulosVisiveis: {dashboard:true,empresas:true,lancamentos:true,obrigacoes:true,honorarios:false,folha:true,bpo:false,controladoria:false,fpa:false,auditoria:false,consultorias:false,escrituracao:true,obrigacoesFederais:true,demonstrativos:true,planoContas:true,centralGestao:false,mensagens:true,documentos:true},
        podeEditar: {dashboard:false,empresas:false,lancamentos:true,obrigacoes:true,honorarios:false,folha:true,bpo:false,controladoria:false,fpa:false,auditoria:false,consultorias:false,escrituracao:true,obrigacoesFederais:true,demonstrativos:false,planoContas:false,centralGestao:false,mensagens:true,documentos:true},
        especiais: {verValoresFinanceiros:false,baixarRelatorios:true,enviarMensagens:true,verHolerites:false,aprovarLancamentos:false,gerenciarUsuarios:false},
      },
      proprietario: {
        nome: 'Proprietário (Cliente)',
        descricao: 'Dono da empresa — vê e edita tudo no portal',
        modulosVisiveis: {dashboard:true,obrigacoes:true,honorarios:true,folha:true,bpo:true,demonstrativos:true,documentos:true,mensagens:true,auditoria:true,consultorias:true,escrituracao:true,fpa:true,controladoria:true},
        podeEditar: {bpo:true,obrigacoes:true,folha:true,documentos:true},
        especiais: {verValoresFinanceiros:true,baixarRelatorios:true,enviarMensagens:true,verHolerites:true,aprovarLancamentos:true,gerenciarUsuarios:false},
      },
      financeiro: {
        nome: 'Financeiro (Cliente)',
        descricao: 'BPO + Honorários — financeiro da empresa',
        modulosVisiveis: {dashboard:true,obrigacoes:true,honorarios:true,bpo:true,documentos:true,mensagens:true},
        podeEditar: {bpo:true,documentos:false},
        especiais: {verValoresFinanceiros:true,baixarRelatorios:true,enviarMensagens:true,verHolerites:false,aprovarLancamentos:false,gerenciarUsuarios:false},
      },
      assistente: {
        nome: 'Assistente (Cliente)',
        descricao: 'Operacional — só obrigações e documentos',
        modulosVisiveis: {dashboard:true,obrigacoes:true,documentos:true,mensagens:true},
        podeEditar: {...allFalse},
        especiais: {verValoresFinanceiros:false,baixarRelatorios:true,enviarMensagens:true,verHolerites:false,aprovarLancamentos:false,gerenciarUsuarios:false},
      },
      somenteLeitura: {
        nome: 'Somente Leitura',
        descricao: 'Visualiza tudo, não edita nada',
        modulosVisiveis: {...allTrue, centralGestao:false},
        podeEditar: {...allFalse},
        especiais: {verValoresFinanceiros:true,baixarRelatorios:true,enviarMensagens:false,verHolerites:false,aprovarLancamentos:false,gerenciarUsuarios:false},
      },
    },
  });
};
