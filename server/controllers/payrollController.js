// server/controllers/payrollController.js — cálculo automático INSS/IRRF 2025
const Payroll       = require('../models/Payroll');
const autoPosting   = require('../services/autoPostingService');

// ── TABELAS 2025 ──────────────────────────────────────────────
function calcINSS(base) {
  const tabela = [
    { max: 1412.00, aliq: 0.075 },
    { max: 2666.68, aliq: 0.09  },
    { max: 4000.03, aliq: 0.12  },
    { max: 7786.02, aliq: 0.14  },
  ];
  let inss = 0, prev = 0;
  for (const f of tabela) {
    if (base <= prev) break;
    inss += (Math.min(base, f.max) - prev) * f.aliq;
    prev = f.max;
  }
  return Math.round(inss * 100) / 100;
}

function calcIRRF(gross, inss, deps = 0) {
  const base = gross - inss - deps * 189.59;
  if (base <= 0) return 0;
  const tabela = [
    { max: 2259.20,    aliq: 0,     ded: 0       },
    { max: 2826.65,    aliq: 0.075, ded: 169.44  },
    { max: 3751.05,    aliq: 0.15,  ded: 381.44  },
    { max: 4664.68,    aliq: 0.225, ded: 662.77  },
    { max: Infinity,   aliq: 0.275, ded: 896.00  },
  ];
  for (const f of tabela) {
    if (base <= f.max) return Math.max(0, Math.round((base * f.aliq - f.ded) * 100) / 100);
  }
  return 0;
}

function calcularEmployee(emp) {
  const gross = Math.round(((emp.salaryBase||0) + (emp.extraHours||0) + (emp.bonuses||0) +
    (emp.commission||0) + (emp.mealAllowance||0) + (emp.transportAllowance||0) +
    (emp.otherProvents||0) + (emp.salarioFamilia||0)) * 100) / 100;

  const inss      = calcINSS(emp.salaryBase || 0);
  const irrf      = calcIRRF(gross, inss, emp.dependentes || 0);
  const fgts      = Math.round(gross * 0.08 * 100) / 100;
  const inssP     = Math.round(gross * 0.20 * 100) / 100;
  const descontos = inss + irrf + (emp.healthPlan||0) + (emp.advance||0) + (emp.otherDiscount||0);
  const net       = Math.max(0, Math.round((gross - descontos) * 100) / 100);
  const totalCost = Math.round((gross + inssP + fgts) * 100) / 100;

  return {
    ...emp,
    grossSalary:  gross,
    netSalary:    net,
    inssEmployee: inss,
    irrf,
    fgts,
    inssEmployer: inssP,
    fgtsEmployer: fgts,
    totalCost,
  };
}

function calcularTotais(employees) {
  const calc = employees.map(calcularEmployee);
  return {
    employees: calc,
    totalGross:        Math.round(calc.reduce((a,e)=>a+(e.grossSalary||0),0)*100)/100,
    totalNet:          Math.round(calc.reduce((a,e)=>a+(e.netSalary||0),0)*100)/100,
    totalINSSEmployee: Math.round(calc.reduce((a,e)=>a+(e.inssEmployee||0),0)*100)/100,
    totalIRRF:         Math.round(calc.reduce((a,e)=>a+(e.irrf||0),0)*100)/100,
    totalINSSEmployer: Math.round(calc.reduce((a,e)=>a+(e.inssEmployer||0),0)*100)/100,
    totalFGTS:         Math.round(calc.reduce((a,e)=>a+(e.fgts||0),0)*100)/100,
    totalCost:         Math.round(calc.reduce((a,e)=>a+(e.totalCost||0),0)*100)/100,
    headcount:         calc.filter(e=>e.status==='ativo').length,
  };
}

exports.list = async (req, res) => {
  try {
    const { company, competence, status, page=1, limit=20 } = req.query;
    const f = {};
    if (company)    f.company    = company;
    if (competence) f.competence = competence;
    if (status)     f.status     = status;
    const total    = await Payroll.countDocuments(f);
    const payrolls = await Payroll.find(f)
      .populate('company','legalName tradeName cnpj')
      .sort({ competence:-1, createdAt:-1 })
      .skip((+page-1)*+limit).limit(+limit)
      .select('-employees');
    res.json({ success:true, payrolls, pagination:{ total, page:+page, totalPages:Math.ceil(total/+limit), limit:+limit } });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.stats = async (req, res) => {
  try {
    const { competence } = req.query;
    const f = competence ? { competence } : {};
    const payrolls = await Payroll.find(f).select('totalGross totalNet totalINSSEmployee totalIRRF totalFGTS totalCost headcount status');
    const s = { totalPayrolls:payrolls.length, headcount:0, totalGross:0, totalNet:0, totalINSS:0, totalFGTS:0, totalCost:0, byStatus:{rascunho:0,processando:0,fechada:0,paga:0} };
    payrolls.forEach(p=>{
      s.headcount   += p.headcount||0;
      s.totalGross  += p.totalGross||0;
      s.totalNet    += p.totalNet||0;
      s.totalINSS   += (p.totalINSSEmployee||0)+(p.totalINSSEmployer||0);
      s.totalFGTS   += p.totalFGTS||0;
      s.totalCost   += p.totalCost||0;
      if(s.byStatus[p.status]!==undefined) s.byStatus[p.status]++;
    });
    res.json({ success:true, summary:s });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.get = async (req, res) => {
  try {
    const p = await Payroll.findById(req.params.id).populate('company','legalName tradeName cnpj address');
    if (!p) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, payroll:p });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { employees=[], ...rest } = req.body;
    const { employees:calc, ...totais } = calcularTotais(employees);
    const p = await Payroll.create({ ...rest, employees:calc, ...totais, processedBy:req.user._id });
    res.status(201).json({ success:true, message:'Folha criada', payroll:p });
  } catch(e) {
    if (e.code===11000) return res.status(400).json({ success:false, message:'Já existe folha para esta empresa/competência' });
    res.status(500).json({ success:false, message:e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { employees, ...rest } = req.body;
    let upd = { ...rest };
    if (employees) {
      const { employees:calc, ...totais } = calcularTotais(employees);
      upd = { ...upd, employees:calc, ...totais };
    }
    const p = await Payroll.findByIdAndUpdate(req.params.id, upd, { new:true })
      .populate('company','legalName tradeName');
    if (!p) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, message:'Folha atualizada', payroll:p });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.changeStatus = async (req, res) => {
  try {
    const { status, paymentDate, notes } = req.body;
    const upd = { status };
    if (paymentDate) upd.paymentDate = paymentDate;
    if (notes)       upd.notes       = notes;
    if (status==='paga' && !paymentDate) upd.paymentDate = new Date();
    if (['fechada','paga'].includes(status)) upd.closeDate = new Date();
    const p = await Payroll.findByIdAndUpdate(req.params.id, upd, { new:true });
    if (!p) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, message:'Status atualizado', payroll:p });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await Payroll.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Folha removida' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};
