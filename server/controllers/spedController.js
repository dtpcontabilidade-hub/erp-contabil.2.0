// server/controllers/spedController.js
// Geração completa SPED ECD (ECD) e SPED EFD (EFD ICMS/IPI + EFD Contribuições)
// Formato: Ato COTEPE/ICMS 09/08 e IN RFB 1.774/2017
// Transmissão via PVA da Receita Federal (programa validador)

const Transaction  = require('../models/Transaction');
const Escrituracao = require('../models/Escrituracao');
const Company      = require('../models/Company');
const PlanoConta   = require('../models/PlanoConta');
const Payroll      = require('../models/Payroll');

const r2  = v => Math.round((v||0)*100)/100;
const fmt = v => r2(v).toFixed(2);
const fmtData = d => {
  if(!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}${String(dt.getMonth()+1).padStart(2,'0')}${dt.getFullYear()}`;
};
const fmtComp = comp => {
  if(!comp) return '';
  const [ano,mes] = comp.split('-');
  return `${String(mes).padStart(2,'0')}${ano}`;
};
const diasMes = (ano,mes) => new Date(ano,mes,0).getDate();
const cnpjLimpo = cnpj => (cnpj||'').replace(/\D/g,'');
const cepLimpo  = cep  => (cep||'').replace(/\D/g,'');

// ═══════════════════════════════════════════════════════════════
// SPED ECD — Escrituração Contábil Digital
// Regulado pela IN RFB 1.774/2017
// ═══════════════════════════════════════════════════════════════
exports.gerarECD = async (req, res) => {
  try {
    const { company: companyId, competence, exercicio } = req.query;
    if (!companyId) return res.status(400).json({ success:false, message:'Informe a empresa' });

    const ano = exercicio || (competence ? competence.split('-')[0] : new Date().getFullYear().toString());
    const dtIni = `${ano}0101`;
    const dtFim = `${ano}1231`;

    const [company, lancamentos, contas] = await Promise.all([
      Company.findById(companyId),
      Transaction.find({ company:companyId, status:{ $ne:'cancelado' }, competence:{ $regex:`^${ano}` } }).sort({ date:1 }),
      PlanoConta.find({ $or:[{company:companyId},{company:null}] }).sort({ codigo:1 }),
    ]);

    if (!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const cnpj = cnpjLimpo(company.cnpj);
    const now  = new Date();
    const dtGer= `${String(now.getDate()).padStart(2,'0')}${String(now.getMonth()+1).padStart(2,'0')}${now.getFullYear()}`;
    const hrGer= `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;

    const linhas = [];
    let nLin = 1;
    const L = (...campos) => { linhas.push('|'+campos.join('|')+'|'); nLin++; };

    // ── BLOCO 0 — ABERTURA E IDENTIFICAÇÃO ──────────────────────
    // Registro 0000 — Abertura do arquivo
    L('0000','LECD','01','01',dtIni,dtFim,cnpj,company.legalName,
      company.stateReg||'ISENTO',company.cityReg||'',
      '','','N',ano,'0','','','N','','001');

    // Registro 0001 — Abertura do Bloco 0
    L('0001','0');

    // Registro 0007 — Identificação do CNPJ
    L('0007',cnpj);

    // Registro 0020 — Identificação da Filial (se houver)
    // L('0020','MATRIZ','','','');

    // Registro 0035 — Identificação Adicionais
    L('0035',cnpj,{simples:'01',presumido:'05',real:'04',mei:'03',imune:'06'}[company.taxRegime]||'05');

    // Registro 0150 — Tabela de Cadastro do Participante (fornecedores/clientes únicos)
    const participantes = {};
    lancamentos.forEach(l=>{
      if(l.document&&!participantes[l.document]){
        participantes[l.document]={cod:'PART'+String(Object.keys(participantes).length+1).padStart(6,'0'),nome:l.description?.substring(0,60)||'PARTICIPANTE'};
      }
    });
    Object.values(participantes).slice(0,50).forEach(p=>{
      L('0150',p.cod,'','','','',p.nome,'','','','','','','','');
    });

    // Registro 0990 — Encerramento Bloco 0
    const cnt0 = linhas.length + 1;
    L('0990', cnt0.toString());

    // ── BLOCO I — LANÇAMENTOS CONTÁBEIS ─────────────────────────
    L('I001','0');

    // I010 — Informações sobre o Método de Avaliação
    L('I010',company.legalName,'',company.contactName||company.legalName,'','',
      company.address?.city||'','','','','','','');

    // I020 — Lançamentos por período
    let totalDebit = 0, totalCredit = 0;
    const contasUsadas = new Set();

    lancamentos.forEach((l, idx) => {
      const seqLanc = String(idx+1).padStart(6,'0');
      const dt      = fmtData(l.date);
      const hist    = (l.description||'').replace(/\|/g,' ').substring(0,60);
      const vlr     = fmt(l.amount);

      // I200 — Lançamento
      L('I200', seqLanc, dt, hist, vlr, l.debitAccount||'', l.creditAccount||'', '0');

      if(l.debitAccount)  contasUsadas.add(l.debitAccount);
      if(l.creditAccount) contasUsadas.add(l.creditAccount);
      if(l.type==='debit')  totalDebit  += l.amount;
      else                  totalCredit += l.amount;
    });

    // Encerramento I
    const cntI = linhas.length - linhas.findIndex(l=>l.startsWith('|I001|')) + 1;
    L('I990', cntI.toString());

    // ── BLOCO J — DEMONSTRAÇÕES CONTÁBEIS ───────────────────────
    L('J001','0');

    // J005 — Balanço Patrimonial e DRE
    L('J005', dtIni, dtFim, company.legalName, '',
      `Competência: ${ano}`, '','','','','','9');

    // J100 — Plano de Contas Referenciado (contas analíticas usadas)
    contas.filter(c=>contasUsadas.has(c.codigo)||c.nivel<=2).slice(0,200).forEach(c=>{
      const saldo = lancamentos
        .filter(l=>l.debitAccount?.startsWith(c.codigo)||l.creditAccount?.startsWith(c.codigo))
        .reduce((acc,l)=>{
          if(l.debitAccount?.startsWith(c.codigo)) acc+=l.type==='debit'?l.amount:-l.amount;
          if(l.creditAccount?.startsWith(c.codigo)) acc+=l.type==='credit'?l.amount:-l.amount;
          return acc;
        },0);
      L('J100', c.codigo, c.descricao?.substring(0,60)||'',
        {ativo:'01',passivo:'02',patrimonio:'03',receita:'04',custo:'05',despesa:'06',resultado:'07'}[c.tipo]||'09',
        c.natureza==='devedora'?'D':'C',
        fmt(Math.max(0,saldo)), fmt(Math.abs(Math.min(0,saldo))),
        fmt(saldo), '');
    });

    // J800 — Outras Informações
    L('J800','ERP DTP Contábil — Gerado automaticamente','');

    // Encerramento J
    const cntJ = linhas.filter(l=>l.startsWith('|J')).length + 1;
    L('J990', cntJ.toString());

    // ── BLOCO 9 — ENCERRAMENTO ────────────────────────────────
    L('9001','0');
    // 9900 — Registro dos totais por bloco
    const blocos = {'0000':0,'I001':0,'J001':0,'9001':0};
    linhas.forEach(l=>{ const b=l.substring(1,5); if(blocos[b]!==undefined) blocos[b]++; else{ const k=l.substring(1,2); if(!blocos[k+'000']) blocos[k+'000']=0; blocos[k+'000']++; } });
    Object.entries({'0000':linhas.filter(l=>l.startsWith('|0')).length,'I001':linhas.filter(l=>l.startsWith('|I')).length,'J001':linhas.filter(l=>l.startsWith('|J')).length,'9001':4}).forEach(([reg,cnt])=>{
      L('9900', reg, cnt.toString());
    });
    L('9990', '5');
    const totalLinhas = linhas.length + 1;
    L('9999', totalLinhas.toString());

    const conteudo = linhas.join('\r\n') + '\r\n';
    const nomeArq = `SPED_ECD_${cnpj}_${ano}.txt`;

    res.setHeader('Content-Type','text/plain;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="${nomeArq}"`);
    res.setHeader('X-Total-Linhas', totalLinhas.toString());
    res.send('\uFEFF'+conteudo); // BOM UTF-8

  } catch(e) {
    console.error('Erro SPED ECD:', e);
    res.status(500).json({ success:false, message:e.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// SPED EFD — Escrituração Fiscal Digital ICMS/IPI
// Ato COTEPE/ICMS 09/08
// ═══════════════════════════════════════════════════════════════
exports.gerarEFD = async (req, res) => {
  try {
    const { company: companyId, competence } = req.query;
    if (!companyId || !competence) return res.status(400).json({ success:false, message:'Informe empresa e competência' });

    const [ano,mes] = competence.split('-');
    const ultimoDia = diasMes(parseInt(ano),parseInt(mes));
    const dtIni = `01${String(mes).padStart(2,'0')}${ano}`;
    const dtFim = `${String(ultimoDia).padStart(2,'0')}${String(mes).padStart(2,'0')}${ano}`;

    const [company, escrit] = await Promise.all([
      Company.findById(companyId),
      Escrituracao.findOne({ company:companyId, competence, tipo:'fiscal' }),
    ]);

    if (!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const cnpj = cnpjLimpo(company.cnpj);
    const itens = escrit?.itens||[];
    const entradas = itens.filter(i=>i.tipo==='entrada');
    const saidas   = itens.filter(i=>i.tipo==='saida');

    const linhas = [];
    let nLin = 1;
    const L = (...campos) => { linhas.push('|'+campos.join('|')+'|'); nLin++; };

    // ── BLOCO 0 ──────────────────────────────────────────────
    L('0000','003','0',dtIni,dtFim,cnpj,company.legalName,
      company.address?.state||'SC',
      {simples:'07',presumido:'05',real:'03',mei:'07'}[company.taxRegime]||'05',
      '1','1','');
    L('0001','0');
    L('0005',company.legalName,cnpj,company.address?.state||'SC',
      cepLimpo(company.address?.cep||''),
      company.address?.street||'',company.address?.number||'',
      company.address?.complement||'',company.address?.neighborhood||'',
      company.contactName||'',company.phone||'','');
    L('0015',company.address?.state||'SC',company.stateReg||'ISENTO');

    // Participantes (fornecedores/clientes das notas)
    const parts = new Map();
    itens.forEach((nf,i)=>{
      const key = nf.cnpjFornec||nf.fornecedor||`PART${i}`;
      if(!parts.has(key)){
        const cod = `PART${String(parts.size+1).padStart(6,'0')}`;
        parts.set(key,{cod,cnpj:cnpjLimpo(nf.cnpjFornec||''),nome:(nf.fornecedor||'NÃO IDENTIFICADO').substring(0,60)});
        L('0150',cod,'',cnpjLimpo(nf.cnpjFornec||''),
          '','','','',parts.get(key).nome,'','','','','','');
      }
    });

    L('0990', (linhas.length+1).toString());

    // ── BLOCO A — NF-e de Serviços (ISS) ────────────────────
    L('A001','0');
    const nfServicos = saidas.filter(n=>n.iss>0||n.cfop?.startsWith('5.9')||n.cfop?.startsWith('6.9'));
    let seqA=1;
    nfServicos.forEach(nf=>{
      const part = parts.get(nf.cnpjFornec||nf.fornecedor||'');
      L('A010',part?.cod||'PART000001');
      L('A100','S',nf.numero||String(seqA).padStart(6,'0'),nf.serie||'A',
        fmtData(nf.dataEmissao),'','1',nf.cfop||'5.933',
        fmt(nf.valorTotal||0),fmt(nf.iss||0),fmt(nf.valorTotal||0),
        '','','','','','','','','','','');
      seqA++;
    });
    L('A990',(linhas.filter(l=>l.startsWith('|A')).length+1).toString());

    // ── BLOCO C — NF-e de Mercadorias ───────────────────────
    L('C001','0');
    let seqC=1;

    // C100 — Notas de Entrada
    entradas.forEach(nf=>{
      const part = parts.get(nf.cnpjFornec||nf.fornecedor||'');
      L('C100','0',nf.tipo==='entrada'?'0':'1',
        part?.cod||'PART000001',
        nf.numero||String(seqC).padStart(9,'0'),
        nf.serie||'1','','55',nf.cfop||'1.102',
        fmtData(nf.dataEmissao),fmtData(nf.dataEmissao||nf.dataEntrada),
        fmt(nf.valorTotal||0),'','','','','','','','','0');
      // C170 — Item da NF
      L('C170','001',nf.descricao||'MERCADORIA','UN','1',
        fmt(nf.valorTotal||0),'',nf.cfop||'1.102','',
        fmt(nf.baseCalculo||nf.valorTotal||0),
        fmt(nf.aliquota||0),fmt(nf.icms||0),
        nf.cst||'000','','','','','','','',
        fmt(nf.pis||0),fmt(nf.cofins||0),'');
      // C190 — Totalização por CST/CFOP/Alíquota
      L('C190',nf.cst||'000',nf.cfop||'1.102',
        fmt(nf.aliquota||0),fmt(nf.baseCalculo||nf.valorTotal||0),
        fmt(nf.icms||0),'','',fmt(nf.valorTotal||0),'');
      seqC++;
    });

    // C100 — Notas de Saída
    saidas.filter(n=>!(n.iss>0)).forEach(nf=>{
      const part = parts.get(nf.cnpjFornec||nf.fornecedor||'');
      L('C100','1',nf.tipo==='saida'?'1':'0',
        part?.cod||'PART000001',
        nf.numero||String(seqC).padStart(9,'0'),
        nf.serie||'1','','55',nf.cfop||'5.102',
        fmtData(nf.dataEmissao),fmtData(nf.dataEmissao),
        fmt(nf.valorTotal||0),'','','','','','','','','0');
      L('C170','001',nf.descricao||'MERCADORIA','UN','1',
        fmt(nf.valorTotal||0),'',nf.cfop||'5.102','',
        fmt(nf.baseCalculo||nf.valorTotal||0),
        fmt(nf.aliquota||0),fmt(nf.icms||0),
        nf.cst||'000','','','','','','','',
        fmt(nf.pis||0),fmt(nf.cofins||0),'');
      L('C190',nf.cst||'000',nf.cfop||'5.102',
        fmt(nf.aliquota||0),fmt(nf.baseCalculo||nf.valorTotal||0),
        fmt(nf.icms||0),'','',fmt(nf.valorTotal||0),'');
      seqC++;
    });

    L('C990',(linhas.filter(l=>l.startsWith('|C')).length+1).toString());

    // ── BLOCO E — APURAÇÃO ICMS ─────────────────────────────
    L('E001','0');
    const totICMSEnt = entradas.reduce((a,n)=>a+(n.icms||0),0);
    const totICMSSai = saidas.reduce((a,n)=>a+(n.icms||0),0);
    const saldoICMS  = r2(totICMSSai-totICMSEnt);

    L('E100',dtIni,dtFim);
    L('E110',
      fmt(totICMSSai),   // débitos por saídas
      '0.00',            // outros débitos
      '0.00',            // estornos de crédito
      fmt(totICMSEnt),   // créditos por entradas
      '0.00',            // outros créditos
      '0.00',            // estornos de débito
      fmt(Math.max(0,saldoICMS)),   // saldo devedor
      '0.00',
      fmt(Math.max(0,-saldoICMS)), // saldo credor
      '0.00','0.00','0.00','0.00','0.00','0.00','0.00');

    L('E990',(linhas.filter(l=>l.startsWith('|E')).length+1).toString());

    // ── BLOCO G — CONTROLE DO CRÉDITO ICMS (simplificado) ───
    L('G001','1');
    L('G990','2');

    // ── BLOCO H — INVENTÁRIO ─────────────────────────────────
    L('H001','1');
    L('H990','2');

    // ── BLOCO K — CONTROLE DA PRODUÇÃO ───────────────────────
    L('K001','1');
    L('K990','2');

    // ── BLOCO 9 — ENCERRAMENTO ────────────────────────────────
    L('9001','0');
    const totLinhas = linhas.length + 4;
    L('9900','0000',linhas.filter(l=>l.startsWith('|0')).length.toString());
    L('9900','C001',linhas.filter(l=>l.startsWith('|C')).length.toString());
    L('9900','E001',linhas.filter(l=>l.startsWith('|E')).length.toString());
    L('9900','9001','4');
    L('9990','6');
    L('9999',totLinhas.toString());

    const conteudo = linhas.join('\r\n')+'\r\n';
    const nomeArq = `SPED_EFD_${cnpj}_${competence.replace('-','')}.txt`;
    res.setHeader('Content-Type','text/plain;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="${nomeArq}"`);
    res.send('\uFEFF'+conteudo);

  } catch(e) {
    console.error('Erro SPED EFD:', e);
    res.status(500).json({ success:false, message:e.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// SPED EFD-Contribuições — PIS/COFINS
// IN RFB 1.252/2012
// ═══════════════════════════════════════════════════════════════
exports.gerarEFDContrib = async (req, res) => {
  try {
    const { company: companyId, competence } = req.query;
    if (!companyId || !competence) return res.status(400).json({ success:false, message:'Informe empresa e competência' });

    const [ano,mes] = competence.split('-');
    const ultimoDia = diasMes(parseInt(ano),parseInt(mes));
    const dtIni = `01${String(mes).padStart(2,'0')}${ano}`;
    const dtFim = `${String(ultimoDia).padStart(2,'0')}${String(mes).padStart(2,'0')}${ano}`;

    const [company, escrit] = await Promise.all([
      Company.findById(companyId),
      Escrituracao.findOne({ company:companyId, competence, tipo:'fiscal' }),
    ]);
    if (!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const cnpj  = cnpjLimpo(company.cnpj);
    const itens  = escrit?.itens||[];
    const regime = ['simples','mei'].includes(company.taxRegime)?'1':'7'; // 1=cumulativo, 7=não-cumulativo
    const aliqPIS   = regime==='1'?0.65:1.65;
    const aliqCOFINS= regime==='1'?3.00:7.60;

    const linhas = [];
    const L = (...campos) => linhas.push('|'+campos.join('|')+'|');

    L('0000','006','0',dtIni,dtFim,cnpj,company.legalName,
      company.address?.state||'SC','',regime,'','');
    L('0001','0');
    L('0140',cnpj,company.legalName,'',company.address?.state||'SC',
      company.stateReg||'ISENTO','','');
    L('0990',(linhas.length+1).toString());

    // ── BLOCO A — Serviços sujeitos ao ISS ──────────────────
    L('A001','0');
    let seqA=1;
    itens.filter(n=>n.iss>0||n.tipo==='saida').forEach(nf=>{
      L('A010',cnpj);
      L('A100','S',nf.numero||String(seqA++).padStart(6,'0'),nf.serie||'A',
        fmtData(nf.dataEmissao),nf.cfop||'5.933',
        fmt(nf.valorTotal||0),fmt(nf.pis||0),fmt(nf.cofins||0),
        fmt(nf.valorTotal||0),'','','','','','','','','','');
    });
    L('A990',(linhas.filter(l=>l.startsWith('|A')).length+1).toString());

    // ── BLOCO C — NF-e de Mercadorias ───────────────────────
    L('C001','0');
    itens.filter(n=>!n.iss||n.iss===0).forEach((nf,i)=>{
      L('C010',cnpj);
      L('C100',nf.tipo==='entrada'?'0':'1',nf.numero||String(i+1).padStart(9,'0'),
        nf.serie||'1','','55',nf.cfop||'5.102',
        fmtData(nf.dataEmissao),fmt(nf.valorTotal||0),
        fmt(nf.pis||0),fmt(nf.cofins||0),'','','');
      L('C170','001',nf.descricao||'ITEM','UN','1',
        fmt(nf.valorTotal||0),'',nf.cfop||'5.102',
        '50','50',fmt(nf.pis||0),fmt(nf.cofins||0),'','','','');
    });
    L('C990',(linhas.filter(l=>l.startsWith('|C')).length+1).toString());

    // ── BLOCO M — APURAÇÃO PIS/COFINS ─────────────────────
    L('M001','0');
    const totSaidas = itens.filter(n=>n.tipo==='saida').reduce((a,n)=>a+(n.valorTotal||0),0);
    const totPIS    = r2(totSaidas*(aliqPIS/100));
    const totCOFINS = r2(totSaidas*(aliqCOFINS/100));

    // PIS
    L('M100',regime==='1'?'01':'07',fmt(totPIS),'0.00',fmt(totPIS),
      dtIni,dtFim,fmt(totSaidas),'','','','0.00','0.00',fmt(totPIS),'');
    L('M200',fmt(totPIS),'0.00','0.00',fmt(totPIS),'0.00',fmt(totPIS),'');

    // COFINS
    L('M500',regime==='1'?'01':'07',fmt(totCOFINS),'0.00',fmt(totCOFINS),
      dtIni,dtFim,fmt(totSaidas),'','','','0.00','0.00',fmt(totCOFINS),'');
    L('M600',fmt(totCOFINS),'0.00','0.00',fmt(totCOFINS),'0.00',fmt(totCOFINS),'');

    L('M990',(linhas.filter(l=>l.startsWith('|M')).length+1).toString());

    // ── BLOCO P — CPRB (Contribuição Previdenciária) ─────────
    L('P001','1');
    L('P990','2');

    // ── BLOCO 9 ───────────────────────────────────────────────
    L('9001','0');
    const totL = linhas.length + 4;
    L('9900','0000',linhas.filter(l=>l.startsWith('|0')).length.toString());
    L('9900','C001',linhas.filter(l=>l.startsWith('|C')).length.toString());
    L('9900','M001',linhas.filter(l=>l.startsWith('|M')).length.toString());
    L('9900','9001','4');
    L('9990','6');
    L('9999',totL.toString());

    const conteudo = linhas.join('\r\n')+'\r\n';
    const nomeArq = `SPED_EFDContrib_${cnpj}_${competence.replace('-','')}.txt`;
    res.setHeader('Content-Type','text/plain;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="${nomeArq}"`);
    res.send('\uFEFF'+conteudo);

  } catch(e) {
    console.error('Erro SPED EFD-Contrib:', e);
    res.status(500).json({ success:false, message:e.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// ECF — Escrituração Contábil Fiscal (IR/CSLL)
// IN RFB 1.422/2013
// ═══════════════════════════════════════════════════════════════
exports.gerarECF = async (req, res) => {
  try {
    const { company: companyId, exercicio } = req.query;
    if (!companyId) return res.status(400).json({ success:false, message:'Informe a empresa' });

    const ano = exercicio || new Date().getFullYear().toString();
    const [company, lancamentos] = await Promise.all([
      Company.findById(companyId),
      Transaction.find({ company:companyId, status:{ $ne:'cancelado' }, competence:{ $regex:`^${ano}` } }),
    ]);
    if (!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const cnpj = cnpjLimpo(company.cnpj);
    const linhas = [];
    const L = (...campos) => linhas.push('|'+campos.join('|')+'|');

    const receitas  = lancamentos.filter(l=>l.debitAccount?.startsWith('4')||l.category==='Receita Operacional').reduce((a,l)=>a+l.amount,0);
    const despesas  = lancamentos.filter(l=>l.creditAccount?.startsWith('6')||l.category?.includes('Despesa')).reduce((a,l)=>a+l.amount,0);
    const lucro     = r2(receitas-despesas);
    const basePres  = r2(receitas*0.32);
    const irpj      = r2(basePres*0.15);
    const csll      = r2(basePres*0.09);

    L('0000','004','0',`${ano}0101`,`${ano}1231`,
      cnpj,company.legalName,'',company.stateReg||'ISENTO',
      {simples:'05',presumido:'03',real:'02',mei:'07'}[company.taxRegime]||'03',
      '2','S','N');
    L('0001','0');
    L('0010',`${ano}0101`,`${ano}1231`,company.legalName,cnpj);
    L('0990',(linhas.length+1).toString());

    L('C001','0');
    L('C050','0010','CSLL / IRPJ — Apuração '+ano,'',fmt(receitas),'','','');
    L('C051','001',fmt(receitas),'0.00',fmt(lucro));
    L('C990',(linhas.filter(l=>l.startsWith('|C')).length+1).toString());

    L('E001','0');
    L('E010',`${ano}0101`,`${ano}1231`);
    L('E020',fmt(receitas),fmt(basePres),'0.00','0.00',fmt(basePres));
    L('E030',fmt(irpj),'0.00',fmt(irpj),'0.00','0.00',fmt(irpj));
    L('E990',(linhas.filter(l=>l.startsWith('|E')).length+1).toString());

    L('9001','0');
    L('9900','0000',linhas.filter(l=>l.startsWith('|0')).length.toString());
    L('9900','C001',linhas.filter(l=>l.startsWith('|C')).length.toString());
    L('9900','E001',linhas.filter(l=>l.startsWith('|E')).length.toString());
    L('9900','9001','4');
    L('9990','6');
    L('9999',(linhas.length+1).toString());

    const conteudo = linhas.join('\r\n')+'\r\n';
    const nomeArq = `SPED_ECF_${cnpj}_${ano}.txt`;
    res.setHeader('Content-Type','text/plain;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="${nomeArq}"`);
    res.send('\uFEFF'+conteudo);

  } catch(e) {
    res.status(500).json({ success:false, message:e.message });
  }
};
