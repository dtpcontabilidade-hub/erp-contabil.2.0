const express  = require('express');
const router   = express.Router();
const { protect, authorize } = require('../middlewares/auth');

// Auth
const auth = require('../controllers/authController');
router.post('/auth/login',           auth.login);
router.get( '/auth/me',              protect, auth.me);
router.post('/auth/change-password', protect, auth.changePassword);

// Companies
const co = require('../controllers/companyController');
router.get(   '/companies/stats', protect, co.stats);
router.get(   '/companies',       protect, co.list);
router.get(   '/companies/:id',   protect, co.get);
router.post(  '/companies',       protect, authorize('admin','contador'), co.create);
router.put(   '/companies/:id',   protect, authorize('admin','contador'), co.update);
router.delete('/companies/:id',   protect, authorize('admin','contador'), co.remove);

// Transactions
const tx = require('../controllers/transactionController');
router.get(   '/transactions/summary', protect, tx.summary);
router.get(   '/transactions',         protect, tx.list);
router.get(   '/transactions/:id',     protect, tx.get);
router.post(  '/transactions',         protect, authorize('admin','contador'), tx.create);
router.put(   '/transactions/:id',     protect, authorize('admin','contador'), tx.update);
router.delete('/transactions/:id',     protect, authorize('admin','contador'), tx.cancel);

// Duties
const du = require('../controllers/dutyController');
router.get(   '/duties/upcoming',   protect, du.upcoming);
router.get(   '/duties',            protect, du.list);
router.get(   '/duties/:id',        protect, du.get);
router.post(  '/duties',            protect, authorize('admin','contador'), du.create);
router.put(   '/duties/:id',        protect, authorize('admin','contador'), du.update);
router.delete('/duties/:id',        protect, authorize('admin','contador'), du.remove);
router.patch( '/duties/:id/status', protect, du.changeStatus);

// Billing
const bi = require('../controllers/billingController');
router.get('/billing/summary',    protect, bi.summary);
router.get('/billing/by-service', protect, bi.byService);
router.get('/billing/by-regime',  protect, bi.byRegime);

// Payroll
const pr = require('../controllers/payrollController');
router.get(   '/payroll/stats',      protect, pr.stats);
router.get(   '/payroll',            protect, pr.list);
router.get(   '/payroll/:id',        protect, pr.get);
router.post(  '/payroll',            protect, authorize('admin','contador'), pr.create);
router.put(   '/payroll/:id',        protect, authorize('admin','contador'), pr.update);
router.patch( '/payroll/:id/status', protect, pr.changeStatus);
router.delete('/payroll/:id',        protect, authorize('admin','contador'), pr.remove);

// Health
router.get('/health', (_, res) => res.json({ status:'online', ts: new Date() }));

module.exports = router;

// BPO Financeiro
const bpo = require('../controllers/bpoController');
router.get(   '/bpo/summary',      protect, bpo.summary);
router.get(   '/bpo/fluxo',        protect, bpo.fluxo);
router.get(   '/bpo/dre',          protect, bpo.dre);
router.get(   '/bpo',              protect, bpo.list);
router.get(   '/bpo/:id',          protect, bpo.get);
router.post(  '/bpo',              protect, bpo.create);
router.put(   '/bpo/:id',          protect, bpo.update);
router.patch( '/bpo/:id/baixa',    protect, bpo.baixa);
router.delete('/bpo/:id',          protect, bpo.remove);
