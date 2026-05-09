// server/services/spedValidator.js
// Valida arquivos SPED antes da exportação
// Replica regras do PVA (Programa Validador da Receita Federal)

const REGRAS_REGISTROS = {
  // ─── ECD ─── Escrituração Contábil Digital
  '0000': { obrigatorio:true, formato:/^\|0000\|/, descricao:'Abertura do Arquivo Digital e Identificação da Entidade' },
  '0001': { obrigatorio:true, descricao:'Abertura do Bloco 0' },
  'I001': { obrigatorio:true, descricao:'Abertura do Bloco I' },
  'I010': { obrigatorio:true, descricao:'Identificação da Escrituração Contábil' },
  'I030': { obrigatorio:false, descricao:'Termo de Abertura do Livro' },
  'I050': { obrigatorio:true, descricao:'Plano de Contas' },
  'I100': { obrigatorio:false, descricao:'Centro de Custos' },
  'I150': { obrigatorio:true, descricao:'Saldos Periódicos — Identificação do Período' },
  'I155': { obrigatorio:true, descricao:'Detalhe dos Saldos Periódicos' },
  'I200': { obrigatorio:true, descricao:'Lançamento Contábil' },
  'I250': { obrigatorio:true, descricao:'Partidas do Lançamento' },
  'J001': { obrigatorio:true, descricao:'Abertura do Bloco J' },
  'J005': { obrigatorio:false, descricao:'Demonstrações Contábeis' },
  'J100': { obrigatorio:false, descricao:'Balanço Patrimonial' },
  'J150': { obrigatorio:false, descricao:'DRE' },
  '9001': { obrigatorio:true, descricao:'Abertura do Bloco 9' },
  '9900': { obrigatorio:true, descricao:'Registros do Arquivo' },
  '9990': { obrigatorio:true, descricao:'Encerramento do Bloco 9' },
  '9999': { obrigatorio:true, descricao:'Encerramento do Arquivo Digital' },
};

const r2 = v => Math.round((v||0)*100)/100;

// ── Validar conteúdo ECD ──────────────────────────────────────
function validarECD(conteudo, dadosEmpresa) {
  const linhas = conteudo.split('\n').filter(l => l.trim());
  const erros = [];
  const avisos = [];
  const registrosEncontrados = {};

  // Contagem por registro
  linhas.forEach((linha, i) => {
    const match = linha.match(/^\|([^|]+)\|/);
    if (match) {
      const reg = match[1];
      registrosEncontrados[reg] = (registrosEncontrados[reg] || 0) + 1;
    }
  });

  // 1. Verifica registros obrigatórios
  Object.entries(REGRAS_REGISTROS).forEach(([reg, r]) => {
    if (r.obrigatorio && !registrosEncontrados[reg]) {
      erros.push({
        tipo: 'REGISTRO_OBRIGATORIO_AUSENTE',
        registro: reg,
        mensagem: `Registro ${reg} obrigatório não encontrado: ${r.descricao}`,
      });
    }
  });

  // 2. Valida primeira linha = registro 0000
  if (linhas.length > 0 && !linhas[0].startsWith('|0000|')) {
    erros.push({
      tipo: 'ABERTURA_INVALIDA',
      linha: 1,
      mensagem: 'Primeira linha deve ser o registro 0000 (abertura)',
    });
  }

  // 3. Valida última linha = 9999
  if (linhas.length > 0 && !linhas[linhas.length - 1].startsWith('|9999|')) {
    erros.push({
      tipo: 'ENCERRAMENTO_INVALIDO',
      linha: linhas.length,
      mensagem: 'Última linha deve ser o registro 9999 (encerramento)',
    });
  }

  // 4. Valida CNPJ no registro 0000
  const reg0000 = linhas.find(l => l.startsWith('|0000|'));
  if (reg0000) {
    const campos = reg0000.split('|');
    const cnpj = campos[7]; // posição do CNPJ no registro 0000
    if (!cnpj || !/^\d{14}$/.test(cnpj)) {
      erros.push({
        tipo: 'CNPJ_INVALIDO',
        registro: '0000',
        mensagem: 'CNPJ do registro 0000 inválido — deve ter 14 dígitos numéricos',
      });
    }
  }

  // 5. Verifica balanceamento débito/crédito (registros I250)
  let totalDebito = 0;
  let totalCredito = 0;
  linhas.filter(l => l.startsWith('|I250|')).forEach(linha => {
    const campos = linha.split('|');
    const valor = parseFloat((campos[2] || '0').replace(',', '.')) || 0;
    const indDC = campos[3]; // D ou C
    if (indDC === 'D') totalDebito += valor;
    else if (indDC === 'C') totalCredito += valor;
  });
  const dif = Math.abs(r2(totalDebito) - r2(totalCredito));
  if (dif > 0.01) {
    erros.push({
      tipo: 'PARTIDAS_DESBALANCEADAS',
      mensagem: `Total de débitos (${totalDebito.toFixed(2)}) ≠ total de créditos (${totalCredito.toFixed(2)}). Diferença: ${dif.toFixed(2)}`,
    });
  }

  // 6. Avisos
  if (linhas.length < 10) {
    avisos.push({
      tipo: 'POUCOS_REGISTROS',
      mensagem: 'Arquivo possui poucos registros — verifique se todos os lançamentos foram exportados',
    });
  }

  if (!registrosEncontrados['I050']) {
    avisos.push({
      tipo: 'PLANO_CONTAS_AUSENTE',
      mensagem: 'Plano de contas (I050) não encontrado — necessário para a Receita validar lançamentos',
    });
  }

  // 7. Verifica registro 9900 conta corretamente
  const reg9900Lines = linhas.filter(l => l.startsWith('|9900|'));
  reg9900Lines.forEach(linha => {
    const campos = linha.split('|');
    const regContado = campos[2];
    const totalDeclarado = parseInt(campos[3]) || 0;
    const totalReal = registrosEncontrados[regContado] || 0;
    if (totalDeclarado !== totalReal) {
      erros.push({
        tipo: 'CONTAGEM_INCORRETA',
        registro: '9900',
        mensagem: `Registro 9900: declarou ${totalDeclarado} ${regContado}, mas há ${totalReal} no arquivo`,
      });
    }
  });

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    totalRegistros: linhas.length,
    totalDebito: r2(totalDebito),
    totalCredito: r2(totalCredito),
    registros: registrosEncontrados,
  };
}

// ── Validar conteúdo EFD ──────────────────────────────────────
function validarEFD(conteudo, dadosEmpresa) {
  const linhas = conteudo.split('\n').filter(l => l.trim());
  const erros = [];
  const avisos = [];
  const registrosEncontrados = {};

  linhas.forEach((linha) => {
    const match = linha.match(/^\|([^|]+)\|/);
    if (match) {
      const reg = match[1];
      registrosEncontrados[reg] = (registrosEncontrados[reg] || 0) + 1;
    }
  });

  // Obrigatórios EFD ICMS/IPI
  const obrigatoriosEFD = ['0000', '0001', 'C001', 'D001', 'E001', 'G001', 'H001', 'K001', '1001', '9001', '9999'];
  obrigatoriosEFD.forEach(reg => {
    if (!registrosEncontrados[reg]) {
      erros.push({
        tipo: 'REGISTRO_OBRIGATORIO_AUSENTE',
        registro: reg,
        mensagem: `Registro ${reg} obrigatório ausente`,
      });
    }
  });

  if (linhas.length > 0 && !linhas[0].startsWith('|0000|')) {
    erros.push({ tipo: 'ABERTURA_INVALIDA', linha: 1, mensagem: 'Primeira linha deve ser registro 0000' });
  }
  if (linhas.length > 0 && !linhas[linhas.length - 1].startsWith('|9999|')) {
    erros.push({ tipo: 'ENCERRAMENTO_INVALIDO', linha: linhas.length, mensagem: 'Última linha deve ser registro 9999' });
  }

  // Aviso se sem documentos fiscais
  if (!registrosEncontrados['C100'] && !registrosEncontrados['D100']) {
    avisos.push({
      tipo: 'SEM_DOCUMENTOS',
      mensagem: 'Nenhum documento fiscal encontrado (C100/D100). Período sem movimento?',
    });
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    totalRegistros: linhas.length,
    registros: registrosEncontrados,
  };
}

// ── Calcular hash SHA256 do arquivo ───────────────────────────
function calcularHash(conteudo) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(conteudo).digest('hex');
}

// ── Validador genérico ────────────────────────────────────────
function validar(tipo, conteudo, dadosEmpresa) {
  switch (tipo) {
    case 'ECD':         return validarECD(conteudo, dadosEmpresa);
    case 'EFD':         return validarEFD(conteudo, dadosEmpresa);
    case 'EFD-Contrib': return validarEFD(conteudo, dadosEmpresa); // mesmo formato base
    case 'ECF':         return validarECD(conteudo, dadosEmpresa); // estrutura similar
    default:
      return { valido: false, erros: [{ mensagem: 'Tipo SPED desconhecido: ' + tipo }], avisos: [] };
  }
}

module.exports = { validar, validarECD, validarEFD, calcularHash };
