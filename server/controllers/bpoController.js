const BPO         = require('../models/BPO');
const autoPosting = require('../services/autoPostingService');

exports.list = async (req, res) => {
  try {
    const { company, competence, type, status, category, page=1, limit=50 } = req.query;
    const f = {};
    if (company)    f.company    = company;
    if (competence) f.competence = competence;
    if (type)       f.type       = type;
    if (status)     f.status     = status;
    if (category)   f.category   = category;
    else            f.status     = { $ne: 'cancelado' };
    const total = await BPO.countDocuments(f);
    const items = await BPO.find(f)
      .populate('company','legalName tradeName')
      .sort({ dueDate: 1 })
      .skip((+page-1)*+limit).limit(+limit);
    res.json({ success:true, items, pagination:{total,page:+page,totalPages:Math.ceil(total/+limit),limit:+limit} });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.summary = async (req, res) => {
  try {
    const { company, competence } = req.query;
    const f = { status: { $ne: 'cancelado' } };
    if (company)    f.company    = company;
    if (competence) f.competence = competence;
    const rows = await BPO.find(f).select('type amount status');
    const totalReceitas   = rows.filter(r=>r.type==='receita').reduce((a,r)=>a+r.amount,0);
    const totalDespesas   = rows.filter(r=>r.type==='despesa').reduce((a,r)=>a+r.amount,0);
    const recebido        = rows.filter(r=>r.type==='receita'&&r.status==='pago').reduce((a,r)=>a+r.amount,0);
    const pago            = rows.filter(r=>r.type==='despesa'&&r.status==='pago').reduce((a,r)=>a+r.amount,0);
    const aReceberTotal   = rows.filter(r=>r.type==='receita'&&r.status!=='pago').reduce((a,r)=>a+r.amount,0);
    const aPagarTotal     = rows.filter(r=>r.type==='despesa'&&r.status!=='pago').reduce((a,r)=>a+r.amount,0);
    const vencidos        = rows.filter(r=>r.status==='atrasado').length;
    res.json({ success:true, summary:{
      totalReceitas, totalDespesas, recebido, pago,
      aReceberTotal, aPagarTotal,
      saldo: totalReceitas - totalDespesas,
      saldoCaixa: recebido - pago,
      vencidos,
    }});
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.fluxo = async (req, res) => {
  try {
    const { company, year } = req.query;
    const yr = parseInt(year) || new Date().getFullYear();
    const f = { status: { $ne: 'cancelado' } };
    if (company) f.company = company;
    const rows = await BPO.find(f).select('type amount competence status');
    const months = {};
    for (let m=1; m<=12; m++) {
      const key = `${yr}-${String(m).padStart(2,'0')}`;
      months[key] = { competence:key, receitas:0, despesas:0, saldo:0 };
    }
    rows.forEach(r => {
      if (months[r.competence]) {
        if (r.type==='receita') months[r.competence].receitas += r.amount;
        else months[r.competence].despesas += r.amount;
      }
    });
    Object.values(months).forEach(m => m.saldo = m.receitas - m.despesas);
    res.json({ success:true, fluxo: Object.values(months) });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.dre = async (req, res) => {
  try {
    const { company, competence } = req.query;
    const f = { status: { $ne: 'cancelado' } };
    if (company)    f.company    = company;
    if (competence) f.competence = competence;
    const rows = await BPO.find(f).select('type amount category');
    const rec = {}, desp = {};
    rows.forEach(r => {
      const map = r.type==='receita' ? rec : desp;
      map[r.category] = (map[r.category]||0) + r.amount;
    });
    const totalRec  = Object.values(rec).reduce((a,v)=>a+v,0);
    const totalDesp = Object.values(desp).reduce((a,v)=>a+v,0);
    res.json({ success:true, dre:{
      receitas: Object.entries(rec).map(([k,v])=>({category:k,amount:v})).sort((a,b)=>b.amount-a.amount),
      despesas: Object.entries(desp).map(([k,v])=>({category:k,amount:v})).sort((a,b)=>b.amount-a.amount),
      totalReceitas: totalRec,
      totalDespesas: totalDesp,
      lucroLiquido: totalRec - totalDesp,
      margem: totalRec > 0 ? Math.round((totalRec-totalDesp)/totalRec*100) : 0,
    }});
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.get = async (req, res) => {
  try {
    const item = await BPO.findById(req.params.id).populate('company','legalName tradeName');
    if (!item) return res.status(404).json({ success:false, message:'Lançamento não encontrado' });
    res.json({ success:true, item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const item = await BPO.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success:true, message:'Lançamento criado', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.update = async (req, res) => {
  try {
    const item = await BPO.findByIdAndUpdate(req.params.id, req.body, { new:true });
    if (!item) return res.status(404).json({ success:false, message:'Não encontrado' });
    res.json({ success:true, message:'Atualizado', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.baixa = async (req, res) => {
  try {
    const { paidDate, paymentMethod } = req.body;
    const item = await BPO.findByIdAndUpdate(req.params.id,
      { status:'pago', paidDate: paidDate||new Date(), paymentMethod },
      { new:true }
    ).populate('company','legalName tradeName');
    if (!item) return res.status(404).json({ success:false, message:'Não encontrado' });
    let autoPost = null;
    try { autoPost = await autoPosting.postBPO(item, req.user._id); } catch(e) {}
    res.json({ success:true, message:'Baixa registrada'+(autoPost?.success?' — lançamento criado':''), item, autoPost });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await BPO.findByIdAndUpdate(req.params.id, { status:'cancelado' });
    res.json({ success:true, message:'Cancelado' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};
