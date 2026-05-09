// server/controllers/spedTransmissaoController.js
// Gerencia o ciclo completo de transmissão SPED
const SPEDTransmissao = require('../models/SPEDTransmissao');
const Company         = require('../models/Company');
const validator       = require('../services/spedValidator');

// ── LISTAR HISTÓRICO ──────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { company, tipo, status, page = 1, limit = 50 } = req.query;
    const f = {};
    if (company) f.company = company;
    if (tipo)    f.tipo    = tipo;
    if (status)  f.status  = status;

    const total = await SPEDTransmissao.countDocuments(f);
    const items = await SPEDTransmissao.find(f)
      .populate('company', 'legalName tradeName cnpj')
      .populate('createdBy', 'name email')
      .populate('transmissao.transmitidoPor', 'name email')
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({ success: true, items, total, page: +page });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── DETALHES ──────────────────────────────────────────────────
exports.get = async (req, res) => {
  try {
    const item = await SPEDTransmissao.findById(req.params.id)
      .populate('company', 'legalName tradeName cnpj taxRegime')
      .populate('createdBy', 'name email')
      .populate('transmissao.transmitidoPor', 'name email');
    if (!item) return res.status(404).json({ success: false, message: 'Não encontrado' });
    res.json({ success: true, item });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── REGISTRAR GERAÇÃO + VALIDAÇÃO ─────────────────────────────
exports.registrarGeracao = async (req, res) => {
  try {
    const { company, tipo, competence, exercicio, conteudo, nomeArquivo } = req.body;

    if (!company || !tipo) {
      return res.status(400).json({ success: false, message: 'Empresa e tipo SPED obrigatórios' });
    }

    const empresa = await Company.findById(company);
    if (!empresa) return res.status(404).json({ success: false, message: 'Empresa não encontrada' });

    // Valida o conteúdo SPED
    const resultadoValidacao = conteudo
      ? validator.validar(tipo, conteudo, empresa.toObject())
      : { valido: false, erros: [{ mensagem: 'Conteúdo não fornecido' }], avisos: [] };

    const transmissao = await SPEDTransmissao.create({
      company,
      tipo,
      competence,
      exercicio,
      status: resultadoValidacao.valido ? 'validado' : 'gerado',
      validacao: {
        valido: resultadoValidacao.valido,
        erros:  resultadoValidacao.erros,
        avisos: resultadoValidacao.avisos,
        totalRegistros: resultadoValidacao.totalRegistros || 0,
        dataValidacao: new Date(),
      },
      arquivo: {
        nome:        nomeArquivo || `${tipo}_${empresa.cnpj}_${competence || exercicio}.txt`,
        tamanho:     conteudo ? Buffer.byteLength(conteudo, 'utf8') : 0,
        hash:        conteudo ? validator.calcularHash(conteudo) : null,
        dataGeracao: new Date(),
      },
      createdBy: req.user._id,
    });

    res.json({ success: true, transmissao, validacao: resultadoValidacao });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── MARCAR COMO TRANSMITIDO ───────────────────────────────────
exports.marcarTransmitido = async (req, res) => {
  try {
    const { protocolo, dataTransmissao, observacoes } = req.body;
    if (!protocolo) {
      return res.status(400).json({ success: false, message: 'Protocolo de transmissão obrigatório' });
    }

    const transmissao = await SPEDTransmissao.findById(req.params.id);
    if (!transmissao) return res.status(404).json({ success: false, message: 'Não encontrado' });

    transmissao.status = 'transmitido';
    transmissao.transmissao = {
      dataTransmissao:    dataTransmissao || new Date(),
      protocolo,
      transmitidoPor:     req.user._id,
      transmitidoPorNome: req.user.name,
      observacoes,
    };

    await transmissao.save();
    res.json({ success: true, message: 'Transmissão registrada com sucesso', transmissao });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── MARCAR COMO ACEITO/REJEITADO PELA RECEITA ─────────────────
exports.marcarStatus = async (req, res) => {
  try {
    const { status, observacoes } = req.body;
    if (!['aceito','rejeitado','retificado'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status inválido' });
    }
    const t = await SPEDTransmissao.findById(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: 'Não encontrado' });
    t.status = status;
    if (observacoes) {
      t.transmissao.observacoes = (t.transmissao.observacoes || '') + '\n' + observacoes;
    }
    await t.save();
    res.json({ success: true, transmissao: t });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── ESTATÍSTICAS ──────────────────────────────────────────────
exports.stats = async (req, res) => {
  try {
    const { company, ano } = req.query;
    const f = {};
    if (company) f.company = company;
    if (ano) {
      f.$or = [
        { competence: { $regex: `^${ano}` } },
        { exercicio: ano },
      ];
    }

    const [total, porStatus, porTipo, ultimas] = await Promise.all([
      SPEDTransmissao.countDocuments(f),
      SPEDTransmissao.aggregate([
        { $match: f },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      SPEDTransmissao.aggregate([
        { $match: f },
        { $group: { _id: '$tipo', count: { $sum: 1 } } },
      ]),
      SPEDTransmissao.find(f)
        .populate('company', 'legalName tradeName')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    res.json({
      success: true,
      stats: {
        total,
        porStatus: Object.fromEntries(porStatus.map(p => [p._id, p.count])),
        porTipo:   Object.fromEntries(porTipo.map(p => [p._id, p.count])),
        ultimas,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── VALIDAR ARQUIVO (sem registrar) ───────────────────────────
exports.validarArquivo = async (req, res) => {
  try {
    const { tipo, conteudo, company } = req.body;
    if (!tipo || !conteudo) {
      return res.status(400).json({ success: false, message: 'Tipo e conteúdo obrigatórios' });
    }
    let dadosEmpresa = {};
    if (company) {
      const emp = await Company.findById(company);
      if (emp) dadosEmpresa = emp.toObject();
    }
    const resultado = validator.validar(tipo, conteudo, dadosEmpresa);
    res.json({ success: true, resultado });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
