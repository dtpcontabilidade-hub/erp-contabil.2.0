// server/controllers/escrituracaoController.js — versão completa com SPED básico
const Escrituracao = require('../models/Escrituracao');
const Transaction  = require('../models/Transaction');
const Company      = require('../models/Company');

exports.list = async (req, res) => {
  try {
    const { company, competence, tipo, status } = req.query;
    const f = {};
    if (company)    f.company    = company;
    if (competence) f.competence = competence;
    if (tipo)       f.tipo       = tipo;
    if (status)     f.status     = status;
    const items = await Escrituracao.find(f)
      .populate('company','legalName tradeName cnpj taxRegime')
      .sort({ competence:-1 });
    res.json({ success:true, items });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.get = async (req, res) => {
  try {
    const item = await Escrituracao.findById(req.params.id)
      .populate('company','legalName tradeName cnpj taxRegime address');
    if (!item) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const item = await Escrituracao.create({ ...req.body, createdBy:req.user._id });
    res.status(201).json({ success:true, message:'Escrituração criada', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.update = async (req, res) => {
  try {
    // Recalcula totais fiscais se itens mudaram
    const body = { ...req.body };
    if (body.itens) {
      body.totalEntradas = body.itens.filter(i=>i.tipo==='entrada').reduce((a,i)=>a+(i.valorTotal||0),0);
      body.totalSaidas   = body.itens.filter(i=>i.tipo==='saida').reduce((a,i)=>a+(i.valorTotal||0),0);
      body.totalImpostos = body.itens.reduce((a,i)=>a+(i.valorImposto||0),0);
    }
    const item = await Escrituracao.findByIdAndUpdate(req.params.id, body, { new:true });
    if (!item) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, message:'Atualizada', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

// Livro Diário — dos lançamentos contábeis
exports.livrodiario = async (req, res) => {
  try {
    const { company, competence } = req.query;
    if (!company || !competence)
      return res.status(400).json({ success:false, message:'Informe empresa e competência' });
    const lancamentos = await Transaction.find({ company, competence, status:{ $ne:'cancelado' } })
      .populate('company','legalName tradeName cnpj')
      .populate('centroCusto','codigo descricao')
      .sort({ date:1 });
    const total = lancamentos.reduce((a,l)=>a+l.amount,0);
    res.json({ success:true, livro:{ competence, total, lancamentos } });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

// Livro Razão — agrupa por conta
exports.livrorazao = async (req, res) => {
  try {
    const { company, competence, conta } = req.query;
    if (!company || !competence)
      return res.status(400).json({ success:false, message:'Informe empresa e competência' });
    const f = { company, competence, status:{ $ne:'cancelado' } };
    if (conta) f.$or = [{ debitAccount:new RegExp(conta,'i') }, { creditAccount:new RegExp(conta,'i') }];
    const lancamentos = await Transaction.find(f).sort({ date:1 });
    const contas = {};
    lancamentos.forEach(l => {
      [l.debitAccount,l.creditAccount].forEach((c,lado) => {
        if (!c) return;
        if (!contas[c]) contas[c] = { debitos:0, creditos:0, lancamentos:[] };
        if (lado===0) { contas[c].debitos  += l.amount; contas[c].lancamentos.push({...l.toObject(),lado:'D'}); }
        else          { contas[c].creditos += l.amount; contas[c].lancamentos.push({...l.toObject(),lado:'C'}); }
      });
    });
    const razao = Object.entries(contas)
      .map(([c,v])=>({ conta:c, ...v, saldo:v.debitos-v.creditos }))
      .sort((a,b)=>a.conta.localeCompare(b.conta));
    res.json({ success:true, razao });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

// Balancete de Verificação
exports.balancete = async (req, res) => {
  try {
    const { company, competence } = req.query;
    if (!company || !competence)
      return res.status(400).json({ success:false, message:'Informe empresa e competência' });
    const lancamentos = await Transaction.find({ company, competence, status:{ $ne:'cancelado' } });
    const contas = {};
    lancamentos.forEach(l => {
      if (!contas[l.debitAccount])  contas[l.debitAccount]  = { debitos:0, creditos:0 };
      if (!contas[l.creditAccount]) contas[l.creditAccount] = { debitos:0, creditos:0 };
      contas[l.debitAccount].debitos   += l.amount;
      contas[l.creditAccount].creditos += l.amount;
    });
    const balancete = Object.entries(contas)
      .map(([c,v])=>({ conta:c, debitos:v.debitos, creditos:v.creditos, saldo:v.debitos-v.creditos }))
      .sort((a,b)=>a.conta.localeCompare(b.conta));
    const totais = {
      debitos:  balancete.reduce((a,c)=>a+c.debitos,0),
      creditos: balancete.reduce((a,c)=>a+c.creditos,0),
    };
    res.json({ success:true, balancete, totais });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

// Apuração fiscal
exports.apuracao = async (req, res) => {
  try {
    const { company, competence } = req.query;
    if (!company || !competence)
      return res.status(400).json({ success:false, message:'Informe empresa e competência' });
    const escrit = await Escrituracao.findOne({ company, competence, tipo:'fiscal' })
      .populate('company','legalName tradeName cnpj taxRegime');
    if (!escrit) return res.json({ success:true, itens:[], apuracoes:[], totalEntradas:0, totalSaidas:0 });
    const totEnt = escrit.itens.filter(i=>i.tipo==='entrada').reduce((a,i)=>a+(i.valorTotal||0),0);
    const totSai = escrit.itens.filter(i=>i.tipo==='saida').reduce((a,i)=>a+(i.valorTotal||0),0);
    res.json({ success:true, apuracoes:escrit.apuracoes||[], itens:escrit.itens||[], totalEntradas:totEnt, totalSaidas:totSai, company:escrit.company });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

// ── GERAÇÃO SPED ECD (txt básico para Receita Federal) ────────
exports.gerarSPED = async (req, res) => {
  try {
    const { company: companyId, competence, tipo='ECD' } = req.query;
    if (!companyId || !competence)
      return res.status(400).json({ success:false, message:'Informe empresa e competência' });

    const [company, lancamentos] = await Promise.all([
      Company.findById(companyId),
      Transaction.find({ company:companyId, competence, status:{ $ne:'cancelado' } }).sort({ date:1 }),
    ]);
    if (!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const [ano,mes] = competence.split('-');
    const dtIni = `${ano}${mes}01`;
    const dtFim = `${ano}${mes}${new Date(ano,mes,0).getDate()}`.replace(/(\d{4})(\d{2})(\d{2})/,'$1$2$3');
    const now   = new Date().toISOString().replace(/[-T:.Z]/g,'').substring(0,14);
    const cnpj  = (company.cnpj||'').replace(/\D/g,'');

    // Bloco 0 — Abertura
    let sped = '';
    sped += `|0000|LECD|${dtIni}|${dtFim}|${cnpj}|${company.legalName}|${company.stateReg||'ISENTO'}|${company.cityReg||''}|N|${ano}|N||N|001|\n`;
    sped += `|0001|0|\n`;
    sped += `|0007|${cnpj}|\n`;
    sped += `|0035|${cnpj}|${company.taxRegime?.toUpperCase()||'SIMPLES'}|\n`;
    sped += `|0990|3|\n`;

    // Bloco I — Lançamentos
    sped += `|I001|0|\n`;
    let seqLanc = 1;
    lancamentos.forEach(l => {
      const dt = new Date(l.date).toISOString().substring(0,10).replace(/-/g,'');
      sped += `|I200|${String(seqLanc).padStart(6,'0')}|${dt}|${l.description}|${(l.amount).toFixed(2)}|${l.debitAccount||''}|${l.creditAccount||''}|0|\n`;
      seqLanc++;
    });
    sped += `|I990|${seqLanc+1}|\n`;

    // Bloco 9 — Encerramento
    const totalLinhas = sped.split('\n').filter(Boolean).length + 3;
    sped += `|9001|0|\n`;
    sped += `|9900|0000|1|\n`;
    sped += `|9990|3|\n`;
    sped += `|9999|${totalLinhas}|\n`;

    res.setHeader('Content-Type','text/plain;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="SPED_${tipo}_${cnpj}_${competence}.txt"`);
    res.send(sped);
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};
