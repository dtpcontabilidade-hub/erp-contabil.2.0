const FPA    = require('../models/FPA');
const BPO    = require('../models/BPO');

exports.list = async (req, res) => {
  try {
    const { company, competence, tipo, page=1, limit=20 } = req.query;
    const f = {};
    if (company)    f.company    = company;
    if (competence) f.competence = competence;
    if (tipo)       f.tipo       = tipo;
    const total = await FPA.countDocuments(f);
    const items = await FPA.find(f)
      .populate('company','legalName tradeName')
      .sort({ competence:-1 })
      .skip((+page-1)*+limit).limit(+limit);
    res.json({ success:true, items, pagination:{total,page:+page,totalPages:Math.ceil(total/+limit)} });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.get = async (req, res) => {
  try {
    const item = await FPA.findById(req.params.id).populate('company','legalName tradeName cnpj');
    if (!item) return res.status(404).json({ success:false, message:'Não encontrado' });
    res.json({ success:true, item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const item = await FPA.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success:true, message:'Criado', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.update = async (req, res) => {
  try {
    const item = await FPA.findByIdAndUpdate(req.params.id, req.body, { new:true });
    if (!item) return res.status(404).json({ success:false, message:'Não encontrado' });
    res.json({ success:true, message:'Atualizado', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await FPA.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Removido' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

// Dashboard FP&A — compara orçado x realizado usando BPO
exports.dashboard = async (req, res) => {
  try {
    const { company, competence } = req.query;
    const f = {};
    if (company)    f.company    = company;
    if (competence) f.competence = competence;
    
    const [fpas, bpos] = await Promise.all([
      FPA.find(f).populate('company','legalName tradeName'),
      BPO.find({ ...f, status:{ $ne:'cancelado' } }).select('type amount category competence'),
    ]);

    const orcRec  = fpas.reduce((a,fp)=>a+fp.linhas.filter(l=>l.tipo==='receita').reduce((b,l)=>b+l.orcado,0),0);
    const orcDesp = fpas.reduce((a,fp)=>a+fp.linhas.filter(l=>l.tipo==='despesa').reduce((b,l)=>b+l.orcado,0),0);
    const realRec  = bpos.filter(b=>b.type==='receita').reduce((a,b)=>a+b.amount,0);
    const realDesp = bpos.filter(b=>b.type==='despesa').reduce((a,b)=>a+b.amount,0);

    res.json({ success:true, dashboard:{
      orcadoReceitas: orcRec,  realizadoReceitas: realRec,
      orcadoDespesas: orcDesp, realizadoDespesas: realDesp,
      variacaoReceitas: orcRec  > 0 ? Math.round((realRec -orcRec) /orcRec *100) : 0,
      variacaoDespesas: orcDesp > 0 ? Math.round((realDesp-orcDesp)/orcDesp*100) : 0,
      resultadoOrcado:   orcRec  - orcDesp,
      resultadoRealizado: realRec - realDesp,
      totalFPAs: fpas.length,
    }});
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};
