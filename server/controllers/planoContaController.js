const PlanoConta = require('../models/PlanoConta');

// Plano de Contas NBC padrão conforme CFC
const PLANO_NBC = [
  // ATIVO
  {codigo:'1',descricao:'ATIVO',tipo:'ativo',natureza:'devedora',nivel:1,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'1.1',descricao:'ATIVO CIRCULANTE',tipo:'ativo',natureza:'devedora',nivel:2,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'1.1.1',descricao:'Caixa e Equivalentes de Caixa',tipo:'ativo',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'1.1.1.01',descricao:'Caixa',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.1.1.02',descricao:'Bancos Conta Movimento',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.1.1.03',descricao:'Aplicações Financeiras de Liquidez Imediata',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.1.2',descricao:'Contas a Receber',tipo:'ativo',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'1.1.2.01',descricao:'Clientes',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.1.2.02',descricao:'(-) Provisão para Devedores Duvidosos',tipo:'ativo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'1.1.3',descricao:'Estoques',tipo:'ativo',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'1.1.3.01',descricao:'Mercadorias para Revenda',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.1.4',descricao:'Tributos a Recuperar',tipo:'ativo',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'1.1.4.01',descricao:'ICMS a Recuperar',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.1.4.02',descricao:'PIS a Recuperar',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.1.4.03',descricao:'COFINS a Recuperar',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.1.5',descricao:'Outros Ativos Circulantes',tipo:'ativo',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'1.1.5.01',descricao:'Adiantamentos a Fornecedores',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.1.5.02',descricao:'Despesas Antecipadas',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.2',descricao:'ATIVO NÃO CIRCULANTE',tipo:'ativo',natureza:'devedora',nivel:2,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'1.2.1',descricao:'Realizável a Longo Prazo',tipo:'ativo',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'1.2.2',descricao:'Investimentos',tipo:'ativo',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'1.2.2.01',descricao:'Participações em Coligadas e Controladas',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.2.3',descricao:'Imobilizado',tipo:'ativo',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'1.2.3.01',descricao:'Terrenos',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.2.3.02',descricao:'Edificações',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.2.3.03',descricao:'Móveis e Utensílios',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.2.3.04',descricao:'Equipamentos de Informática',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.2.3.05',descricao:'Veículos',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.2.3.06',descricao:'(-) Depreciação Acumulada',tipo:'ativo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'1.2.4',descricao:'Intangível',tipo:'ativo',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'1.2.4.01',descricao:'Marcas e Patentes',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'1.2.4.02',descricao:'Softwares',tipo:'ativo',natureza:'devedora',nivel:4,padrao_nbc:true},
  // PASSIVO
  {codigo:'2',descricao:'PASSIVO',tipo:'passivo',natureza:'credora',nivel:1,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'2.1',descricao:'PASSIVO CIRCULANTE',tipo:'passivo',natureza:'credora',nivel:2,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'2.1.1',descricao:'Fornecedores',tipo:'passivo',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'2.1.1.01',descricao:'Fornecedores Nacionais',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.2',descricao:'Obrigações Trabalhistas',tipo:'passivo',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'2.1.2.01',descricao:'Salários a Pagar',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.2.02',descricao:'INSS a Recolher',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.2.03',descricao:'FGTS a Recolher',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.2.04',descricao:'IRRF s/ Salários a Recolher',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.2.05',descricao:'Férias a Pagar',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.2.06',descricao:'13º Salário a Pagar',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.3',descricao:'Obrigações Tributárias',tipo:'passivo',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'2.1.3.01',descricao:'ICMS a Recolher',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.3.02',descricao:'PIS a Recolher',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.3.03',descricao:'COFINS a Recolher',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.3.04',descricao:'IRPJ a Recolher',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.3.05',descricao:'CSLL a Recolher',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.3.06',descricao:'Simples Nacional a Recolher',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.1.4',descricao:'Empréstimos e Financiamentos CP',tipo:'passivo',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'2.1.5',descricao:'Outras Obrigações',tipo:'passivo',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'2.1.5.01',descricao:'Adiantamentos de Clientes',tipo:'passivo',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'2.2',descricao:'PASSIVO NÃO CIRCULANTE',tipo:'passivo',natureza:'credora',nivel:2,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'2.2.1',descricao:'Empréstimos e Financiamentos LP',tipo:'passivo',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'2.2.2',descricao:'Provisões de Longo Prazo',tipo:'passivo',natureza:'credora',nivel:3,padrao_nbc:true},
  // PATRIMÔNIO LÍQUIDO
  {codigo:'3',descricao:'PATRIMÔNIO LÍQUIDO',tipo:'patrimonio',natureza:'credora',nivel:1,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'3.1',descricao:'Capital Social',tipo:'patrimonio',natureza:'credora',nivel:2,padrao_nbc:true},
  {codigo:'3.1.01',descricao:'Capital Social Subscrito',tipo:'patrimonio',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'3.2',descricao:'Reservas de Capital',tipo:'patrimonio',natureza:'credora',nivel:2,padrao_nbc:true},
  {codigo:'3.3',descricao:'Reservas de Lucros',tipo:'patrimonio',natureza:'credora',nivel:2,padrao_nbc:true},
  {codigo:'3.3.01',descricao:'Reserva Legal',tipo:'patrimonio',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'3.4',descricao:'Lucros/Prejuízos Acumulados',tipo:'patrimonio',natureza:'credora',nivel:2,padrao_nbc:true},
  {codigo:'3.4.01',descricao:'Lucros Acumulados',tipo:'patrimonio',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'3.4.02',descricao:'Prejuízos Acumulados',tipo:'patrimonio',natureza:'devedora',nivel:3,padrao_nbc:true},
  // RECEITAS
  {codigo:'4',descricao:'RECEITAS',tipo:'receita',natureza:'credora',nivel:1,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'4.1',descricao:'RECEITA BRUTA',tipo:'receita',natureza:'credora',nivel:2,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'4.1.1',descricao:'Receita de Vendas de Mercadorias',tipo:'receita',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'4.1.1.01',descricao:'Vendas de Mercadorias no Mercado Interno',tipo:'receita',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'4.1.2',descricao:'Receita de Prestação de Serviços',tipo:'receita',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'4.1.2.01',descricao:'Serviços Contábeis',tipo:'receita',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'4.1.2.02',descricao:'Honorários Profissionais',tipo:'receita',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'4.1.2.03',descricao:'Consultoria',tipo:'receita',natureza:'credora',nivel:4,padrao_nbc:true},
  {codigo:'4.2',descricao:'DEDUÇÕES DA RECEITA BRUTA',tipo:'receita',natureza:'devedora',nivel:2,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'4.2.1',descricao:'Devoluções e Abatimentos',tipo:'receita',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'4.2.2',descricao:'Impostos sobre Receita',tipo:'receita',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'4.2.2.01',descricao:'ISS s/ Serviços',tipo:'receita',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'4.2.2.02',descricao:'PIS s/ Faturamento',tipo:'receita',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'4.2.2.03',descricao:'COFINS s/ Faturamento',tipo:'receita',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'4.3',descricao:'OUTRAS RECEITAS',tipo:'receita',natureza:'credora',nivel:2,padrao_nbc:true},
  {codigo:'4.3.01',descricao:'Receitas Financeiras',tipo:'receita',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'4.3.02',descricao:'Rendimentos de Aplicações',tipo:'receita',natureza:'credora',nivel:3,padrao_nbc:true},
  {codigo:'4.3.03',descricao:'Receitas Diversas',tipo:'receita',natureza:'credora',nivel:3,padrao_nbc:true},
  // DESPESAS
  {codigo:'5',descricao:'DESPESAS',tipo:'despesa',natureza:'devedora',nivel:1,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'5.1',descricao:'CUSTO DOS PRODUTOS/SERVIÇOS',tipo:'custo',natureza:'devedora',nivel:2,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'5.1.1',descricao:'Custo das Mercadorias Vendidas',tipo:'custo',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'5.1.2',descricao:'Custo dos Serviços Prestados',tipo:'custo',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'5.1.2.01',descricao:'Mão de Obra Direta',tipo:'custo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.1.2.02',descricao:'Encargos Sociais s/ Mão de Obra',tipo:'custo',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2',descricao:'DESPESAS OPERACIONAIS',tipo:'despesa',natureza:'devedora',nivel:2,padrao_nbc:true,aceita_lancamento:false},
  {codigo:'5.2.1',descricao:'Despesas com Pessoal',tipo:'despesa',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'5.2.1.01',descricao:'Salários e Ordenados',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.1.02',descricao:'Pró-labore',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.1.03',descricao:'INSS — Cota Patronal',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.1.04',descricao:'FGTS',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.1.05',descricao:'Vale Transporte',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.1.06',descricao:'Vale Refeição / Alimentação',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.1.07',descricao:'Plano de Saúde',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.2',descricao:'Despesas Administrativas',tipo:'despesa',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'5.2.2.01',descricao:'Aluguel de Imóveis',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.2.02',descricao:'Energia Elétrica',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.2.03',descricao:'Água e Esgoto',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.2.04',descricao:'Telefone e Internet',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.2.05',descricao:'Material de Escritório',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.2.06',descricao:'Serviços de Terceiros',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.2.07',descricao:'Honorários Contábeis e Jurídicos',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.2.08',descricao:'Manutenção e Reparos',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.2.09',descricao:'Seguros',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.3',descricao:'Despesas Tributárias',tipo:'despesa',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'5.2.3.01',descricao:'IPTU',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.3.02',descricao:'IPVA',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.3.03',descricao:'IOF',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.3.04',descricao:'Taxas e Emolumentos',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.4',descricao:'Despesas Financeiras',tipo:'despesa',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'5.2.4.01',descricao:'Juros Passivos',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.4.02',descricao:'Tarifas Bancárias',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.4.03',descricao:'Multas e Penalidades',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.5',descricao:'Depreciações e Amortizações',tipo:'despesa',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'5.2.5.01',descricao:'Depreciação de Imobilizado',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.5.02',descricao:'Amortização de Intangível',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.6',descricao:'Despesas com Vendas / Marketing',tipo:'despesa',natureza:'devedora',nivel:3,padrao_nbc:true},
  {codigo:'5.2.6.01',descricao:'Publicidade e Propaganda',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
  {codigo:'5.2.6.02',descricao:'Comissões s/ Vendas',tipo:'despesa',natureza:'devedora',nivel:4,padrao_nbc:true},
];

exports.list = async (req, res) => {
  try {
    const { company, tipo, nivel, search } = req.query;
    const f = {};
    if (company) f.$or = [{ company }, { padrao_nbc: true, company: null }];
    else         f.padrao_nbc = true;
    if (tipo)    f.tipo  = tipo;
    if (nivel)   f.nivel = +nivel;
    if (search)  f.$or  = [{ codigo: new RegExp(search,'i') }, { descricao: new RegExp(search,'i') }];
    const items = await PlanoConta.find(f).sort({ codigo: 1 });
    res.json({ success: true, items });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.seed = async (req, res) => {
  try {
    const company = req.query.company || null;
    const exists = await PlanoConta.findOne({ padrao_nbc: true, company: null });
    if (exists) return res.json({ success: true, message: 'Plano NBC já existe', count: await PlanoConta.countDocuments({ padrao_nbc: true }) });
    await PlanoConta.insertMany(PLANO_NBC.map(p => ({ ...p, company: null })));
    res.json({ success: true, message: `Plano NBC carregado com ${PLANO_NBC.length} contas` });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.create = async (req, res) => {
  try {
    const item = await PlanoConta.create({ ...req.body, padrao_nbc: false });
    res.status(201).json({ success:true, message:'Conta criada', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.update = async (req, res) => {
  try {
    const item = await PlanoConta.findByIdAndUpdate(req.params.id, req.body, { new:true });
    if (!item) return res.status(404).json({ success:false, message:'Não encontrada' });
    res.json({ success:true, message:'Atualizada', item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const item = await PlanoConta.findById(req.params.id);
    if (item?.padrao_nbc) return res.status(400).json({ success:false, message:'Conta NBC padrão não pode ser removida' });
    await PlanoConta.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Removida' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

exports.searchContas = async (req, res) => {
  try {
    const { q, company } = req.query;
    if (!q || q.length < 2) return res.json({ success:true, items:[] });
    const f = {
      aceita_lancamento: true,
      ativo: true,
      $or: [{ codigo: new RegExp(q,'i') }, { descricao: new RegExp(q,'i') }]
    };
    if (company) f.$or = [{ company }, { padrao_nbc: true }];
    const items = await PlanoConta.find(f).sort({ codigo:1 }).limit(20);
    res.json({ success:true, items });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
};

module.exports.PLANO_NBC = PLANO_NBC;
