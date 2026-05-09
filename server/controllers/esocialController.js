// server/controllers/esocialController.js
// e-Social — Geração de XMLs dos eventos principais
// Leiaute e-Social v2.5 / S-1.1 (2024)
// Transmissão via certificado digital A1/A3 (eCNPJ)

const Payroll = require('../models/Payroll');
const Company = require('../models/Company');
const mongoose = require('mongoose');

const cnpjLimpo = c => (c||'').replace(/\D/g,'');
const cpfLimpo  = c => (c||'').replace(/\D/g,'');
const fmtData   = d => { if(!d) return ''; const dt=new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; };
const fmtComp   = c => { if(!c) return ''; const [a,m]=c.split('-'); return a+String(m).padStart(2,'0'); };
const r2        = v => Math.round((v||0)*100)/100;

// Model de eventos eSocial
const EventoSchema = new mongoose.Schema({
  company:    { type:mongoose.Schema.Types.ObjectId, ref:'Company', required:true },
  tipo:       { type:String, required:true }, // S-1000, S-1200, S-2200, S-2299, S-5001, etc.
  status:     { type:String, enum:['pendente','processando','enviado','rejeitado','erro'], default:'pendente' },
  nrRec:      String,   // Número do Recibo do e-Social
  xml:        String,   // XML gerado
  protocolo:  String,
  competence: String,
  empregado:  String,   // Nome do empregado (para eventos de RH)
  dataEvento: { type:Date, default:Date.now },
  erros:      [String],
  createdBy:  { type:mongoose.Schema.Types.ObjectId, ref:'User' },
},{ timestamps:true });

const Evento = mongoose.models.EventoESocial || mongoose.model('EventoESocial', EventoSchema);

// ── LIST EVENTOS ──────────────────────────────────────────────
exports.list = async (req,res) => {
  try{
    const { company, tipo, status, competence } = req.query;
    const f={};
    if(company)    f.company    = company;
    if(tipo)       f.tipo       = tipo;
    if(status)     f.status     = status;
    if(competence) f.competence = competence;
    const items = await Evento.find(f)
      .populate('company','legalName tradeName cnpj')
      .sort({ createdAt:-1 }).limit(100);
    res.json({ success:true, items });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── STATS ─────────────────────────────────────────────────────
exports.stats = async (req,res) => {
  try{
    const { company } = req.query;
    const f={}; if(company) f.company=company;
    const eventos = await Evento.find(f).select('tipo status');
    res.json({ success:true, stats:{
      total:     eventos.length,
      pendentes: eventos.filter(e=>e.status==='pendente').length,
      enviados:  eventos.filter(e=>e.status==='enviado').length,
      rejeitados:eventos.filter(e=>e.status==='rejeitado').length,
      porTipo:   eventos.reduce((a,e)=>{ a[e.tipo]=(a[e.tipo]||0)+1; return a; },{})
    }});
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── S-1000 — Informações do Empregador ────────────────────────
exports.gerarS1000 = async (req,res) => {
  try{
    const { company:companyId } = req.query;
    const company = await Company.findById(companyId);
    if(!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const cnpj  = cnpjLimpo(company.cnpj);
    const now   = new Date().toISOString();
    const indApuracao = ['simples','mei'].includes(company.taxRegime)?'S':'N';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtInfoEmpregador/v02_04_02_00" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtInfoEmpregador Id="ID1${cnpj}${now.replace(/[-T:.Z]/g,'').substring(0,14)}00001">
    <ideEvento>
      <tpAmb>1</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpj}</nrInsc>
    </ideEmpregador>
    <infoEmpregador>
      <inclusao>
        <idePeriodo>
          <iniValid>${new Date().getFullYear().toString()+String(new Date().getMonth()+1).padStart(2,'0')}</iniValid>
        </idePeriodo>
        <infoCadastro>
          <nmRazao>${company.legalName}</nmRazao>
          <classTrib>${{simples:'03',presumido:'05',real:'01',mei:'07'}[company.taxRegime]||'05'}</classTrib>
          <indCoop>0</indCoop>
          <indConstr>0</indConstr>
          <indDesFolha>N</indDesFolha>
          <indOptRegEletron>0</indOptRegEletron>
          <indEntEd>N</indEntEd>
          <indEtt>N</indEtt>
          <sitPJ>0</sitPJ>
        </infoCadastro>
      </inclusao>
    </infoEmpregador>
  </evtInfoEmpregador>
</eSocial>`;

    // Salva o evento
    const evento = await Evento.create({
      company:companyId, tipo:'S-1000', xml,
      status:'pendente', dataEvento:new Date(),
      createdBy:req.user._id,
    });

    res.json({ success:true, message:'Evento S-1000 gerado', evento:{ _id:evento._id, tipo:evento.tipo, status:evento.status }, xml });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── S-1200 — Remuneração do Trabalhador ──────────────────────
exports.gerarS1200 = async (req,res) => {
  try{
    const { company:companyId, competence } = req.query;
    if(!companyId||!competence) return res.status(400).json({ success:false, message:'Informe empresa e competência' });

    const [company, folha] = await Promise.all([
      Company.findById(companyId),
      Payroll.findOne({ company:companyId, competence }),
    ]);
    if(!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });
    if(!folha?.employees?.length) return res.status(400).json({ success:false, message:'Folha sem funcionários' });

    const cnpj = cnpjLimpo(company.cnpj);
    const perApur = fmtComp(competence);
    const now = new Date().toISOString().replace(/[-T:.Z]/g,'').substring(0,14);
    const eventos = [];

    folha.employees.filter(e=>e.status==='ativo').forEach((emp,i)=>{
      const cpf = cpfLimpo(emp.cpf||'');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtRemun/v02_09_01_00">
  <evtRemun Id="ID1${cnpj}${now}${String(i+1).padStart(5,'0')}">
    <ideEvento>
      <indRetif>1</indRetif>
      <perApur>${perApur}</perApur>
      <tpAmb>1</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpj}</nrInsc>
    </ideEmpregador>
    <ideTrabalhador>
      <cpfTrab>${cpf}</cpfTrab>
    </ideTrabalhador>
    <dmDev>
      <codCateg>101</codCateg>
      <infoPerApur>
        <ideEstabLot>
          <tpInsc>1</tpInsc>
          <nrInsc>${cnpj}</nrInsc>
          <codLotacao>1</codLotacao>
          <remunPerApur>
            <matricula>${String(i+1).padStart(6,'0')}</matricula>
            <itensRemun>
              <codRubr>0001</codRubr>
              <ideTabRubr>DTP</ideTabRubr>
              <vrRubr>${r2(emp.salaryBase||0).toFixed(2)}</vrRubr>
            </itensRemun>
            ${emp.extraHours>0?`<itensRemun>
              <codRubr>0002</codRubr>
              <ideTabRubr>DTP</ideTabRubr>
              <vrRubr>${r2(emp.extraHours).toFixed(2)}</vrRubr>
            </itensRemun>`:''}
          </remunPerApur>
        </ideEstabLot>
      </infoPerApur>
    </dmDev>
    <infoDestinatario>
      <cpfDest>${cpf}</cpfDest>
      <dtNasc>${emp.nascimento?fmtData(emp.nascimento):'1990-01-01'}</dtNasc>
      <infoTrabalhador>
        <nmTrab>${emp.name}</nmTrab>
        <sexo>${emp.sexo||'M'}</sexo>
      </infoTrabalhador>
    </infoDestinatario>
  </evtRemun>
</eSocial>`;
      eventos.push({ cpf:emp.cpf, nome:emp.name, xml });
    });

    // Salva eventos no banco
    const saved = await Promise.all(eventos.map(ev=>Evento.create({
      company:companyId, tipo:'S-1200', xml:ev.xml,
      status:'pendente', competence, empregado:ev.nome,
      dataEvento:new Date(), createdBy:req.user._id,
    })));

    res.json({ success:true, message:`${eventos.length} eventos S-1200 gerados`, total:eventos.length, eventos:saved.map(s=>({_id:s._id,empregado:s.empregado,status:s.status})) });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── S-2200 — Admissão de Trabalhador ─────────────────────────
exports.gerarS2200 = async (req,res) => {
  try{
    const { company:companyId, empregadoData } = req.body;
    const emp = typeof empregadoData==='string'?JSON.parse(empregadoData):empregadoData;
    if(!companyId||!emp) return res.status(400).json({ success:false, message:'Informe empresa e dados do empregado' });

    const company = await Company.findById(companyId);
    if(!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const cnpj = cnpjLimpo(company.cnpj);
    const cpf  = cpfLimpo(emp.cpf||'');
    const now  = new Date().toISOString().replace(/[-T:.Z]/g,'').substring(0,14);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAdmissao/v02_09_01_00">
  <evtAdmissao Id="ID1${cnpj}${now}00001">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>1</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpj}</nrInsc>
    </ideEmpregador>
    <ideTrabalhador>
      <cpfTrab>${cpf}</cpfTrab>
      <nisTrab>${(emp.pis||'').replace(/\D/g,'')}</nisTrab>
    </ideTrabalhador>
    <vinculo>
      <matricula>000001</matricula>
      <tpRegTrab>1</tpRegTrab>
      <tpRegPrev>1</tpRegPrev>
      <dtAdm>${fmtData(emp.dataAdmissao)}</dtAdm>
      <tpAdmissao>1</tpAdmissao>
      <indAdmissao>1</indAdmissao>
      <nrProcTrab></nrProcTrab>
      <natAtividade>1</natAtividade>
      <infoCeletista>
        <dtBase>01</dtBase>
        <cnpjSindCategProf></cnpjSindCategProf>
        <dtOpcFGTS>${fmtData(emp.dataAdmissao)}</dtOpcFGTS>
      </infoCeletista>
      <cargo>
        <nmCargo>${emp.role||'Não Informado'}</nmCargo>
        <CBOCargo>${emp.cbo||'2522-05'}</CBOCargo>
      </cargo>
      <remuneracao>
        <vrSalFx>${r2(emp.salaryBase||0).toFixed(2)}</vrSalFx>
        <undSalFixo>5</undSalFixo>
      </remuneracao>
      <jornada>
        <qtdHrsSem>${emp.jornada?.includes('44')?44:emp.jornada?.includes('40')?40:44}</qtdHrsSem>
        <tpJornada>1</tpJornada>
      </jornada>
      <dadosAfastamento></dadosAfastamento>
      <InfoTrabalhador>
        <nmTrab>${emp.name}</nmTrab>
        <sexo>${emp.sexo||'M'}</sexo>
        <raca>1</raca>
        <estCiv>${{solteiro:'1',casado:'2',divorciado:'3',viuvo:'5','união estável':'6'}[(emp.estadoCivil||'solteiro').toLowerCase()]||'1'}</estCiv>
        <grauInstr>${{fundamental:'03',médio:'07',superior:'09','pós-graduação':'10',mestrado:'11',doutorado:'12'}[((emp.escolaridade||'médio completo')).toLowerCase().split(' ')[0]]||'07'}</grauInstr>
        <nomeeMae>${emp.nomeMae||'NÃO INFORMADO'}</nomeeMae>
        <nascimento>
          <dtNasc>${emp.nascimento?fmtData(emp.nascimento):'1990-01-01'}</dtNasc>
          <municipio>8105</municipio>
          <pais>105</pais>
        </nascimento>
        <endereco>
          <brasil>
            <tpLograd>R</tpLograd>
            <dscLograd>${emp.endereco||'NÃO INFORMADO'}</dscLograd>
            <nrLograd>S/N</nrLograd>
            <bairro>CENTRO</bairro>
            <cep>88000000</cep>
            <codMunic>8105</codMunic>
            <uf>${company.address?.state||'SC'}</uf>
          </brasil>
        </endereco>
        <trabEstrangeiro>N</trabEstrangeiro>
      </InfoTrabalhador>
    </vinculo>
  </evtAdmissao>
</eSocial>`;

    const evento = await Evento.create({
      company:companyId, tipo:'S-2200', xml,
      status:'pendente', empregado:emp.name,
      dataEvento:new Date(), createdBy:req.user._id,
    });

    res.json({ success:true, message:'S-2200 (Admissão) gerado', evento:{ _id:evento._id, tipo:'S-2200', status:'pendente' }, xml });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── S-2299 — Desligamento ─────────────────────────────────────
exports.gerarS2299 = async (req,res) => {
  try{
    const { company:companyId, empregadoData } = req.body;
    const emp = typeof empregadoData==='string'?JSON.parse(empregadoData):empregadoData;
    if(!companyId||!emp) return res.status(400).json({ success:false, message:'Informe empresa e dados' });

    const company = await Company.findById(companyId);
    if(!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const cnpj = cnpjLimpo(company.cnpj);
    const cpf  = cpfLimpo(emp.cpf||'');
    const now  = new Date().toISOString().replace(/[-T:.Z]/g,'').substring(0,14);
    const motivos = {
      'Pedido de Demissão':'01','Demissão Sem Justa Causa':'02','Demissão Com Justa Causa':'03',
      'Acordo Mútuo (§6º CLT)':'12','Aposentadoria':'21','Falecimento':'26',
    };
    const codMotivo = motivos[emp.motivoDemissao]||'02';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtDesligamento/v02_09_01_00">
  <evtDesligamento Id="ID1${cnpj}${now}00001">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>1</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpj}</nrInsc>
    </ideEmpregador>
    <ideTrabalhador>
      <cpfTrab>${cpf}</cpfTrab>
    </ideTrabalhador>
    <infoDeslig>
      <matricula>000001</matricula>
      <dtDeslig>${fmtData(emp.dataDemissao||new Date())}</dtDeslig>
      <mtvDeslig>${codMotivo}</mtvDeslig>
      <dtProjFimAPI></dtProjFimAPI>
      <pagtoAPI>N</pagtoAPI>
      <infoPensFalec></infoPensFalec>
      <infoDesligVinc>
        <nrProcTrab></nrProcTrab>
        <verbas>
          <dscVerba>Saldo de Salários</dscVerba>
          <vrVerba>${r2(emp.salaryBase||0).toFixed(2)}</vrVerba>
          <natureza>1</natureza>
        </verbas>
        ${codMotivo==='02'?`<verbas>
          <dscVerba>Aviso Prévio</dscVerba>
          <vrVerba>${r2(emp.salaryBase||0).toFixed(2)}</vrVerba>
          <natureza>1</natureza>
        </verbas>`:''}
      </infoDesligVinc>
    </infoDeslig>
  </evtDesligamento>
</eSocial>`;

    const evento = await Evento.create({
      company:companyId, tipo:'S-2299', xml,
      status:'pendente', empregado:emp.name,
      dataEvento:new Date(), createdBy:req.user._id,
    });

    res.json({ success:true, message:'S-2299 (Desligamento) gerado', evento:{ _id:evento._id, tipo:'S-2299', status:'pendente' }, xml });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── S-5001 — Bases e Contribuições ───────────────────────────
exports.gerarS5001 = async (req,res) => {
  try{
    const { company:companyId, competence } = req.query;
    if(!companyId||!competence) return res.status(400).json({ success:false, message:'Informe empresa e competência' });

    const [company, folha] = await Promise.all([
      Company.findById(companyId),
      Payroll.findOne({ company:companyId, competence }),
    ]);
    if(!company) return res.status(404).json({ success:false, message:'Empresa não encontrada' });

    const cnpj = cnpjLimpo(company.cnpj);
    const now  = new Date().toISOString().replace(/[-T:.Z]/g,'').substring(0,14);
    const perApur = fmtComp(competence);
    const totalINSS = r2((folha?.totalINSSEmployee||0)+(folha?.totalINSSEmployer||0));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/retorno/consulta/retornoInfo/v01_05_01_00">
  <retornoEnvioLote>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${cnpj}</nrInsc>
    </ideEmpregador>
    <ideTransmissor>
      <nrInsc>${cnpj}</nrInsc>
    </ideTransmissor>
    <eSocialBatch Id="ID1${cnpj}${now}">
      <evtBasesTrab Id="ID1${cnpj}${now}00001">
        <ideEvento>
          <nrRec>${now}</nrRec>
          <perApur>${perApur}</perApur>
          <indGuia>1</indGuia>
        </ideEvento>
        <ideEmpregador>
          <tpInsc>1</tpInsc>
          <nrInsc>${cnpj}</nrInsc>
        </ideEmpregador>
        <infoCP>
          <ideEstabLot>
            <tpInsc>1</tpInsc>
            <nrInsc>${cnpj}</nrInsc>
            <codLotacao>1</codLotacao>
            <infoTrabalhador>
              <qtdTrabAtiv>${folha?.headcount||0}</qtdTrabAtiv>
              <remunTotal>${r2(folha?.totalGross||0).toFixed(2)}</remunTotal>
              <cpContrib>${r2(folha?.totalINSSEmployer||0).toFixed(2)}</cpContrib>
              <cpDesconto>${r2(folha?.totalINSSEmployee||0).toFixed(2)}</cpDesconto>
              <fgts>${r2(folha?.totalFGTS||0).toFixed(2)}</fgts>
            </infoTrabalhador>
          </ideEstabLot>
          <infoCP>
            <tpCR>10000</tpCR>
            <vrCP>${totalINSS.toFixed(2)}</vrCP>
          </infoCP>
        </infoCP>
      </evtBasesTrab>
    </eSocialBatch>
  </retornoEnvioLote>
</eSocial>`;

    const evento = await Evento.create({
      company:companyId, tipo:'S-5001', xml,
      status:'pendente', competence,
      dataEvento:new Date(), createdBy:req.user._id,
    });

    res.json({ success:true, message:'S-5001 (Bases/Contribuições) gerado', evento:{ _id:evento._id }, xml });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── DOWNLOAD XML ──────────────────────────────────────────────
exports.downloadXML = async (req,res) => {
  try{
    const evento = await Evento.findById(req.params.id);
    if(!evento) return res.status(404).json({ success:false, message:'Evento não encontrado' });
    res.setHeader('Content-Type','application/xml;charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="${evento.tipo}_${evento._id}.xml"`);
    res.send(evento.xml);
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};

// ── ATUALIZAR STATUS ──────────────────────────────────────────
exports.atualizarStatus = async (req,res) => {
  try{
    const { status, nrRec, protocolo, erros } = req.body;
    const evento = await Evento.findByIdAndUpdate(req.params.id, {status,nrRec,protocolo,erros}, {new:true});
    if(!evento) return res.status(404).json({ success:false, message:'Não encontrado' });
    res.json({ success:true, message:'Status atualizado', evento });
  }catch(e){ res.status(500).json({ success:false, message:e.message }); }
};
