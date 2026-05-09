// server/services/contabilidadeEngine.js
// Motor central de integração contábil — alimenta todos os módulos
// Lê de Transaction + BPO + Payroll e gera DRE, BP, Fluxo, Balancete unificados

const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Payroll     = require('../models/Payroll');

// ── CLASSIFICAÇÃO DE CONTAS ──────────────────────────────────
// Baseado no 1º dígito do código NBC
const GRUPOS = {
  '1': { tipo:'ativo',      natureza:'devedora',  label:'Ativo' },
  '2': { tipo:'passivo',    natureza:'credora',   label:'Passivo' },
  '3': { tipo:'patrimonio', natureza:'credora',   label:'Patrimônio Líquido' },
  '4': { tipo:'receita',    natureza:'credora',   label:'Receita' },
  '5': { tipo:'custo',      natureza:'devedora',  label:'Custo' },
  '6': { tipo:'despesa',    natureza:'devedora',  label:'Despesa' },
  '7': { tipo:'resultado',  natureza:'credora',   label:'Resultado' },
};

// Palavras-chave para classificar automaticamente quando não há conta NBC
const KEYWORDS_RECEITA = ['receita','honorário','honorario','serviço','servico','venda','faturamento','mensalidade','renda','cliente'];
const KEYWORDS_CUSTO   = ['custo','cpv','cprb','fornecedor','materia','material','estoque'];
const KEYWORDS_DESP    = ['despesa','aluguel','energia','água','agua','internet','telefone','salario','inss','fgts','irrf','folha','pessoal','admin','financeira','juros','multa','imposto','taxa','contador'];

function classificarPorKeyword(desc, cat) {
  const txt = ((desc||'')+(cat||'')).toLowerCase();
  if(KEYWORDS_RECEITA.some(k=>txt.includes(k))) return 'receita';
  if(KEYWORDS_CUSTO.some(k=>txt.includes(k)))   return 'custo';
  if(KEYWORDS_DESP.some(k=>txt.includes(k)))    return 'despesa';
  return null;
}

function classificarConta(debitAccount, creditAccount, description, category, type) {
  // 1. Por conta NBC (mais preciso)
  const debGrupo = debitAccount  ? GRUPOS[debitAccount.charAt(0)]  : null;
  const creGrupo = creditAccount ? GRUPOS[creditAccount.charAt(0)] : null;

  if(debGrupo?.tipo === 'receita' || debGrupo?.tipo === 'custo' || debGrupo?.tipo === 'despesa')
    return debGrupo.tipo;
  if(creGrupo?.tipo === 'receita')
    return 'receita';
  if(debGrupo?.tipo === 'ativo' && creGrupo?.tipo === 'receita')
    return 'receita';

  // 2. Por type do lançamento
  if(type === 'credit') {
    const kw = classificarPorKeyword(description, category);
    if(kw === 'receita') return 'receita';
  }
  if(type === 'debit') {
    const kw = classificarPorKeyword(description, category);
    if(kw) return kw;
  }

  // 3. Por category explícita
  const cat = (category||'').toLowerCase();
  if(cat.includes('receita')) return 'receita';
  if(cat.includes('custo'))   return 'custo';
  if(cat.includes('despesa')) return 'despesa';

  // 4. Fallback pelo type
  return type === 'credit' ? 'receita' : 'despesa';
}

const r2 = v => Math.round((v||0)*100)/100;

// ── DRE UNIFICADA ────────────────────────────────────────────
// Lê Transaction + Payroll e retorna DRE completa
async function calcularDRE(company, competence, exercicio) {
  const fBase = { status: { $ne: 'cancelado' } };
  if(company) fBase.company = mongoose.Types.ObjectId.isValid(company)
    ? new mongoose.Types.ObjectId(company) : company;

  // Filtro por período
  const fTx = { ...fBase };
  if(competence) fTx.competence = competence;
  else if(exercicio) fTx.competence = { $regex: `^${exercicio}` };

  // Busca transações
  const txs = await Transaction.find(fTx)
    .select('amount type debitAccount creditAccount category description competence')
    .lean();

  // Busca folhas de pagamento
  const fPay = { status: { $ne: 'cancelado' } };
  if(company) fPay.company = fBase.company;
  if(competence) fPay.competence = competence;
  else if(exercicio) fPay.competence = { $regex: `^${exercicio}` };
  const payrolls = await Payroll.find(fPay)
    .select('totalGross totalNet totalINSSEmployee totalIRRF totalFGTS totalINSSEmployer totalCost competence headcount')
    .lean();

  // Agrupa receitas por categoria
  const receitas = {}, custos = {}, despesas = {};
  let totRec=0, totCusto=0, totDesp=0;

  txs.forEach(t => {
    const tipo = classificarConta(t.debitAccount, t.creditAccount, t.description, t.category, t.type);
    const cat  = t.category || t.description?.substring(0,40) || 'Outros';
    if(tipo === 'receita') {
      receitas[cat] = r2((receitas[cat]||0) + t.amount);
      totRec = r2(totRec + t.amount);
    } else if(tipo === 'custo') {
      custos[cat] = r2((custos[cat]||0) + t.amount);
      totCusto = r2(totCusto + t.amount);
    } else {
      despesas[cat] = r2((despesas[cat]||0) + t.amount);
      totDesp = r2(totDesp + t.amount);
    }
  });

  // Integra dados da folha nas despesas
  const totFolhaGross = payrolls.reduce((a,p)=>a+(p.totalGross||0),0);
  const totINSSPatr   = payrolls.reduce((a,p)=>a+(p.totalINSSEmployer||0),0);
  const totFGTS       = payrolls.reduce((a,p)=>a+(p.totalFGTS||0),0);
  const custoPessoal  = r2(totFolhaGross + totINSSPatr + totFGTS);

  if(custoPessoal > 0) {
    despesas['Pessoal e Encargos Sociais'] = r2((despesas['Pessoal e Encargos Sociais']||0) + custoPessoal);
    totDesp = r2(totDesp + custoPessoal);
  }

  const lucroBruto  = r2(totRec - totCusto);
  const ebitda      = r2(lucroBruto - totDesp);
  const tributos    = totRec > 0 ? r2(ebitda > 0 ? ebitda * 0.06 : 0) : 0;
  const lucroLiq    = r2(ebitda - tributos);
  const margBruta   = totRec > 0 ? Math.round(lucroBruto/totRec*100) : 0;
  const margEbitda  = totRec > 0 ? Math.round(ebitda/totRec*100)     : 0;
  const margLiq     = totRec > 0 ? Math.round(lucroLiq/totRec*100)   : 0;

  return {
    receitas:   Object.entries(receitas).map(([k,v])=>({categoria:k,valor:v})).sort((a,b)=>b.valor-a.valor),
    custos:     Object.entries(custos).map(([k,v])=>({categoria:k,valor:v})).sort((a,b)=>b.valor-a.valor),
    despesas:   Object.entries(despesas).map(([k,v])=>({categoria:k,valor:v})).sort((a,b)=>b.valor-a.valor),
    totalReceitas:  totRec,
    totalCustos:    totCusto,
    totalDespesas:  totDesp,
    lucroBruto,
    ebitda,
    tributos,
    lucroLiquido:   lucroLiq,
    margemBruta:    margBruta,
    margemEbitda:   margEbitda,
    margemLiquida:  margLiq,
    headcount:      payrolls.reduce((a,p)=>a+(p.headcount||0),0),
    custoPessoal,
    totalLancamentos: txs.length,
    periodos:       [...new Set(txs.map(t=>t.competence))].sort(),
  };
}

// ── FLUXO DE CAIXA ───────────────────────────────────────────
async function calcularFluxo(company, year) {
  const yr = parseInt(year) || new Date().getFullYear();
  const fBase = { status:{ $ne:'cancelado' }, competence:{ $regex:`^${yr}` } };
  if(company) fBase.company = company;

  const txs = await Transaction.find(fBase).select('amount type competence').lean();

  const meses = {};
  for(let m=1; m<=12; m++) {
    const key = `${yr}-${String(m).padStart(2,'0')}`;
    meses[key] = { competence:key, entradas:0, saidas:0, saldo:0 };
  }

  txs.forEach(t => {
    const m = meses[t.competence];
    if(!m) return;
    if(t.type === 'credit') m.entradas = r2(m.entradas + t.amount);
    else                    m.saidas   = r2(m.saidas   + t.amount);
  });

  // Calcula saldo acumulado
  let saldoAcum = 0;
  const resultado = Object.values(meses).map(m => {
    m.saldo   = r2(m.entradas - m.saidas);
    saldoAcum = r2(saldoAcum + m.saldo);
    return { ...m, saldoAcumulado: saldoAcum };
  });

  return resultado;
}

// ── BALANÇO PATRIMONIAL ───────────────────────────────────────
async function calcularBalanco(company, competence, exercicio) {
  const fBase = { status:{ $ne:'cancelado' } };
  if(company)    fBase.company    = company;
  if(competence) fBase.competence = competence;
  else if(exercicio) fBase.competence = { $regex:`^${exercicio}` };

  const txs = await Transaction.find(fBase)
    .select('amount type debitAccount creditAccount').lean();

  const contas = {};
  txs.forEach(t => {
    // Acumula débitos
    if(t.debitAccount) {
      if(!contas[t.debitAccount]) contas[t.debitAccount] = { debitos:0, creditos:0 };
      contas[t.debitAccount].debitos = r2(contas[t.debitAccount].debitos + t.amount);
    }
    // Acumula créditos
    if(t.creditAccount) {
      if(!contas[t.creditAccount]) contas[t.creditAccount] = { debitos:0, creditos:0 };
      contas[t.creditAccount].creditos = r2(contas[t.creditAccount].creditos + t.amount);
    }
  });

  // Agrupa por tipo de conta
  const grupos = { ativo:{}, passivo:{}, patrimonio:{}, receita:{}, custo:{}, despesa:{} };
  Object.entries(contas).forEach(([cod, vals]) => {
    const grpChar = cod.charAt(0);
    const grp = GRUPOS[grpChar];
    if(!grp) return;
    const saldo = grp.natureza === 'devedora'
      ? r2(vals.debitos - vals.creditos)
      : r2(vals.creditos - vals.debitos);
    if(!grupos[grp.tipo]) grupos[grp.tipo] = {};
    grupos[grp.tipo][cod] = { codigo:cod, saldo, debitos:vals.debitos, creditos:vals.creditos, tipo:grp.tipo };
  });

  const somaGrupo = g => Object.values(grupos[g]||{}).reduce((a,c)=>a+c.saldo,0);
  const totalAtivo     = r2(somaGrupo('ativo'));
  const totalPassivo   = r2(somaGrupo('passivo'));
  const totalPL        = r2(somaGrupo('patrimonio'));
  const totalReceitas  = r2(somaGrupo('receita'));
  const totalDespesas  = r2(somaGrupo('despesa') + somaGrupo('custo'));
  const resultadoPeriodo = r2(totalReceitas - totalDespesas);
  const totalPassivoePL  = r2(totalPassivo + totalPL + resultadoPeriodo);

  return {
    ativo:     Object.values(grupos.ativo||{}).sort((a,b)=>a.codigo.localeCompare(b.codigo)),
    passivo:   Object.values(grupos.passivo||{}).sort((a,b)=>a.codigo.localeCompare(b.codigo)),
    patrimonio:Object.values(grupos.patrimonio||{}).sort((a,b)=>a.codigo.localeCompare(b.codigo)),
    totalAtivo,
    totalPassivo,
    totalPL,
    totalPassivoePL,
    resultadoPeriodo,
    diferenca: r2(totalAtivo - totalPassivoePL),
    totalLancamentos: txs.length,
  };
}

// ── BALANCETE DE VERIFICAÇÃO ──────────────────────────────────
async function calcularBalancete(company, competence) {
  const fBase = { status:{ $ne:'cancelado' } };
  if(company)    fBase.company    = company;
  if(competence) fBase.competence = competence;

  const txs = await Transaction.find(fBase).select('amount debitAccount creditAccount').lean();

  const contas = {};
  txs.forEach(t => {
    ['debit','credit'].forEach((lado, idx) => {
      const cod = idx===0 ? t.debitAccount : t.creditAccount;
      if(!cod) return;
      if(!contas[cod]) contas[cod] = { codigo:cod, debitos:0, creditos:0 };
      if(idx===0) contas[cod].debitos  = r2(contas[cod].debitos  + t.amount);
      else        contas[cod].creditos = r2(contas[cod].creditos + t.amount);
    });
  });

  const balancete = Object.values(contas)
    .map(c => ({ ...c, saldo: r2(c.debitos - c.creditos), tipo: GRUPOS[c.codigo.charAt(0)]?.tipo || 'outros' }))
    .sort((a,b) => a.codigo.localeCompare(b.codigo));

  const totais = {
    debitos:  r2(balancete.reduce((a,c)=>a+c.debitos,0)),
    creditos: r2(balancete.reduce((a,c)=>a+c.creditos,0)),
    saldo:    r2(balancete.reduce((a,c)=>a+c.saldo,0)),
  };

  return { balancete, totais };
}

// ── KPIs CONSOLIDADOS ─────────────────────────────────────────
async function calcularKPIs(company, competence) {
  const [dre, fluxo] = await Promise.all([
    calcularDRE(company, competence),
    calcularFluxo(company, new Date().getFullYear()),
  ]);

  const mesAtual = fluxo.find(m => m.competence === competence);

  return {
    receita:        dre.totalReceitas,
    lucroLiquido:   dre.lucroLiquido,
    margemLiquida:  dre.margemLiquida,
    ebitda:         dre.ebitda,
    margemEbitda:   dre.margemEbitda,
    custoPessoal:   dre.custoPessoal,
    headcount:      dre.headcount,
    entradaMes:     mesAtual?.entradas || 0,
    saidaMes:       mesAtual?.saidas   || 0,
    saldoMes:       mesAtual?.saldo    || 0,
    saldoAcumulado: mesAtual?.saldoAcumulado || 0,
  };
}

module.exports = { calcularDRE, calcularFluxo, calcularBalanco, calcularBalancete, calcularKPIs, classificarConta, GRUPOS };
