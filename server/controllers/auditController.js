// server/controllers/auditController.js
// Exibe os logs de auditoria na Central de Gestão
const auditService = require('../services/auditService');

exports.list = async (req, res) => {
  try {
    const { company, user, module, action, startDate, endDate, page, limit } = req.query;
    const result = await auditService.list({ company, user, module, action, startDate, endDate, page, limit });
    res.json({ success: true, ...result });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.stats = async (req, res) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const now = new Date();
    const inicio7d = new Date(now - 7*24*60*60*1000);

    const [total, ultimos7d, porAcao, acessoNegado] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ createdAt: { $gte: inicio7d } }),
      AuditLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      AuditLog.countDocuments({ action: 'ACCESS_DENIED', createdAt: { $gte: inicio7d } }),
    ]);

    res.json({ success: true, stats: { total, ultimos7d, porAcao, acessoNegado } });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};
