const Auditoria = require('../models/Auditoria');

const CHECKLISTS = {
  fiscal: ['Verificar apuração de impostos','Conferir SPED Fiscal','Analisar créditos tributários','Verificar obrigações acessórias','Conferir DAS/PGDAS','Analisar notas fiscais emitidas','Verificar retenções na fonte','Conferir prazo de entrega das obrigações'],
  contabil: ['Verificar balancete mensal','Conferir lançamentos contábeis','Analisar contas a reconciliar','Verificar provisões','Conferir depreciações','Analisar resultado do período','Verificar conciliação bancária','Conferir plano de contas'],
  trabalhista: ['Verificar folha de pagamento','Conferir recolhimento FGTS','Analisar GPS/INSS','Verificar eSocial','Conferir férias e 13º','Analisar admissões e demissões','Verificar CAGED','Conferir horas extras'],
  societaria: ['Verificar contrato social','Conferir registro na Junta Comercial','Analisar composição societária','Verificar licenças e alvarás','Conferir certidões negativas','Analisar atas de reunião','Verificar registro de marca','Conferir CNPJ ativo'],
  interna: ['Verificar processos internos','Analisar fluxo de trabalho','Conferir prazos de entrega','Verificar satisfação dos clientes','Analisar produtividade','Conferir segurança de dados','Verificar backups','Analisar custos operacionais'],
};

exports.list = async (req, res) => {
  try {
    const { company, tipo, status, page=1, limit=20 } = req.query;
    const f = {};
    if (company === 'dtp') f.company = null;
    else if (company) f.company = company;
    if (tipo)   f.tipo   = tipo;
    if (status) f.status = status;
    const total = await Auditoria.countDocuments(f);
    const items = await Auditoria.find(f)
      .populate('company','legalName tradeName')
      .sort({ createdAt: -1 })
      .skip((+page-1)*+limit).limit(+limit)
      .select('-itens');
    res.json({ success:true, items, pagination:{total,page:+page,totalPages:Math.ceil(total/+limit)} });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.stats = async (req, res) => {
  try {
    const all = await Auditoria.find({}).select('status tipo riscoPonderado itens');
    const conformidade = all.reduce((acc, a) => {
      const total = a.itens.length;
      const conf  = a.itens.filter(i=>i.status==='conforme').length;
      return { total: acc.total + total, conf: acc.conf + conf };
    }, { total: 0, conf: 0 });
    res.json({ success:true, stats: {
      total: all.length,
      planejadas:    all.filter(a=>a.status==='planejada').length,
      em_andamento:  all.filter(a=>a.status==='em_andamento').length,
      concluidas:    all.filter(a=>a.status==='concluida').length,
      alto_risco:    all.filter(a=>a.riscoPonderado==='alto').length,
      conformidade:  conformidade.total > 0 ? Math.round(conformidade.conf/conformidade.total*100) : 0,
    }});
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.get = async (req, res) => {
  try {
    const item = await Auditoria.findById(req.params.id).populate('company','legalName tradeName cnpj');
    if (!item) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { tipo, gerarChecklist, ...rest } = req.body;
    let itens = rest.itens || [];
    if (gerarChecklist && CHECKLISTS[tipo]) {
      itens = CHECKLISTS[tipo].map(d => ({ descricao: d, status: 'pendente', risco: 'medio' }));
    }
    const item = await Auditoria.create({ tipo, ...rest, itens, createdBy: req.user._id });
    res.status(201).json({ success:true, message:'Auditoria criada', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.update = async (req, res) => {
  try {
    const item = await Auditoria.findByIdAndUpdate(req.params.id, req.body, { new:true });
    if (!item) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, message:'Atualizada', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await Auditoria.findByIdAndUpdate(req.params.id, { status:'cancelada' });
    res.json({ success:true, message:'Cancelada' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.checklists = (req, res) => res.json({ success:true, checklists: CHECKLISTS });
