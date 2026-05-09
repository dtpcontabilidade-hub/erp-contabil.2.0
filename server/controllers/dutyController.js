// server/controllers/dutyController.js — versão completa
const Duty = require('../models/Duty');

exports.list = async (req, res) => {
  try {
    const { company, competence, status, type, search, page=1, limit=30 } = req.query;
    const f = {};
    if (company)    f.company    = company;
    if (competence) f.competence = competence;
    if (status)     f.status     = status;
    if (type)       f.type       = type;
    if (search)     f.name       = new RegExp(search,'i');
    const total  = await Duty.countDocuments(f);
    const duties = await Duty.find(f)
      .populate('company','legalName tradeName cnpj')
      .sort({ dueDate:1 })
      .skip((+page-1)*+limit).limit(+limit);
    res.json({ success:true, duties, pagination:{ total, page:+page, totalPages:Math.ceil(total/+limit), limit:+limit } });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.upcoming = async (req, res) => {
  try {
    const days  = parseInt(req.query.days)||7;
    const emp   = req.query.company;
    const now   = new Date(); now.setHours(0,0,0,0);
    const limit = new Date(now); limit.setDate(limit.getDate()+days);
    const f = {
      dueDate: { $gte:now, $lte:limit },
      status:  { $nin:['entregue','pago','dispensado'] },
    };
    if (emp) f.company = emp;
    const duties = await Duty.find(f)
      .populate('company','legalName tradeName')
      .sort({ dueDate:1 }).limit(50);
    // Adiciona atrasados
    const atrasados = await Duty.find({
      dueDate: { $lt:now },
      status:  { $nin:['entregue','pago','dispensado'] },
      ...(emp?{company:emp}:{}),
    }).populate('company','legalName tradeName').sort({ dueDate:1 }).limit(20);
    res.json({ success:true, duties:[...atrasados,...duties] });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.get = async (req, res) => {
  try {
    const d = await Duty.findById(req.params.id).populate('company','legalName tradeName cnpj');
    if (!d) return res.status(404).json({ success:false, message:'Obrigação não encontrada' });
    res.json({ success:true, duty:d });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const d = await Duty.create({ ...req.body, createdBy:req.user._id });
    res.status(201).json({ success:true, message:'Obrigação cadastrada', duty:d });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.update = async (req, res) => {
  try {
    const d = await Duty.findByIdAndUpdate(req.params.id, req.body, { new:true })
      .populate('company','legalName tradeName');
    if (!d) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, message:'Obrigação atualizada', duty:d });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await Duty.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Obrigação removida' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.changeStatus = async (req, res) => {
  try {
    const { status, protocol, deliveredAt, paidAt, notes } = req.body;
    const upd = { status };
    if (protocol)    upd.protocol    = protocol;
    if (deliveredAt) upd.deliveredAt = deliveredAt;
    if (paidAt)      upd.paidAt      = paidAt;
    if (notes)       upd.notes       = notes;
    // Auto-ajusta status para atrasado se passou do vencimento
    const d = await Duty.findByIdAndUpdate(req.params.id, upd, { new:true })
      .populate('company','legalName tradeName');
    if (!d) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, message:'Status atualizado', duty:d });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};
