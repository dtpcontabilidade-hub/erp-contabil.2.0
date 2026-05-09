const CentroCusto = require('../models/CentroCusto');

exports.list = async (req, res) => {
  try {
    const { company } = req.query;
    let f = { ativo: true };
    if (company) {
      // Retorna centros da empresa + centros padrão (company: null)
      f = { ativo: true, $or: [{ company }, { company: null }] };
    }
    const items = await CentroCusto.find(f).sort({ codigo: 1 });
    res.json({ success:true, items });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.get = async (req, res) => {
  try {
    const item = await CentroCusto.findById(req.params.id).populate('company','legalName tradeName');
    if (!item) return res.status(404).json({ success:false, message:'Não encontrado' });
    res.json({ success:true, item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const item = await CentroCusto.create(req.body);
    res.status(201).json({ success:true, message:'Centro de custo criado', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.update = async (req, res) => {
  try {
    const item = await CentroCusto.findByIdAndUpdate(req.params.id, req.body, { new:true });
    if (!item) return res.status(404).json({ success:false, message:'Não encontrado' });
    res.json({ success:true, message:'Atualizado', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await CentroCusto.findByIdAndUpdate(req.params.id, { ativo: false });
    res.json({ success:true, message:'Desativado' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};
