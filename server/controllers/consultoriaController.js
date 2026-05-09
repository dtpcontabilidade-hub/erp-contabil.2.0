const Consultoria = require('../models/Consultoria');

exports.list = async (req, res) => {
  try {
    const { company, tipo, status, prioridade, page=1, limit=20 } = req.query;
    const f = {};
    if (company)    f.company    = company;
    if (tipo)       f.tipo       = tipo;
    if (status)     f.status     = status;
    if (prioridade) f.prioridade = prioridade;
    const total = await Consultoria.countDocuments(f);
    const items = await Consultoria.find(f)
      .populate('company','legalName tradeName')
      .sort({ createdAt:-1 })
      .skip((+page-1)*+limit).limit(+limit)
      .select('-acoes');
    res.json({ success:true, items, pagination:{total,page:+page,totalPages:Math.ceil(total/+limit)} });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.stats = async (req, res) => {
  try {
    const all = await Consultoria.find({}).select('tipo status prioridade honorario economiaEstimada');
    res.json({ success:true, stats:{
      total: all.length,
      abertas:      all.filter(c=>c.status==='aberta').length,
      em_andamento: all.filter(c=>c.status==='em_andamento').length,
      concluidas:   all.filter(c=>c.status==='concluida').length,
      alta_prioridade: all.filter(c=>c.prioridade==='alta').length,
      totalHonorarios: all.reduce((a,c)=>a+(c.honorario||0),0),
      totalEconomia:   all.reduce((a,c)=>a+(c.economiaEstimada||0),0),
      tributaria:   all.filter(c=>c.tipo==='tributaria').length,
      empresarial:  all.filter(c=>c.tipo==='empresarial').length,
    }});
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.get = async (req, res) => {
  try {
    const item = await Consultoria.findById(req.params.id).populate('company','legalName tradeName cnpj taxRegime');
    if (!item) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const item = await Consultoria.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success:true, message:'Consultoria criada', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.update = async (req, res) => {
  try {
    const item = await Consultoria.findByIdAndUpdate(req.params.id, req.body, { new:true });
    if (!item) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, message:'Atualizada', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await Consultoria.findByIdAndUpdate(req.params.id, { status:'cancelada' });
    res.json({ success:true, message:'Cancelada' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};
