const audit = require('../services/auditService');
// server/controllers/companyController.js — versão completa
const Company = require('../models/Company');

exports.list = async (req, res) => {
  try {
    const { search, status, regime, service, page=1, limit=20 } = req.query;
    const f = {};
    if (status)  f.status    = status;
    if (regime)  f.taxRegime = regime;
    if (service) f.services  = service;
    if (search)  f.$or = [
      { legalName:  new RegExp(search,'i') },
      { tradeName:  new RegExp(search,'i') },
      { cnpj:       new RegExp(search.replace(/\D/g,''),'i') },
      { sector:     new RegExp(search,'i') },
      { contactName:new RegExp(search,'i') },
    ];
    const total     = await Company.countDocuments(f);
    const companies = await Company.find(f)
      .sort({ legalName:1 })
      .skip((+page-1)*+limit).limit(+limit);
    res.json({ success:true, companies, pagination:{ total, page:+page, totalPages:Math.ceil(total/+limit), limit:+limit } });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.stats = async (req, res) => {
  try {
    const all = await Company.find().select('status fee taxRegime');
    const byStatus  = { pago:0, pendente:0, atrasado:0, inativo:0 };
    const byRegime  = {};
    let monthlyFee  = 0, active = 0;
    all.forEach(c => {
      if (byStatus[c.status] !== undefined) byStatus[c.status]++;
      if (c.status !== 'inativo') {
        active++;
        monthlyFee += (c.fee||0);
        const r = c.taxRegime||'outros';
        if (!byRegime[r]) byRegime[r] = { _id:r, count:0 };
        byRegime[r].count++;
      }
    });
    res.json({ success:true, stats:{
      total: all.length, active, monthlyFee,
      byStatus, byRegime: Object.values(byRegime),
    }});
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.get = async (req, res) => {
  try {
    const c = await Company.findById(req.params.id);
    if (!c) return res.status(404).json({ success:false, message:'Empresa não encontrada' });
    res.json({ success:true, company:c });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const c = await Company.create(req.body);
    res.status(201).json({ success:true, message:'Empresa cadastrada com sucesso', company:c });
  } catch(e) {
    if (e.code===11000) return res.status(400).json({ success:false, message:'CNPJ já cadastrado' });
    res.status(500).json({ success:false, message:e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const c = await Company.findByIdAndUpdate(req.params.id, req.body, { new:true, runValidators:true });
    if (!c) return res.status(404).json({ success:false, message:'Empresa não encontrada' });
    res.json({ success:true, message:'Empresa atualizada', company:c });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await Company.findByIdAndUpdate(req.params.id, { status:'inativo' });
    res.json({ success:true, message:'Empresa desativada' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};
