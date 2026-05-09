// server/controllers/relatoriosController.js
// Relatórios unificados — alimentados pelo contabilidadeEngine
// Substitui os endpoints isolados de DRE/Fluxo/Balancete

const engine = require('../services/contabilidadeEngine');
const Company = require('../models/Company');

// ── DRE UNIFICADA ─────────────────────────────────────────────
exports.dre = async (req, res) => {
  try {
    const { company, competence, exercicio } = req.query;
    const dre = await engine.calcularDRE(company, competence, exercicio);

    // Enriquece com dados da empresa
    let coData = null;
    if(company) {
      coData = await Company.findById(company).select('legalName tradeName cnpj taxRegime');
    }

    res.json({ success:true, dre, company:coData });
  } catch(e) {
    console.error('DRE Error:', e);
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── FLUXO DE CAIXA ────────────────────────────────────────────
exports.fluxo = async (req, res) => {
  try {
    const { company, year } = req.query;
    const fluxo = await engine.calcularFluxo(company, year);
    res.json({ success:true, fluxo });
  } catch(e) {
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── BALANÇO PATRIMONIAL ───────────────────────────────────────
exports.balanco = async (req, res) => {
  try {
    const { company, competence, exercicio } = req.query;
    const bp = await engine.calcularBalanco(company, competence, exercicio);
    let coData = null;
    if(company) coData = await Company.findById(company).select('legalName tradeName cnpj taxRegime');
    res.json({ success:true, balanco:bp, company:coData });
  } catch(e) {
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── BALANCETE DE VERIFICAÇÃO ──────────────────────────────────
exports.balancete = async (req, res) => {
  try {
    const { company, competence } = req.query;
    const bal = await engine.calcularBalancete(company, competence);
    res.json({ success:true, ...bal });
  } catch(e) {
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── KPIs CONSOLIDADOS ─────────────────────────────────────────
exports.kpis = async (req, res) => {
  try {
    const { company, competence } = req.query;
    const kpis = await engine.calcularKPIs(company, competence);
    res.json({ success:true, kpis });
  } catch(e) {
    res.status(500).json({ success:false, message:e.message });
  }
};

// ── DASHBOARD GERENCIAL CONSOLIDADO ──────────────────────────
exports.dashboard = async (req, res) => {
  try {
    const { company, competence } = req.query;
    const now = new Date();
    const comp = competence || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const yr   = comp.split('-')[0];

    const [dre, fluxo, bp] = await Promise.all([
      engine.calcularDRE(company, comp),
      engine.calcularFluxo(company, yr),
      engine.calcularBalanco(company, null, yr),
    ]);

    // Calcula variações MoM
    const mesIdx = parseInt(comp.split('-')[1]) - 1;
    const mesAtual  = fluxo[mesIdx];
    const mesAnter  = mesIdx > 0 ? fluxo[mesIdx-1] : null;
    const varEntrada = mesAnter?.entradas > 0
      ? Math.round((mesAtual.entradas - mesAnter.entradas)/mesAnter.entradas*100) : 0;

    // Top 5 receitas e despesas
    const topReceitas = dre.receitas.slice(0,5);
    const topDespesas = dre.despesas.slice(0,5);

    res.json({
      success: true,
      competence: comp,
      dre: {
        totalReceitas:   dre.totalReceitas,
        totalCustos:     dre.totalCustos,
        totalDespesas:   dre.totalDespesas,
        lucroBruto:      dre.lucroBruto,
        ebitda:          dre.ebitda,
        lucroLiquido:    dre.lucroLiquido,
        margemBruta:     dre.margemBruta,
        margemEbitda:    dre.margemEbitda,
        margemLiquida:   dre.margemLiquida,
        topReceitas,
        topDespesas,
      },
      fluxo: {
        mesAtual,
        varEntrada,
        acumuladoAno: fluxo.slice(0, mesIdx+1).reduce((a,m)=>a+m.saldo, 0),
        historico12: fluxo,
      },
      balanco: {
        totalAtivo:    bp.totalAtivo,
        totalPassivo:  bp.totalPassivo,
        totalPL:       bp.totalPL,
        resultado:     bp.resultadoPeriodo,
        diferenca:     bp.diferenca,
      },
      rh: {
        headcount:     dre.headcount,
        custoPessoal:  dre.custoPessoal,
        percentFolha:  dre.totalReceitas > 0
          ? Math.round(dre.custoPessoal/dre.totalReceitas*100) : 0,
      },
    });
  } catch(e) {
    console.error('Dashboard Error:', e);
    res.status(500).json({ success:false, message:e.message });
  }
};
