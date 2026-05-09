// server/services/auditService.js
// Serviço central de auditoria — use em todos os controllers críticos
const AuditLog = require('../models/AuditLog');

async function log({ req, action, module: mod, targetId, targetName, before, after, company, success = true, message }) {
  try {
    const user = req?.user;
    const changes = [];

    // Detecta campos alterados automaticamente
    if (before && after) {
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
      const SKIP = ['_id','__v','createdAt','updatedAt','password'];
      for (const k of allKeys) {
        if (SKIP.includes(k)) continue;
        const bVal = JSON.stringify(before[k]);
        const aVal = JSON.stringify(after[k]);
        if (bVal !== aVal) {
          changes.push({ field: k, before: before[k], after: after[k] });
        }
      }
    }

    await AuditLog.create({
      user:       user?._id,
      userName:   user?.name,
      userRole:   user?.role,
      userIP:     req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown',
      action,
      module:     mod,
      targetId:   targetId?.toString(),
      targetName,
      before:     before ? JSON.parse(JSON.stringify(before)) : undefined,
      after:      after  ? JSON.parse(JSON.stringify(after))  : undefined,
      changes,
      company:    company || user?.company,
      success,
      message,
      userAgent:  req?.headers?.['user-agent'],
    });
  } catch(e) {
    // Nunca deixa o audit log quebrar a operação principal
    console.error('[AUDIT] Erro ao registrar log:', e.message);
  }
}

// Ações pré-definidas
const ACTIONS = {
  CREATE:        'CREATE',
  UPDATE:        'UPDATE',
  DELETE:        'DELETE',
  LOGIN:         'LOGIN',
  LOGOUT:        'LOGOUT',
  LOGIN_FAILED:  'LOGIN_FAILED',
  EXPORT:        'EXPORT',
  PRINT:         'PRINT',
  STATUS_CHANGE: 'STATUS_CHANGE',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  ACCESS_DENIED: 'ACCESS_DENIED',
};

// Lista de logs
async function list({ company, user, module: mod, action, startDate, endDate, page = 1, limit = 50 } = {}) {
  const f = {};
  if (company)   f.company   = company;
  if (user)      f.user      = user;
  if (mod)       f.module    = mod;
  if (action)    f.action    = action;
  if (startDate || endDate) {
    f.createdAt = {};
    if (startDate) f.createdAt.$gte = new Date(startDate);
    if (endDate)   f.createdAt.$lte = new Date(endDate);
  }
  const total = await AuditLog.countDocuments(f);
  const items = await AuditLog.find(f)
    .populate('user','name email role')
    .populate('company','legalName tradeName')
    .sort({ createdAt: -1 })
    .skip((+page-1)*+limit)
    .limit(+limit);
  return { items, total, page: +page, totalPages: Math.ceil(total/+limit) };
}

module.exports = { log, list, ACTIONS };
