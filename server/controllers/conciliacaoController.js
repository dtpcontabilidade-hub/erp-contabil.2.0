// server/controllers/conciliacaoController.js
// Conciliação Bancária — importação OFX/CSV e matching automático
const mongoose = require('mongoose');

// Model inline para conciliação
const ConciliacaoSchema = new mongoose.Schema({
  company:    { type: mongoose.Schema.Types.ObjectId, ref:'Company', required:true },
  competence: { type: String, required:true },
  conta:      String,
  banco:      String,
  agencia:    String,
  saldoInicial:  { type: Number, default:0 },
  saldoFinal:    { type: Number, default:0 },
  saldoContabil: { type: Number, default:0 },
  diferenca:     { type: Number, default:0 },
  status: { type:String, enum:['aberta','conciliada','revisao'], default:'aberta' },
  extrato:[ {
    data:Date, historico:String, valor:Number,
    tipo:{ type:String, enum:['credito','debito'] },
    documento:String, saldo:Number,
    conciliado:{ type:Boolean, default:false },
    lancamentoId:{ type:mongoose.Schema.Types.ObjectId, ref:'Transaction' },
  }],
  observacao:String,
  createdBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User' },
},{ timestamps:true });

const Conciliacao = mongoose.models.Conciliacao || mongoose.model('Conciliacao', ConciliacaoSchema);
const Transaction = require('../models/Transaction');

// ── LIST ──────────────────────────────────────────────────────
exports.list = async (req,res) => {
  try{
    const { company, competence } = req.query;
    const f={};
    if(company)    f.company    = company;
    if(competence) f.competence = competence;
    const items = await Conciliacao.find(f)
      .populate('company','legalName tradeName')
      .sort({ competence:-1 })
      .select('-extrato');
    res.json({ success:true, items });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── GET ───────────────────────────────────────────────────────
exports.get = async (req,res) => {
  try{
    const item = await Conciliacao.findById(req.params.id)
      .populate('company','legalName tradeName cnpj')
      .populate('extrato.lancamentoId','description amount type debitAccount creditAccount');
    if(!item) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, item });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── CREATE ────────────────────────────────────────────────────
exports.create = async (req,res) => {
  try{
    const item = await Conciliacao.create({ ...req.body, createdBy:req.user._id });
    res.status(201).json({ success:true, message:'Conciliação criada', item });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── IMPORTAR OFX ──────────────────────────────────────────────
exports.importarOFX = async (req,res) => {
  try{
    const { conciliacaoId } = req.params;
    const { conteudo } = req.body; // string OFX/QIF raw
    if(!conteudo) return res.status(400).json({ success:false, message:'Conteúdo OFX obrigatório' });

    const transacoes = parseOFX(conteudo);
    if(!transacoes.length) return res.status(400).json({ success:false, message:'Nenhuma transação encontrada no arquivo' });

    const conc = await Conciliacao.findById(conciliacaoId);
    if(!conc) return res.status(404).json({ success:false, message:'Conciliação não encontrada' });

    // Adiciona transações do extrato
    conc.extrato = transacoes.map(t=>({
      data:t.data, historico:t.historico,
      valor:Math.abs(t.valor), tipo:t.valor>=0?'credito':'debito',
      documento:t.id, saldo:0, conciliado:false,
    }));

    // Calcula saldos acumulados
    let saldo = conc.saldoInicial||0;
    conc.extrato.forEach(e=>{
      saldo = e.tipo==='credito'?saldo+e.valor:saldo-e.valor;
      e.saldo=Math.round(saldo*100)/100;
    });
    conc.saldoFinal = Math.round(saldo*100)/100;

    await conc.save();
    res.json({ success:true, message:`${transacoes.length} lançamentos importados`, total:transacoes.length, item:conc });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── IMPORTAR CSV ──────────────────────────────────────────────
exports.importarCSV = async (req,res) => {
  try{
    const { conciliacaoId } = req.params;
    const { linhas, mapeamento } = req.body;
    // mapeamento: { data:0, historico:1, valor:2, tipo:3 } (índices das colunas)
    if(!linhas?.length) return res.status(400).json({ success:false, message:'Sem dados' });

    const map = mapeamento||{ data:0, historico:1, valor:2 };
    const transacoes = linhas.map(cols=>{
      const vlr = parseFloat((cols[map.valor]||'0').replace('.','').replace(',','.'));
      return {
        data:   new Date(cols[map.data]),
        historico: cols[map.historico]||'',
        valor:  vlr,
        tipo:   vlr>=0?'credito':'debito',
        id:     '',
      };
    }).filter(t=>!isNaN(t.data.getTime())&&t.valor!==0);

    const conc = await Conciliacao.findById(conciliacaoId);
    if(!conc) return res.status(404).json({ success:false, message:'Não encontrada' });

    conc.extrato = transacoes.map(t=>({
      data:t.data, historico:t.historico,
      valor:Math.abs(t.valor), tipo:t.tipo,
      documento:t.id, saldo:0, conciliado:false,
    }));
    let saldo = conc.saldoInicial||0;
    conc.extrato.forEach(e=>{
      saldo = e.tipo==='credito'?saldo+e.valor:saldo-e.valor;
      e.saldo=Math.round(saldo*100)/100;
    });
    conc.saldoFinal = Math.round(saldo*100)/100;
    await conc.save();
    res.json({ success:true, message:`${transacoes.length} lançamentos importados`, total:transacoes.length });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── MATCHING AUTOMÁTICO ───────────────────────────────────────
exports.matchAutomatico = async (req,res) => {
  try{
    const conc = await Conciliacao.findById(req.params.conciliacaoId);
    if(!conc) return res.status(404).json({ success:false, message:'Não encontrada' });

    // Busca lançamentos contábeis do mesmo período
    const [ano,mes] = conc.competence.split('-');
    const dtIni = new Date(parseInt(ano),parseInt(mes)-1,1);
    const dtFim = new Date(parseInt(ano),parseInt(mes),0,23,59,59);
    const lancamentos = await Transaction.find({
      company: conc.company,
      date:{ $gte:dtIni, $lte:dtFim },
      status:{ $ne:'cancelado' },
    });

    let matched = 0;
    // Tenta fazer match por valor + data (tolerância ±1 dia)
    conc.extrato.forEach(ext=>{
      if(ext.conciliado) return;
      const dataExt = new Date(ext.data);
      const match = lancamentos.find(l=>{
        const dataLanc = new Date(l.date);
        const diffDias = Math.abs(dataExt-dataLanc)/(1000*60*60*24);
        const valorOk  = Math.abs(l.amount - ext.valor) < 0.02;
        const tipoOk   = (ext.tipo==='credito'&&l.type==='credit')||(ext.tipo==='debito'&&l.type==='debit');
        return diffDias<=1 && valorOk && tipoOk;
      });
      if(match){
        ext.conciliado    = true;
        ext.lancamentoId  = match._id;
        matched++;
      }
    });

    // Calcula diferença
    const totExtrato  = conc.extrato.reduce((a,e)=>e.tipo==='credito'?a+e.valor:a-e.valor,conc.saldoInicial||0);
    const totContabil = lancamentos.reduce((a,l)=>l.type==='credit'?a+l.amount:a-l.amount,0);
    conc.saldoFinal    = Math.round(totExtrato*100)/100;
    conc.saldoContabil = Math.round(totContabil*100)/100;
    conc.diferenca     = Math.round((totExtrato-totContabil)*100)/100;
    if(Math.abs(conc.diferenca)<0.02) conc.status='conciliada';

    await conc.save();
    res.json({ success:true, message:`${matched} lançamentos conciliados automaticamente`, matched, total:conc.extrato.length, diferenca:conc.diferenca });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── CONCILIAR ITEM MANUAL ─────────────────────────────────────
exports.conciliarItem = async (req,res) => {
  try{
    const { conciliacaoId, itemId } = req.params;
    const { lancamentoId, conciliado } = req.body;
    const conc = await Conciliacao.findById(conciliacaoId);
    if(!conc) return res.status(404).json({ success:false, message:'Não encontrada' });
    const item = conc.extrato.id(itemId);
    if(!item) return res.status(404).json({ success:false, message:'Item não encontrado' });
    item.conciliado   = conciliado!==false;
    item.lancamentoId = lancamentoId||null;
    // Recalcula diferença
    const nConc = conc.extrato.filter(e=>!e.conciliado).reduce((a,e)=>e.tipo==='credito'?a+e.valor:a-e.valor,0);
    conc.diferenca = Math.round(nConc*100)/100;
    if(Math.abs(conc.diferenca)<0.02) conc.status='conciliada';
    await conc.save();
    res.json({ success:true, message:'Item conciliado', item });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── RELATÓRIO CONCILIAÇÃO ─────────────────────────────────────
exports.relatorio = async (req,res) => {
  try{
    const conc = await Conciliacao.findById(req.params.conciliacaoId)
      .populate('company','legalName tradeName cnpj');
    if(!conc) return res.status(404).json({ success:false, message:'Não encontrada' });
    const naoConc = conc.extrato.filter(e=>!e.conciliado);
    const concil  = conc.extrato.filter(e=>e.conciliado);
    res.json({ success:true, relatorio:{
      empresa:     conc.company,
      competence:  conc.competence,
      banco:       conc.banco, conta:conc.conta,
      saldoInicial:conc.saldoInicial,
      saldoFinal:  conc.saldoFinal,
      saldoContabil:conc.saldoContabil,
      diferenca:   conc.diferenca,
      status:      conc.status,
      totalItens:  conc.extrato.length,
      conciliados: concil.length,
      naoConc:     naoConc.length,
      itensPendentes: naoConc,
    }});
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── PARSER OFX ────────────────────────────────────────────────
function parseOFX(conteudo){
  const transacoes = [];
  // Suporte a OFX legado (SGML) e OFX moderno (XML)
  const isXML = conteudo.trim().startsWith('<?xml')||conteudo.includes('<OFX>');
  if(isXML){
    // XML moderno
    const stmtTrn = conteudo.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g)||[];
    stmtTrn.forEach(bloco=>{
      const get=(tag)=>{ const m=bloco.match(new RegExp(`<${tag}>([^<]+)`)); return m?m[1].trim():''; };
      const vlr = parseFloat(get('TRNAMT').replace(',','.'));
      const dtRaw = get('DTPOSTED');
      const data = new Date(`${dtRaw.substring(0,4)}-${dtRaw.substring(4,6)}-${dtRaw.substring(6,8)}`);
      transacoes.push({ id:get('FITID'), historico:get('MEMO')||get('NAME'), valor:vlr, data });
    });
  } else {
    // SGML legado
    const blocos = conteudo.split('<STMTTRN>').slice(1);
    blocos.forEach(bloco=>{
      const get=(tag)=>{ const m=bloco.match(new RegExp(`<${tag}>([^\\n\\r<]+)`)); return m?m[1].trim():''; };
      const vlr = parseFloat(get('TRNAMT').replace(',','.'));
      const dtRaw = get('DTPOSTED');
      const data = new Date(`${dtRaw.substring(0,4)}-${dtRaw.substring(4,6)}-${dtRaw.substring(6,8)}`);
      if(!isNaN(data.getTime())&&vlr!==0) transacoes.push({ id:get('FITID'), historico:get('MEMO')||get('NAME'), valor:vlr, data });
    });
  }
  return transacoes;
}
