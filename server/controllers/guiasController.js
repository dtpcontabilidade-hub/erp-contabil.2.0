// server/controllers/guiasController.js
// Geração de guias GPS, DARF, DAS, FGTS Digital
// Gera PDF formatado para impressão e pagamento

const Company  = require('../models/Company');
const Payroll  = require('../models/Payroll');
const Escrituracao = require('../models/Escrituracao');

const r2  = v => Math.round((v||0)*100)/100;
const fmt = (v,dec=2) => r2(v).toFixed(dec).replace('.',',');
const cnpjLimpo = c => (c||'').replace(/\D/g,'');
const cpfLimpo  = c => (c||'').replace(/\D/g,'');
const fmtCNPJ = c => { c=cnpjLimpo(c); return c.length===14?`${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`:c; };
const fmtData = d => { const dt=new Date(d); return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`; };
const compVenc = (comp, diaVenc=20) => {
  const [ano,mes] = comp.split('-');
  const proxMes = parseInt(mes)===12?1:parseInt(mes)+1;
  const proxAno = parseInt(mes)===12?parseInt(ano)+1:parseInt(ano);
  return `${String(diaVenc).padStart(2,'0')}/${String(proxMes).padStart(2,'0')}/${proxAno}`;
};

// HTML base para impressão das guias
const baseHTML = (titulo, corpo) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${titulo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;background:#fff;padding:10mm}
  .guia{border:2px solid #000;max-width:190mm;margin:0 auto}
  .header{background:#1a3a5c;color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center}
  .header-titulo{font-size:14px;font-weight:bold}
  .header-sub{font-size:10px;opacity:.85}
  .header-logo{font-size:18px;font-weight:900;color:#fff}
  .secao{border-bottom:1px solid #ccc;padding:6px 10px}
  .secao:last-child{border-bottom:none}
  .secao-titulo{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-bottom:4px;font-weight:bold}
  .row{display:flex;gap:0}
  .campo{flex:1;padding:4px 6px;border-right:1px solid #ddd}
  .campo:last-child{border-right:none}
  .campo-label{font-size:8px;text-transform:uppercase;color:#777;margin-bottom:2px}
  .campo-valor{font-size:11px;font-weight:bold;color:#000}
  .campo-valor.grande{font-size:14px;color:#1a3a5c}
  .campo-valor.destaque{font-size:16px;font-weight:900;color:#c00}
  .barras{padding:8px 10px;text-align:center;background:#f5f5f5;border-top:2px solid #000}
  .codigo-barras{font-family:'Courier New',monospace;font-size:13px;letter-spacing:2px;font-weight:bold}
  .linha-digitavel{font-family:'Courier New',monospace;font-size:11px;margin-top:4px;color:#333}
  .instrucoes{padding:6px 10px;font-size:9px;color:#555;border-top:1px dashed #ccc;line-height:1.5}
  .recibo{margin-top:6mm;border:1px dashed #999;padding:6px 10px;font-size:10px}
  @media print{body{padding:0}@page{margin:5mm;size:A4}}
</style></head><body>${corpo}</body></html>`;

// ── GPS — Guia da Previdência Social ─────────────────────────
exports.gerarGPS = async (req,res) => {
  try{
    const { company:companyId, competence } = req.query;
    if(!companyId||!competence) return res.status(400).json({ success:false, message:'Informe empresa e competência' });

    const [company, folha] = await Promise.all([
      Company.findById(companyId),
      Payroll.findOne({ company:companyId, competence }),
    ]);
    if(!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const cnpj       = cnpjLimpo(company.cnpj);
    const inssEmpregados = folha?.totalINSSEmployee||0;
    const inssPatronal   = folha?.totalINSSEmployer||0;
    const totalGPS       = r2(inssEmpregados+inssPatronal);
    const vencimento     = compVenc(competence,20);
    const competMes      = (() => { const [a,m]=competence.split('-'); return `${String(m).padStart(2,'0')}/${a}`; })();
    const codPagamento   = '2100'; // Empresa com empregados CLT
    const identificador  = cnpj;

    const corpo = `
    <div class="guia">
      <div class="header">
        <div><div class="header-titulo">GUIA DA PREVIDÊNCIA SOCIAL — GPS</div>
          <div class="header-sub">Previdência Social — Contribuições INSS</div></div>
        <div class="header-logo">INSS</div>
      </div>
      <div class="secao">
        <div class="row">
          <div class="campo" style="flex:2"><div class="campo-label">Identificador (CNPJ/CPF/CEI)</div><div class="campo-valor">${fmtCNPJ(cnpj)}</div></div>
          <div class="campo"><div class="campo-label">Código de Pagamento</div><div class="campo-valor">${codPagamento}</div></div>
          <div class="campo"><div class="campo-label">Competência</div><div class="campo-valor">${competMes}</div></div>
          <div class="campo"><div class="campo-label">Vencimento</div><div class="campo-valor destaque">${vencimento}</div></div>
        </div>
      </div>
      <div class="secao">
        <div class="secao-titulo">Contribuinte</div>
        <div class="row">
          <div class="campo" style="flex:3"><div class="campo-label">Razão Social</div><div class="campo-valor">${company.legalName}</div></div>
          <div class="campo"><div class="campo-label">CNPJ/MF</div><div class="campo-valor">${fmtCNPJ(cnpj)}</div></div>
        </div>
      </div>
      <div class="secao">
        <div class="secao-titulo">Valores da Guia</div>
        <div class="row">
          <div class="campo"><div class="campo-label">INSS Empregados (descontado)</div><div class="campo-valor grande">R$ ${fmt(inssEmpregados)}</div></div>
          <div class="campo"><div class="campo-label">INSS Patronal (20% s/ folha)</div><div class="campo-valor grande">R$ ${fmt(inssPatronal)}</div></div>
          <div class="campo"><div class="campo-label">Outras Entidades/Tercs.</div><div class="campo-valor">R$ 0,00</div></div>
          <div class="campo"><div class="campo-label">Atualização Monetária/Multa/Juros</div><div class="campo-valor">R$ 0,00</div></div>
        </div>
      </div>
      <div class="secao" style="background:#fff8e1">
        <div class="row">
          <div class="campo"><div class="campo-label">TOTAL A PAGAR</div><div class="campo-valor destaque">R$ ${fmt(totalGPS)}</div></div>
          <div class="campo"><div class="campo-label">Nº de Empregados</div><div class="campo-valor">${folha?.headcount||0}</div></div>
          <div class="campo"><div class="campo-label">Total da Folha</div><div class="campo-valor">R$ ${fmt(folha?.totalGross||0)}</div></div>
        </div>
      </div>
      <div class="barras">
        <div class="campo-label" style="font-size:9px;margin-bottom:4px">LINHA DIGITÁVEL</div>
        <div class="linha-digitavel">${codPagamento}${cnpj}${competMes.replace('/','')}</div>
        <div style="font-size:9px;color:#777;margin-top:4px">* Código de barras gerado pelo PVA da Receita Federal</div>
      </div>
      <div class="instrucoes">
        <strong>Instruções:</strong> Pague em qualquer banco até o vencimento. Após o vencimento incide juros SELIC + 0,5% ao mês.
        Guarda este comprovante por 10 anos. Competência: ${competMes}
      </div>
    </div>
    <div class="recibo">
      <strong>AUTENTICAÇÃO BANCÁRIA / RECIBO DE PAGAMENTO</strong><br>
      ${company.legalName} — CNPJ: ${fmtCNPJ(cnpj)} — GPS — Competência: ${competMes} — Valor: R$ ${fmt(totalGPS)}
    </div>`;

    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.setHeader('Content-Disposition',`inline; filename="GPS_${cnpj}_${competence}.html"`);
    res.send(baseHTML(`GPS — ${company.legalName} — ${competMes}`, corpo));
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── DARF — Documento de Arrecadação de Receitas Federais ──────
exports.gerarDARF = async (req,res) => {
  try{
    const { company:companyId, competence, codigoReceita, descricao, valor } = req.query;
    if(!companyId) return res.status(400).json({ success:false, message:'Informe a empresa' });

    const company = await Company.findById(companyId);
    if(!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    // Busca escrituração fiscal para calcular impostos se não informado
    let valorDARF = parseFloat(valor)||0;
    let descDARF  = descricao||'Imposto Federal';
    let codReceita = codigoReceita||'5952';

    if(!valorDARF && competence){
      const escrit = await Escrituracao.findOne({ company:companyId, competence, tipo:'fiscal' });
      const saidas = escrit?.itens?.filter(i=>i.tipo==='saida').reduce((a,i)=>a+i.valorTotal,0)||0;
      const regime = company.taxRegime;
      if(regime==='presumido'||regime==='real'){
        valorDARF = r2(saidas*0.0065+saidas*0.03); // PIS+COFINS simplificado
        descDARF  = 'PIS + COFINS';
        codReceita = '8109';
      }
    }

    const cnpj = cnpjLimpo(company.cnpj);
    const vencimento = competence?compVenc(competence,25):`${String(new Date().getDate()).padStart(2,'0')}/${String(new Date().getMonth()+1).padStart(2,'0')}/${new Date().getFullYear()}`;
    const competMes = competence?(() => { const [a,m]=competence.split('-'); return `${String(m).padStart(2,'0')}/${a}`; })():'';
    const periodoApurac = competMes;

    const corpo = `
    <div class="guia">
      <div class="header">
        <div><div class="header-titulo">DARF — DOCUMENTO DE ARRECADAÇÃO DE RECEITAS FEDERAIS</div>
          <div class="header-sub">Secretaria Especial da Receita Federal do Brasil</div></div>
        <div class="header-logo">RFB</div>
      </div>
      <div class="secao">
        <div class="row">
          <div class="campo" style="flex:3"><div class="campo-label">Nome / Razão Social</div><div class="campo-valor">${company.legalName}</div></div>
          <div class="campo" style="flex:2"><div class="campo-label">CPF / CNPJ</div><div class="campo-valor">${fmtCNPJ(cnpj)}</div></div>
        </div>
      </div>
      <div class="secao">
        <div class="row">
          <div class="campo"><div class="campo-label">Código da Receita</div><div class="campo-valor grande">${codReceita}</div></div>
          <div class="campo"><div class="campo-label">Nº de Referência</div><div class="campo-valor">${cnpj.substring(0,8)}</div></div>
          <div class="campo"><div class="campo-label">Período de Apuração</div><div class="campo-valor">${periodoApurac}</div></div>
          <div class="campo"><div class="campo-label">Data de Vencimento</div><div class="campo-valor destaque">${vencimento}</div></div>
        </div>
      </div>
      <div class="secao">
        <div class="secao-titulo">Discriminação da Receita: ${descDARF}</div>
        <div class="row">
          <div class="campo"><div class="campo-label">01 — Valor do Principal</div><div class="campo-valor grande">R$ ${fmt(valorDARF)}</div></div>
          <div class="campo"><div class="campo-label">02 — Multa</div><div class="campo-valor">R$ 0,00</div></div>
          <div class="campo"><div class="campo-label">03 — Juros / Encargos</div><div class="campo-valor">R$ 0,00</div></div>
        </div>
      </div>
      <div class="secao" style="background:#fff8e1">
        <div class="row">
          <div class="campo"><div class="campo-label">04 — TOTAL A PAGAR</div><div class="campo-valor destaque">R$ ${fmt(valorDARF)}</div></div>
          <div class="campo"><div class="campo-label">Autenticação Bancária</div><div class="campo-valor" style="min-height:24px;border:1px solid #ccc"></div></div>
        </div>
      </div>
      <div class="barras">
        <div class="codigo-barras">${codReceita}${cnpj.substring(0,8)}${periodoApurac.replace('/','')}</div>
        <div style="font-size:9px;color:#777;margin-top:4px">* Para emissão do código de barras utilize o programa SICALC da Receita Federal</div>
      </div>
      <div class="instrucoes">
        <strong>Instruções:</strong> Pague em qualquer banco conveniado até o vencimento. Após o vencimento, utilize o SICALC para calcular os acréscimos legais.
        Guarde este comprovante por 5 anos. Código da receita: ${codReceita} — ${descDARF}
      </div>
    </div>
    <div class="recibo">
      <strong>AUTENTICAÇÃO BANCÁRIA / RECIBO</strong><br>
      ${company.legalName} — CNPJ: ${fmtCNPJ(cnpj)} — Cód. ${codReceita} — ${descDARF} — Competência: ${competMes} — Valor: R$ ${fmt(valorDARF)}
    </div>`;

    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.setHeader('Content-Disposition',`inline; filename="DARF_${codReceita}_${cnpj}_${competence||'avulso'}.html"`);
    res.send(baseHTML(`DARF ${codReceita} — ${company.legalName}`, corpo));
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── DAS — Documento de Arrecadação do Simples Nacional ────────
exports.gerarDAS = async (req,res) => {
  try{
    const { company:companyId, competence } = req.query;
    if(!companyId||!competence) return res.status(400).json({ success:false, message:'Informe empresa e competência' });

    const [company, escrit] = await Promise.all([
      Company.findById(companyId),
      Escrituracao.findOne({ company:companyId, competence, tipo:'fiscal' }),
    ]);
    if(!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });
    if(!['simples','mei'].includes(company.taxRegime))
      return res.status(400).json({ success:false, message:'DAS é exclusivo para Simples Nacional e MEI' });

    const cnpj = cnpjLimpo(company.cnpj);
    const isMEI = company.taxRegime==='mei';
    const saidas = escrit?.itens?.filter(i=>i.tipo==='saida').reduce((a,i)=>a+i.valorTotal,0)||0;
    const aliqDAS = isMEI?0:0.06; // 6% simplificado Simples
    const valDAS  = isMEI?70.60:r2(saidas*aliqDAS); // MEI valor fixo 2025
    const vencimento = compVenc(competence,20);
    const competMes = (() => { const [a,m]=competence.split('-'); return `${String(m).padStart(2,'0')}/${a}`; })();
    const numDAS = `DAS${cnpj}${competence.replace('-','')}${String(Math.floor(Math.random()*999999)).padStart(6,'0')}`;

    const corpo = `
    <div class="guia">
      <div class="header">
        <div><div class="header-titulo">DAS — DOCUMENTO DE ARRECADAÇÃO DO SIMPLES NACIONAL</div>
          <div class="header-sub">${isMEI?'MEI — Microempreendedor Individual':'Simples Nacional — LC 123/2006'}</div></div>
        <div class="header-logo">SN</div>
      </div>
      <div class="secao">
        <div class="row">
          <div class="campo" style="flex:3"><div class="campo-label">Razão Social / Nome Empresarial</div><div class="campo-valor">${company.legalName}</div></div>
          <div class="campo" style="flex:2"><div class="campo-label">CNPJ</div><div class="campo-valor">${fmtCNPJ(cnpj)}</div></div>
        </div>
      </div>
      <div class="secao">
        <div class="row">
          <div class="campo"><div class="campo-label">Nº do DAS</div><div class="campo-valor">${numDAS}</div></div>
          <div class="campo"><div class="campo-label">PA — Período de Apuração</div><div class="campo-valor grande">${competMes}</div></div>
          <div class="campo"><div class="campo-label">Data Vencimento</div><div class="campo-valor destaque">${vencimento}</div></div>
        </div>
      </div>
      <div class="secao">
        <div class="secao-titulo">Composição do DAS</div>
        <div class="row">
          <div class="campo"><div class="campo-label">Receita Bruta Apurada</div><div class="campo-valor">R$ ${fmt(saidas)}</div></div>
          <div class="campo"><div class="campo-label">Alíquota Efetiva</div><div class="campo-valor">${isMEI?'Fixo':fmt(aliqDAS*100,2)+'%'}</div></div>
          <div class="campo"><div class="campo-label">Tributos Incluídos</div><div class="campo-valor">${isMEI?'INSS+ISS ou ICMS':'IRPJ/CSLL/PIS/COFINS/CPP/ISS ou ICMS'}</div></div>
        </div>
        ${isMEI?`<div class="row" style="margin-top:6px">
          <div class="campo"><div class="campo-label">INSS (fixo)</div><div class="campo-valor">R$ 66,00</div></div>
          <div class="campo"><div class="campo-label">ICMS (se Comércio/Indústria)</div><div class="campo-valor">R$ 1,00</div></div>
          <div class="campo"><div class="campo-label">ISS (se Serviços)</div><div class="campo-valor">R$ 5,00</div></div>
        </div>`:''}
      </div>
      <div class="secao" style="background:#fff8e1">
        <div class="row">
          <div class="campo"><div class="campo-label">VALOR TOTAL DO DAS</div><div class="campo-valor destaque">R$ ${fmt(valDAS)}</div></div>
          <div class="campo"><div class="campo-label">Multa / Juros</div><div class="campo-valor">R$ 0,00</div></div>
          <div class="campo"><div class="campo-label">Total com Acréscimos</div><div class="campo-valor grande">R$ ${fmt(valDAS)}</div></div>
        </div>
      </div>
      <div class="barras">
        <div class="campo-label" style="font-size:9px;margin-bottom:4px">CÓDIGO DE BARRAS</div>
        <div class="codigo-barras">${cnpj.substring(0,14)}${competMes.replace('/','')}</div>
        <div style="font-size:9px;color:#777;margin-top:4px">* Para emissão do DAS definitivo acesse: www8.receita.fazenda.gov.br/SimplesNacional</div>
      </div>
      <div class="instrucoes">
        <strong>Instruções:</strong> O DAS deve ser pago até o dia 20 do mês seguinte ao período de apuração.
        Emita o DAS definitivo no Portal do Simples Nacional (PGDAS-D). Este documento é apenas uma pré-visualização.
        ${isMEI?'MEI: parcela mensal fixa de R$ 70,60 (2025) — INSS R$ 66,00 + ICMS R$ 1,00 ou ISS R$ 5,00.':''}
      </div>
    </div>
    <div class="recibo">
      <strong>AUTENTICAÇÃO BANCÁRIA / RECIBO</strong><br>
      ${company.legalName} — CNPJ: ${fmtCNPJ(cnpj)} — DAS ${isMEI?'MEI':'Simples'} — PA: ${competMes} — Valor: R$ ${fmt(valDAS)}
    </div>`;

    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.setHeader('Content-Disposition',`inline; filename="DAS_${cnpj}_${competence}.html"`);
    res.send(baseHTML(`DAS ${isMEI?'MEI':'Simples Nacional'} — ${company.legalName} — ${competMes}`, corpo));
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── FGTS — Guia FGTS Digital ─────────────────────────────────
exports.gerarFGTS = async (req,res) => {
  try{
    const { company:companyId, competence } = req.query;
    if(!companyId||!competence) return res.status(400).json({ success:false, message:'Informe empresa e competência' });

    const [company, folha] = await Promise.all([
      Company.findById(companyId),
      Payroll.findOne({ company:companyId, competence }),
    ]);
    if(!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const cnpj    = cnpjLimpo(company.cnpj);
    const valFGTS = folha?.totalFGTS||0;
    const venc    = compVenc(competence,7); // FGTS vence dia 7
    const competMes = (() => { const [a,m]=competence.split('-'); return `${String(m).padStart(2,'0')}/${a}`; })();

    const corpo = `
    <div class="guia">
      <div class="header">
        <div><div class="header-titulo">FGTS DIGITAL — GUIA DE RECOLHIMENTO</div>
          <div class="header-sub">Fundo de Garantia do Tempo de Serviço — Caixa Econômica Federal</div></div>
        <div class="header-logo">CAIXA</div>
      </div>
      <div class="secao">
        <div class="row">
          <div class="campo" style="flex:3"><div class="campo-label">Razão Social</div><div class="campo-valor">${company.legalName}</div></div>
          <div class="campo" style="flex:2"><div class="campo-label">CNPJ</div><div class="campo-valor">${fmtCNPJ(cnpj)}</div></div>
        </div>
      </div>
      <div class="secao">
        <div class="row">
          <div class="campo"><div class="campo-label">Competência</div><div class="campo-valor grande">${competMes}</div></div>
          <div class="campo"><div class="campo-label">Vencimento</div><div class="campo-valor destaque">${venc}</div></div>
          <div class="campo"><div class="campo-label">Nº Empregados</div><div class="campo-valor">${folha?.headcount||0}</div></div>
          <div class="campo"><div class="campo-label">Total da Folha</div><div class="campo-valor">R$ ${fmt(folha?.totalGross||0)}</div></div>
        </div>
      </div>
      <div class="secao">
        ${(folha?.employees||[]).slice(0,10).map(e=>`
          <div class="row" style="border-bottom:1px solid #eee;padding:3px 0">
            <div class="campo" style="flex:3"><div class="campo-label">${e.name}</div><div class="campo-valor" style="font-size:10px">${e.cpf||'—'} · ${e.pis||'—'}</div></div>
            <div class="campo"><div class="campo-label">Salário Bruto</div><div class="campo-valor" style="font-size:10px">R$ ${fmt(e.grossSalary||0)}</div></div>
            <div class="campo"><div class="campo-label">FGTS (8%)</div><div class="campo-valor" style="font-size:10px;color:#c00">R$ ${fmt(e.fgts||0)}</div></div>
          </div>`).join('')}
      </div>
      <div class="secao" style="background:#fff8e1">
        <div class="row">
          <div class="campo"><div class="campo-label">TOTAL FGTS A RECOLHER</div><div class="campo-valor destaque">R$ ${fmt(valFGTS)}</div></div>
          <div class="campo"><div class="campo-label">Juros/Atualização</div><div class="campo-valor">R$ 0,00</div></div>
          <div class="campo"><div class="campo-label">Multa</div><div class="campo-valor">R$ 0,00</div></div>
        </div>
      </div>
      <div class="barras">
        <div class="codigo-barras">${cnpj}${competMes.replace('/','')}</div>
        <div style="font-size:9px;color:#777;margin-top:4px">* Acesse fgts.caixa.gov.br para emitir a guia definitiva com código de barras</div>
      </div>
      <div class="instrucoes">
        <strong>Instruções:</strong> O FGTS deve ser recolhido até o dia 7 do mês seguinte.
        Acesse o FGTS Digital (fgts.caixa.gov.br) com certificado digital para emitir a guia definitiva.
        Multa por atraso: 10% sobre o valor + atualização SELIC.
      </div>
    </div>`;

    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.setHeader('Content-Disposition',`inline; filename="FGTS_${cnpj}_${competence}.html"`);
    res.send(baseHTML(`FGTS Digital — ${company.legalName} — ${competMes}`, corpo));
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── RELATÓRIO PGDAS ───────────────────────────────────────────
exports.relatorioPGDAS = async (req,res) => {
  try{
    const { company:companyId, competence } = req.query;
    if(!companyId||!competence) return res.status(400).json({ success:false, message:'Informe empresa e competência' });

    const [company, escrit] = await Promise.all([
      Company.findById(companyId),
      Escrituracao.findOne({ company:companyId, competence, tipo:'fiscal' }),
    ]);
    if(!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const cnpj = cnpjLimpo(company.cnpj);
    const saidas = escrit?.itens?.filter(i=>i.tipo==='saida').reduce((a,i)=>a+i.valorTotal,0)||0;
    const competMes = (() => { const [a,m]=competence.split('-'); return `${String(m).padStart(2,'0')}/${a}`; })();

    // Cálculo simplificado Simples Nacional 2025 — Anexo III (Serviços)
    const faixas = [
      {ate:180000,aliq:0.06,ded:0},
      {ate:360000,aliq:0.112,ded:9360},
      {ate:720000,aliq:0.135,ded:17640},
      {ate:1800000,aliq:0.16,ded:35640},
      {ate:3600000,aliq:0.21,ded:125640},
      {ate:4800000,aliq:0.33,ded:648000},
    ];
    const rbt12 = saidas*12; // estimativa
    const faixa = faixas.find(f=>rbt12<=f.ate)||faixas[faixas.length-1];
    const aliqEfetiva = rbt12>0?Math.max(0,(rbt12*faixa.aliq-faixa.ded)/rbt12):faixa.aliq;
    const valDAS = r2(saidas*aliqEfetiva);

    const corpo = `
    <div class="guia">
      <div class="header">
        <div><div class="header-titulo">PGDAS-D — RELATÓRIO DE APURAÇÃO SIMPLES NACIONAL</div>
          <div class="header-sub">Programa Gerador do DAS — Declaração Mensal</div></div>
        <div class="header-logo">SN</div>
      </div>
      <div class="secao">
        <div class="row">
          <div class="campo" style="flex:3"><div class="campo-label">Razão Social</div><div class="campo-valor">${company.legalName}</div></div>
          <div class="campo"><div class="campo-label">CNPJ</div><div class="campo-valor">${fmtCNPJ(cnpj)}</div></div>
          <div class="campo"><div class="campo-label">Período de Apuração</div><div class="campo-valor grande">${competMes}</div></div>
        </div>
      </div>
      <div class="secao">
        <div class="secao-titulo">Receitas por Faixa de Tributação</div>
        <div class="row">
          <div class="campo"><div class="campo-label">Receita Bruta do Mês</div><div class="campo-valor grande">R$ ${fmt(saidas)}</div></div>
          <div class="campo"><div class="campo-label">RBT12 Estimada</div><div class="campo-valor">R$ ${fmt(rbt12)}</div></div>
          <div class="campo"><div class="campo-label">Faixa</div><div class="campo-valor">${faixas.indexOf(faixa)+1}ª (até R$ ${fmt(faixa.ate/1000)}k)</div></div>
          <div class="campo"><div class="campo-label">Alíquota Nominal</div><div class="campo-valor">${fmt(faixa.aliq*100)}%</div></div>
        </div>
      </div>
      <div class="secao">
        <div class="secao-titulo">Partilha dos Tributos</div>
        <div class="row">
          <div class="campo"><div class="campo-label">IRPJ</div><div class="campo-valor">${fmt(valDAS*0.04)}</div></div>
          <div class="campo"><div class="campo-label">CSLL</div><div class="campo-valor">${fmt(valDAS*0.035)}</div></div>
          <div class="campo"><div class="campo-label">COFINS</div><div class="campo-valor">${fmt(valDAS*0.1282)}</div></div>
          <div class="campo"><div class="campo-label">PIS</div><div class="campo-valor">${fmt(valDAS*0.0278)}</div></div>
          <div class="campo"><div class="campo-label">CPP</div><div class="campo-valor">${fmt(valDAS*0.435)}</div></div>
          <div class="campo"><div class="campo-label">ISS</div><div class="campo-valor">${fmt(valDAS*0.335)}</div></div>
        </div>
      </div>
      <div class="secao" style="background:#fff8e1">
        <div class="row">
          <div class="campo"><div class="campo-label">Alíquota Efetiva</div><div class="campo-valor grande">${fmt(aliqEfetiva*100,4)}%</div></div>
          <div class="campo"><div class="campo-label">TOTAL DAS</div><div class="campo-valor destaque">R$ ${fmt(valDAS)}</div></div>
          <div class="campo"><div class="campo-label">Vencimento</div><div class="campo-valor destaque">${compVenc(competence,20)}</div></div>
        </div>
      </div>
      <div style="padding:8px 10px;font-size:9px;background:#e8f4fd;border-top:1px solid #b3d9f7">
        ⚠️ <strong>Este é um relatório de pré-apuração.</strong> Para transmissão oficial, acesse o PGDAS-D no Portal do Simples Nacional:
        <strong>www8.receita.fazenda.gov.br/SimplesNacional</strong> com certificado digital ou código de acesso.
      </div>
    </div>`;

    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.setHeader('Content-Disposition',`inline; filename="PGDAS_${cnpj}_${competence}.html"`);
    res.send(baseHTML(`PGDAS-D — ${company.legalName} — ${competMes}`, corpo));
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};
