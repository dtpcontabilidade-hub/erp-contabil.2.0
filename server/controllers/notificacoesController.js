// server/controllers/notificacoesController.js
// Sistema de notificações por e-mail — vencimentos, obrigações, honorários
// Usa Nodemailer com transporte SMTP configurável

const mongoose = require('mongoose');
const Company  = require('../models/Company');
const Duty     = require('../models/Duty');
const Payroll  = require('../models/Payroll');
const User     = require('../models/User');

// Config de e-mail (salva no banco ou .env)
const ConfigSchema = new mongoose.Schema({
  chave:  { type:String, unique:true, required:true },
  valor:   mongoose.Schema.Types.Mixed,
  updatedAt:{ type:Date, default:Date.now },
});
const Config = mongoose.models.Config || mongoose.model('Config', ConfigSchema);

// Model de notificação
const NotifSchema = new mongoose.Schema({
  tipo:       { type:String, required:true }, // 'obrigacao_vence','honorario_atraso','folha_fechamento','sped_prazo'
  destinatario:String,
  assunto:    String,
  corpo:      String,
  status:     { type:String, enum:['pendente','enviado','erro'], default:'pendente' },
  erro:       String,
  company:    { type:mongoose.Schema.Types.ObjectId, ref:'Company' },
  referencia: String, // ID do objeto relacionado
  lida:       { type:Boolean, default:false },
}, { timestamps:true });

const Notificacao = mongoose.models.Notificacao || mongoose.model('Notificacao', NotifSchema);

// ── CONFIGURAÇÃO SMTP ─────────────────────────────────────────
exports.getConfig = async (req,res) => {
  try{
    const cfg = await Config.findOne({ chave:'email_config' });
    const dados = cfg?.valor||{};
    // Nunca retorna a senha
    const { senha:_, ...semSenha } = dados;
    res.json({ success:true, config:semSenha });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

exports.saveConfig = async (req,res) => {
  try{
    const { host, porta, usuario, senha, nome, ativo, testar } = req.body;
    const config = { host, porta:parseInt(porta)||587, usuario, nome:nome||'DTP Contábil', ativo:ativo!==false };
    if(senha) config.senha = senha;

    await Config.findOneAndUpdate(
      { chave:'email_config' },
      { $set:{ valor:config, updatedAt:new Date() } },
      { upsert:true }
    );

    if(testar&&usuario){
      const testResult = await enviarEmail({ to:usuario, subject:'✅ Teste de E-mail — DTP Contábil', html:'<p>Configuração SMTP funcionando corretamente!</p><p>DTP Contábil ERP</p>' });
      if(testResult.ok) res.json({ success:true, message:'Configuração salva e e-mail de teste enviado!' });
      else res.json({ success:true, message:'Configuração salva. Teste falhou: '+testResult.erro });
    } else {
      res.json({ success:true, message:'Configuração SMTP salva!' });
    }
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── ENVIAR E-MAIL ─────────────────────────────────────────────
async function enviarEmail({ to, subject, html }){
  try{
    // Importa nodemailer dinamicamente
    let nodemailer;
    try{ nodemailer = require('nodemailer'); } catch(e){ return { ok:false, erro:'Nodemailer não instalado. Execute: npm install nodemailer' }; }

    const cfg = await Config.findOne({ chave:'email_config' });
    if(!cfg?.valor?.host) return { ok:false, erro:'SMTP não configurado' };
    const c = cfg.valor;

    const transporter = nodemailer.createTransport({
      host: c.host, port: c.porta||587,
      secure: c.porta===465,
      auth:{ user:c.usuario, pass:c.senha },
    });
    await transporter.sendMail({ from:`"${c.nome||'DTP Contábil'}" <${c.usuario}>`, to, subject, html });
    return { ok:true };
  }catch(e){ return { ok:false, erro:e.message }; }
}

// ── LIST NOTIFICAÇÕES ─────────────────────────────────────────
exports.list = async (req,res) => {
  try{
    const { status, tipo, lida } = req.query;
    const f={};
    if(status) f.status=status;
    if(tipo)   f.tipo=tipo;
    if(lida!==undefined) f.lida = lida==='true';
    const items = await Notificacao.find(f)
      .populate('company','legalName tradeName')
      .sort({ createdAt:-1 }).limit(100);
    const naoLidas = await Notificacao.countDocuments({ lida:false });
    res.json({ success:true, items, naoLidas });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

exports.marcarLida = async (req,res) => {
  try{
    await Notificacao.findByIdAndUpdate(req.params.id, { lida:true });
    res.json({ success:true, message:'Notificação marcada como lida' });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

exports.marcarTodasLidas = async (req,res) => {
  try{
    await Notificacao.updateMany({ lida:false }, { lida:true });
    res.json({ success:true, message:'Todas marcadas como lidas' });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── PROCESSAR NOTIFICAÇÕES (cron / manual) ────────────────────
exports.processar = async (req,res) => {
  try{
    const resultado = await processarNotificacoes();
    res.json({ success:true, ...resultado });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

exports.enviarPendentes = async (req,res) => {
  try{
    const pendentes = await Notificacao.find({ status:'pendente' }).limit(50);
    let enviados=0, erros=0;
    for(const n of pendentes){
      if(n.destinatario){
        const r = await enviarEmail({ to:n.destinatario, subject:n.assunto, html:n.corpo });
        if(r.ok){ n.status='enviado'; enviados++; }
        else     { n.status='erro'; n.erro=r.erro; erros++; }
        await n.save();
      }
    }
    res.json({ success:true, message:`${enviados} enviados, ${erros} erros`, enviados, erros });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── LÓGICA DE PROCESSAMENTO ───────────────────────────────────
async function processarNotificacoes(){
  const geradas=[];
  const now = new Date(); now.setHours(0,0,0,0);
  const em7  = new Date(now); em7.setDate(em7.getDate()+7);
  const em3  = new Date(now); em3.setDate(em3.getDate()+3);

  // 1. Obrigações vencendo em 7 dias
  const obrigVencendo = await Duty.find({
    dueDate:{ $gte:now, $lte:em7 },
    status:{ $nin:['entregue','pago','dispensado'] },
  }).populate('company','legalName tradeName contactName contactEmail');

  for(const ob of obrigVencendo){
    const jaExiste = await Notificacao.findOne({ tipo:'obrigacao_vence', referencia:ob._id.toString(), createdAt:{ $gte:new Date(now.getTime()-86400000) } });
    if(jaExiste) continue;
    const diasStr = Math.ceil((new Date(ob.dueDate)-now)/86400000);
    const corpo = templateObrigacao(ob, diasStr);
    const notif = await Notificacao.create({
      tipo:'obrigacao_vence', company:ob.company?._id,
      assunto:`⚠️ Obrigação vencendo em ${diasStr} dia(s): ${ob.name}`,
      corpo, destinatario: ob.company?.contactEmail||'',
      referencia: ob._id.toString(),
    });
    geradas.push(notif._id);
  }

  // 2. Honorários em atraso
  const cosAtrasadas = await Company.find({ status:'atrasado' }).select('legalName tradeName contactName contactEmail fee dueDay');
  for(const co of cosAtrasadas){
    const jaExiste = await Notificacao.findOne({ tipo:'honorario_atraso', referencia:co._id.toString(), createdAt:{ $gte:new Date(now.getTime()-86400000*3) } });
    if(jaExiste) continue;
    const corpo = templateHonorario(co);
    const admins = await User.find({ role:{ $in:['admin','contador'] }, active:{ $ne:false } }).select('email').limit(3);
    for(const admin of admins){
      await Notificacao.create({
        tipo:'honorario_atraso', company:co._id,
        assunto:`💰 Honorário em atraso: ${co.legalName}`,
        corpo, destinatario:admin.email,
        referencia:co._id.toString(),
      });
      geradas.push(co._id);
    }
  }

  // 3. Obrigações atrasadas (urgente)
  const obrigAtrasadas = await Duty.find({
    dueDate:{ $lt:now },
    status:{ $nin:['entregue','pago','dispensado','atrasado'] },
  }).populate('company','legalName tradeName');

  for(const ob of obrigAtrasadas){
    await Duty.findByIdAndUpdate(ob._id, { status:'atrasado' });
    const jaExiste = await Notificacao.findOne({ tipo:'obrigacao_atrasada', referencia:ob._id.toString(), createdAt:{ $gte:new Date(now.getTime()-86400000) } });
    if(jaExiste) continue;
    await Notificacao.create({
      tipo:'obrigacao_atrasada', company:ob.company?._id,
      assunto:`🚨 URGENTE: Obrigação em atraso — ${ob.name}`,
      corpo: templateObrigacaoAtrasada(ob),
      destinatario:'',
      referencia:ob._id.toString(),
    });
    geradas.push(ob._id);
  }

  return { geradas:geradas.length, obrigVencendo:obrigVencendo.length, cosAtrasadas:cosAtrasadas.length };
}

// ── TEMPLATES DE E-MAIL ───────────────────────────────────────
function templateObrigacao(ob, dias){
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
    <div style="background:#1a6fc4;color:#fff;padding:20px 24px">
      <div style="font-size:20px;font-weight:900">DTP Contábil</div>
      <div style="font-size:13px;opacity:.85;margin-top:4px">⚠️ Obrigação Fiscal Vencendo</div>
    </div>
    <div style="padding:24px">
      <p style="font-size:16px;font-weight:700;color:#1a1a2e">Atenção: ${ob.name}</p>
      <p style="color:#555;font-size:14px">Esta obrigação vence em <strong style="color:#dc2626">${dias} dia(s)</strong>.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0">
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px"><span style="color:#666">Obrigação</span><strong>${ob.name}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px"><span style="color:#666">Empresa</span><strong>${ob.company?.legalName||'—'}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px"><span style="color:#666">Tipo</span><strong>${ob.type}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span style="color:#666">Vencimento</span><strong style="color:#dc2626">${new Date(ob.dueDate).toLocaleDateString('pt-BR')}</strong></div>
      </div>
      <a href="http://localhost:3000/obrigacoes.html" style="display:inline-block;background:#1a6fc4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px">Acessar o Sistema →</a>
    </div>
    <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#888;border-top:1px solid #eee">DTP Contábil ERP · Notificação automática · ${new Date().toLocaleDateString('pt-BR')}</div>
  </div>`;
}

function templateHonorario(co){
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
    <div style="background:#dc2626;color:#fff;padding:20px 24px">
      <div style="font-size:20px;font-weight:900">DTP Contábil</div>
      <div style="font-size:13px;opacity:.85;margin-top:4px">💰 Honorário em Atraso</div>
    </div>
    <div style="padding:24px">
      <p style="font-size:16px;font-weight:700;color:#1a1a2e">Honorário em atraso: ${co.legalName}</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;margin:16px 0">
        <div style="font-size:13px;color:#555;padding:6px 0;border-bottom:1px solid #eee"><span style="color:#666">Empresa:</span> <strong>${co.legalName}</strong></div>
        <div style="font-size:13px;color:#555;padding:6px 0;border-bottom:1px solid #eee"><span style="color:#666">Honorário:</span> <strong>R$ ${(co.fee||0).toFixed(2).replace('.',',')}</strong></div>
        <div style="font-size:13px;color:#555;padding:6px 0"><span style="color:#666">Vencimento:</span> <strong>Dia ${co.dueDay||10} de cada mês</strong></div>
      </div>
      <a href="http://localhost:3000/honorarios.html" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px">Ver no Sistema →</a>
    </div>
    <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#888;border-top:1px solid #eee">DTP Contábil ERP · Notificação automática · ${new Date().toLocaleDateString('pt-BR')}</div>
  </div>`;
}

function templateObrigacaoAtrasada(ob){
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#7c3aed;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
      <div style="font-size:20px;font-weight:900">DTP Contábil</div>
      <div style="font-size:13px;opacity:.85">🚨 URGENTE: Obrigação em Atraso</div>
    </div>
    <div style="padding:20px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
      <p>A obrigação <strong>${ob.name}</strong> da empresa <strong>${ob.company?.legalName||'—'}</strong> está em ATRASO.</p>
      <p>Vencimento: <strong style="color:#dc2626">${new Date(ob.dueDate).toLocaleDateString('pt-BR')}</strong></p>
      <a href="http://localhost:3000/obrigacoes.html" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px">Regularizar agora →</a>
    </div>
  </div>`;
}
