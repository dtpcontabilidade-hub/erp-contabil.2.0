// server/controllers/transactionController.js — versão completa
const Transaction = require('../models/Transaction');

exports.list = async (req, res) => {
  try {
    const { company, competence, category, type, status, search, sort, page=1, limit=20 } = req.query;
    const f = {};
    if (company)    f.company    = company;
    if (competence) f.competence = competence;
    if (category)   f.category   = category;
    if (type)       f.type       = type;
    if (status)     f.status     = status;
    else            f.status     = { $ne: 'cancelado' };
    if (search)     f.description = new RegExp(search, 'i');

    // Ordenação
    let sortObj = { date: -1 };
    if (sort === 'date_asc')     sortObj = { date: 1 };
    if (sort === 'amount_desc')  sortObj = { amount: -1 };
    if (sort === 'amount_asc')   sortObj = { amount: 1 };

    const total = await Transaction.countDocuments(f);
    const transactions = await Transaction.find(f)
      .populate('company','legalName tradeName')
      .populate('centroCusto','codigo descricao')
      .sort(sortObj)
      .skip((+page-1)*+limit).limit(+limit);
    res.json({ success:true, transactions, pagination:{ total, page:+page, totalPages:Math.ceil(total/+limit), limit:+limit } });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.summary = async (req, res) => {
  try {
    const { company, competence } = req.query;
    const f = { status: { $ne: 'cancelado' } };
    if (company)    f.company    = company;
    if (competence) f.competence = competence;
    const rows = await Transaction.find(f).select('type amount');
    const debit  = rows.filter(r=>r.type==='debit').reduce((a,r)=>a+r.amount,0);
    const credit = rows.filter(r=>r.type==='credit').reduce((a,r)=>a+r.amount,0);
    res.json({ success:true, totals:{ debit, credit, balance:credit-debit } });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.get = async (req, res) => {
  try {
    const t = await Transaction.findById(req.params.id)
      .populate('company','legalName tradeName')
      .populate('centroCusto','codigo descricao');
    if (!t) return res.status(404).json({ success:false, message:'Lançamento não encontrado' });
    res.json({ success:true, transaction:t });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const t = await Transaction.create({ ...req.body, createdBy:req.user._id });
    const populated = await t.populate('company','legalName tradeName');
    res.status(201).json({ success:true, message:'Lançamento registrado', transaction:populated });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.update = async (req, res) => {
  try {
    const t = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new:true })
      .populate('company','legalName tradeName');
    if (!t) return res.status(404).json({ success:false, message:'Não encontrado' });
    res.json({ success:true, message:'Lançamento atualizado', transaction:t });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.cancel = async (req, res) => {
  try {
    await Transaction.findByIdAndUpdate(req.params.id, { status:'cancelado' });
    res.json({ success:true, message:'Lançamento cancelado' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};
