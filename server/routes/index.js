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


// ── SPED TRANSMISSÕES ─────────────────────────────────────────
const spedTrans = require('../controllers/spedTransmissaoController');
router.get(  '/sped-transmissoes/stats',          protect, spedTrans.stats);
router.post( '/sped-transmissoes/validar',        protect, spedTrans.validarArquivo);
router.get(  '/sped-transmissoes',                protect, spedTrans.list);
router.get(  '/sped-transmissoes/:id',            protect, spedTrans.get);
router.post( '/sped-transmissoes/registrar',      protect, spedTrans.registrarGeracao);
router.put(  '/sped-transmissoes/:id/transmitir', protect, spedTrans.marcarTransmitido);
router.put(  '/sped-transmissoes/:id/status',     protect, spedTrans.marcarStatus);


// ── PLANO DE CONTAS ───────────────────────────────────────────
const pc = require('../controllers/planoContaController');
router.post('/plano-contas/seed',  protect, pc.seed);
router.get( '/plano-contas',       protect, pc.list);
router.post('/plano-contas',       protect, pc.create);
router.put( '/plano-contas/:id',   protect, pc.update);
router.delete('/plano-contas/:id', protect, pc.remove);

// ── CENTROS DE CUSTO ──────────────────────────────────────────
const cc = require('../controllers/centroCustoController');
router.get(   '/centros-custo',       protect, cc.list);
router.get(   '/centros-custo/:id',   protect, cc.get);
router.post(  '/centros-custo',       protect, cc.create);
router.put(   '/centros-custo/:id',   protect, cc.update);
router.delete('/centros-custo/:id',   protect, cc.remove);


// ── BPO ───────────────────────────────────────────────────────
const bpo = require('../controllers/bpoController');
router.get(  '/bpo/summary', protect, bpo.summary);
router.get(  '/bpo/fluxo',   protect, bpo.fluxo);
router.get(  '/bpo/dre',     protect, bpo.dre);
router.get(  '/bpo',         protect, bpo.list);
router.get(  '/bpo/:id',     protect, bpo.get);
router.post( '/bpo',         protect, bpo.create);
router.put(  '/bpo/:id',     protect, bpo.update);
router.put(  '/bpo/:id/baixa', protect, bpo.baixa);
router.delete('/bpo/:id',    protect, bpo.remove);

// ── AUDITORIA ─────────────────────────────────────────────────
const aud = require('../controllers/auditoriaController');
router.get(   '/auditoria/stats',      protect, aud.stats);
if (aud.checklists) router.get('/auditoria/checklists', protect, aud.checklists);
router.get(   '/auditoria',            protect, aud.list);
router.get(   '/auditoria/:id',        protect, aud.get);
router.post(  '/auditoria',            protect, aud.create);
router.put(   '/auditoria/:id',        protect, aud.update);
router.delete('/auditoria/:id',        protect, aud.remove);

// ── CONSULTORIAS ──────────────────────────────────────────────
const cons = require('../controllers/consultoriaController');
router.get(   '/consultorias/stats',  protect, cons.stats);
router.get(   '/consultorias',        protect, cons.list);
router.get(   '/consultorias/:id',    protect, cons.get);
router.post(  '/consultorias',        protect, cons.create);
router.put(   '/consultorias/:id',    protect, cons.update);
router.delete('/consultorias/:id',    protect, cons.remove);

// ── ESCRITURAÇÃO ──────────────────────────────────────────────
const esc = require('../controllers/escrituracaoController');
router.get(  '/escrituracao/livro-diario', protect, esc.livrodiario);
router.get(  '/escrituracao/livro-razao',  protect, esc.livrorazao);
router.get(  '/escrituracao/balancete',    protect, esc.balancete);
router.get(  '/escrituracao/apuracao',     protect, esc.apuracao);
router.get(  '/escrituracao',              protect, esc.list);
router.get(  '/escrituracao/:id',          protect, esc.get);
router.post( '/escrituracao',              protect, esc.create);
router.put(  '/escrituracao/:id',          protect, esc.update);

// ── FPA ───────────────────────────────────────────────────────
const fpa = require('../controllers/fpaController');
router.get(   '/fpa/dashboard', protect, fpa.dashboard);
router.get(   '/fpa',           protect, fpa.list);
router.get(   '/fpa/:id',       protect, fpa.get);
router.post(  '/fpa',           protect, fpa.create);
router.put(   '/fpa/:id',       protect, fpa.update);
router.delete('/fpa/:id',       protect, fpa.remove);

// ── CENTRAL DE GESTÃO ─────────────────────────────────────────
const cg = require('../controllers/centralGestaoController');
router.get(   '/central-gestao/empresas',           protect, cg.listarEmpresas);
router.get(   '/central-gestao/usuarios-erp',       protect, cg.listarUsuariosERP);
router.get(   '/central-gestao/empresas/:id',       protect, cg.getEmpresa);
router.get(   '/central-gestao/presets',            protect, cg.presets);
router.put(   '/central-gestao/config',             protect, cg.salvarConfig);
router.post(  '/central-gestao/usuarios',           protect, cg.gerenciarUsuario);
router.delete('/central-gestao/usuarios/:id',       protect, cg.removerUsuario);
router.post(  '/central-gestao/usuarios/:id/senha', protect, cg.resetarSenha);

// ── ENDPOINT PÚBLICO DO CLIENTE ───────────────────────────────
router.get('/cliente/me', protect, cg.minhasPermissoes);

// ── USERS ─────────────────────────────────────────────────────
const usr = require('../controllers/userController');
router.get(   '/users',       protect, usr.list);
router.get(   '/users/:id',   protect, usr.get);
router.post(  '/users',       protect, usr.create);
router.put(   '/users/:id',   protect, usr.update);
router.delete('/users/:id',   protect, usr.remove);

// ── SPED (geração) ────────────────────────────────────────────
const sped = require('../controllers/spedController');
router.get('/sped/ecd',         protect, sped.gerarECD);
router.get('/sped/efd',         protect, sped.gerarEFD);
router.get('/sped/efd-contrib', protect, sped.gerarEFDContrib);
router.get('/sped/ecf',         protect, sped.gerarECF);

// ── CONCILIAÇÃO ───────────────────────────────────────────────
const conc = require('../controllers/conciliacaoController');
router.get(  '/conciliacao',               protect, conc.list);
router.get(  '/conciliacao/:id',           protect, conc.get);
router.post( '/conciliacao',               protect, conc.create);
router.post( '/conciliacao/:id/ofx',       protect, conc.importarOFX);
router.post( '/conciliacao/:id/csv',       protect, conc.importarCSV);
router.post( '/conciliacao/:id/match',     protect, conc.matchAutomatico);
router.get(  '/conciliacao/:id/relatorio', protect, conc.relatorio);

// ── GUIAS ─────────────────────────────────────────────────────
const guias = require('../controllers/guiasController');
router.get('/guias/gps',   protect, guias.gerarGPS);
router.get('/guias/darf',  protect, guias.gerarDARF);
router.get('/guias/das',   protect, guias.gerarDAS);
router.get('/guias/fgts',  protect, guias.gerarFGTS);
router.get('/guias/pgdas', protect, guias.relatorioPGDAS);

// ── ESOCIAL ───────────────────────────────────────────────────
const esoc = require('../controllers/esocialController');
router.get(  '/esocial/stats',        protect, esoc.stats);
router.get(  '/esocial/s1000',        protect, esoc.gerarS1000);
router.get(  '/esocial/s1200',        protect, esoc.gerarS1200);
router.post( '/esocial/s2200',        protect, esoc.gerarS2200);
router.post( '/esocial/s2299',        protect, esoc.gerarS2299);
router.get(  '/esocial/s5001',        protect, esoc.gerarS5001);
router.get(  '/esocial',              protect, esoc.list);
router.put(  '/esocial/:id/status',   protect, esoc.atualizarStatus);
router.get(  '/esocial/:id/download', protect, esoc.downloadXML);

// ── NOTIFICAÇÕES ──────────────────────────────────────────────
const notif = require('../controllers/notificacoesController');
router.get(  '/notificacoes/config',      protect, notif.getConfig);
router.post( '/notificacoes/config',      protect, notif.saveConfig);
router.put(  '/notificacoes/todas-lidas', protect, notif.marcarTodasLidas);
router.post( '/notificacoes/processar',   protect, notif.processar);
router.post( '/notificacoes/enviar',      protect, notif.enviarPendentes);
router.get(  '/notificacoes',             protect, notif.list);
router.put(  '/notificacoes/:id/lida',    protect, notif.marcarLida);

// ── RELATÓRIOS INTEGRADOS ─────────────────────────────────────
const rel = require('../controllers/relatoriosController');
router.get('/relatorios/dre',       protect, rel.dre);
router.get('/relatorios/fluxo',     protect, rel.fluxo);
router.get('/relatorios/balanco',   protect, rel.balanco);
router.get('/relatorios/balancete', protect, rel.balancete);
router.get('/relatorios/kpis',      protect, rel.kpis);
router.get('/relatorios/dashboard', protect, rel.dashboard);

module.exports = router;
