// server/services/autoPostingService.js
// Auto-lançamentos contábeis — quando Folha é fechada ou BPO é baixado
// Garante que TODOS os eventos financeiros aparecem na contabilidade automaticamente

const Transaction = require('../models/Transaction');
const mongoose    = require('mongoose');

const r2 = v => Math.round((v||0)*100)/100;

// ── AO FECHAR FOLHA DE PAGAMENTO → Gera lançamentos contábeis ─
async function postFolha(payroll, userId) {
  const companyId = payroll.company._id || payroll.company;
  const comp      = payroll.competence;
  const existing  = await Transaction.countDocuments({
    company: companyId, competence: comp,
    description: { $regex: 'Folha de Pagamento' }, status:'confirmado'
  });
  if(existing > 0) return { skipped: true, msg: 'Lançamentos já existem para esta folha' };

  const lancamentos = [];

  // D: 6.1 Despesa Pessoal / C: 2.1 Salários a Pagar
  if(payroll.totalGross > 0) {
    lancamentos.push({
      company:       companyId,
      date:          new Date(),
      description:   `Folha de Pagamento — Salário Bruto — ${comp}`,
      amount:        r2(payroll.totalGross),
      type:          'debit',
      debitAccount:  '6.1.1.01',
      creditAccount: '2.1.3.01',
      category:      'Pessoal — Salários',
      competence:    comp,
      document:      `FOLHA-${comp}`,
      createdBy:     userId,
      status:        'confirmado',
    });
  }

  // D: 6.1 INSS Patronal / C: 2.1 INSS a Recolher
  if(payroll.totalINSSEmployer > 0) {
    lancamentos.push({
      company:       companyId,
      date:          new Date(),
      description:   `INSS Patronal — ${comp}`,
      amount:        r2(payroll.totalINSSEmployer),
      type:          'debit',
      debitAccount:  '6.1.2.01',
      creditAccount: '2.1.4.01',
      category:      'Pessoal — INSS Patronal',
      competence:    comp,
      document:      `INSS-PATR-${comp}`,
      createdBy:     userId,
      status:        'confirmado',
    });
  }

  // D: 6.1 FGTS / C: 2.1 FGTS a Recolher
  if(payroll.totalFGTS > 0) {
    lancamentos.push({
      company:       companyId,
      date:          new Date(),
      description:   `FGTS — ${comp}`,
      amount:        r2(payroll.totalFGTS),
      type:          'debit',
      debitAccount:  '6.1.3.01',
      creditAccount: '2.1.5.01',
      category:      'Pessoal — FGTS',
      competence:    comp,
      document:      `FGTS-${comp}`,
      createdBy:     userId,
      status:        'confirmado',
    });
  }

  // D: 2.1 INSS Funcionário / C: 2.1 INSS a Recolher (retenção)
  if(payroll.totalINSSEmployee > 0) {
    lancamentos.push({
      company:       companyId,
      date:          new Date(),
      description:   `INSS Retido dos Funcionários — ${comp}`,
      amount:        r2(payroll.totalINSSEmployee),
      type:          'debit',
      debitAccount:  '2.1.3.01',
      creditAccount: '2.1.4.01',
      category:      'Pessoal — INSS Retido',
      competence:    comp,
      document:      `INSS-RET-${comp}`,
      createdBy:     userId,
      status:        'confirmado',
    });
  }

  // D: 2.1 IRRF Retido / C: 2.1 IRRF a Recolher
  if(payroll.totalIRRF > 0) {
    lancamentos.push({
      company:       companyId,
      date:          new Date(),
      description:   `IRRF Retido Funcionários — ${comp}`,
      amount:        r2(payroll.totalIRRF),
      type:          'debit',
      debitAccount:  '2.1.3.01',
      creditAccount: '2.1.6.01',
      category:      'Pessoal — IRRF Retido',
      competence:    comp,
      document:      `IRRF-RET-${comp}`,
      createdBy:     userId,
      status:        'confirmado',
    });
  }

  const criados = await Transaction.insertMany(lancamentos);
  return { success:true, total:criados.length, msg:`${criados.length} lançamentos criados automaticamente` };
}

// ── AO BAIXAR BPO → Gera lançamento contábil ─────────────────
async function postBPO(bpoItem, userId) {
  const companyId = bpoItem.company._id || bpoItem.company;
  const comp      = bpoItem.competence;

  // Evita duplicidade
  const existing = await Transaction.countDocuments({
    company: companyId, document: `BPO-${bpoItem._id}`, status:'confirmado'
  });
  if(existing > 0) return { skipped:true, msg:'Lançamento já existe para este BPO' };

  const isReceita = bpoItem.type === 'receita';
  const lanc = {
    company:       companyId,
    date:          bpoItem.paymentDate || new Date(),
    description:   bpoItem.description || (isReceita ? 'Recebimento' : 'Pagamento'),
    amount:        r2(bpoItem.amount),
    type:          isReceita ? 'credit' : 'debit',
    debitAccount:  isReceita ? '1.1.1.02' : '6.1.9.99',  // Banco / Despesa
    creditAccount: isReceita ? '4.1.1.01' : '1.1.1.02',  // Receita / Banco
    category:      bpoItem.category || (isReceita ? 'Receita Operacional' : 'Despesa Operacional'),
    competence:    comp,
    document:      `BPO-${bpoItem._id}`,
    notes:         `Auto-gerado via BPO Financeiro`,
    createdBy:     userId,
    status:        'confirmado',
  };

  const criado = await Transaction.create(lanc);
  return { success:true, transaction:criado, msg:'Lançamento contábil criado automaticamente' };
}

// ── VERIFICA SAÚDE DA INTEGRAÇÃO ──────────────────────────────
async function verificarIntegridade(companyId, competence) {
  const [txCount, payrolls] = await Promise.all([
    Transaction.countDocuments({ company:companyId, competence, status:{ $ne:'cancelado' } }),
    require('../models/Payroll').countDocuments({ company:companyId, competence }),
  ]);

  const folhasLancadas = await Transaction.countDocuments({
    company:companyId, competence, description:{ $regex:'Folha de Pagamento' }
  });

  return {
    lancamentosContabeis: txCount,
    folhasProcessadas:    payrolls,
    folhasIntegradas:     Math.min(folhasLancadas, payrolls),
    integracaoCompleta:   payrolls > 0 ? folhasLancadas >= payrolls : txCount > 0,
    alertas: payrolls > 0 && folhasLancadas === 0
      ? ['⚠️ Folha fechada mas sem lançamentos contábeis — feche a folha novamente para gerar automaticamente']
      : [],
  };
}

module.exports = { postFolha, postBPO, verificarIntegridade };
