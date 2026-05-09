// server/controllers/billingController.js — versão completa
const Company = require('../models/Company');

exports.summary = async (req, res) => {
  try {
    const companies = await Company.find({ status: { $ne: 'inativo' } })
      .select('legalName tradeName cnpj fee dueDay services taxRegime status employees sector');

    const byStatus = { pago:0, pendente:0, atrasado:0 };
    companies.forEach(c => { if (byStatus[c.status] !== undefined) byStatus[c.status]++; });

    const totalFee   = companies.reduce((a,c)=>a+(c.fee||0),0);
    const byService  = companies.reduce((a,c) => {
      (c.services||[]).forEach(s => { a[s] = (a[s]||0) + (c.fee||0); });
      return a;
    }, {});

    res.json({ success:true, summary:{
      totalActiveCompanies: companies.length,
      totalMonthlyFee:      totalFee,
      byStatus,
      byService,
      companies: companies.map(c=>({
        _id:c._id, legalName:c.legalName, tradeName:c.tradeName,
        cnpj:c.cnpj, fee:c.fee, dueDay:c.dueDay, status:c.status,
        taxRegime:c.taxRegime, sector:c.sector, services:c.services,
        employees:c.employees,
      })),
    }});
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.byService = async (req, res) => {
  try {
    const companies = await Company.find({ status:{ $ne:'inativo' } }).select('services fee');
    const map = {};
    companies.forEach(c => {
      (c.services||[]).forEach(s => {
        if (!map[s]) map[s] = { _id:s, count:0, totalFee:0 };
        map[s].count++;
        map[s].totalFee += (c.fee||0);
      });
    });
    res.json({ success:true, data: Object.values(map).sort((a,b)=>b.totalFee-a.totalFee) });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.byRegime = async (req, res) => {
  try {
    const companies = await Company.find({ status:{ $ne:'inativo' } }).select('taxRegime fee');
    const map = {};
    companies.forEach(c => {
      const k = c.taxRegime || 'outros';
      if (!map[k]) map[k] = { _id:k, count:0, totalFee:0 };
      map[k].count++;
      map[k].totalFee += (c.fee||0);
    });
    res.json({ success:true, data: Object.values(map).sort((a,b)=>b.totalFee-a.totalFee) });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};
